/**
 * =============================================================================
 * 1HEALTH AUTHENTICATION SERVICE (SERVER-ONLY)
 * =============================================================================
 *
 * DO NOT MODIFY THIS FILE unless you fully understand the token management flow.
 *
 * This module provides centralized authentication utilities for all 1health API
 * requests. It handles:
 *   - Token retrieval from cookies
 *   - Automatic token refresh on 401 responses
 *   - Redirect to 1health login when refresh fails
 *   - Dynamic 1health base URL from cookie (set by /auth page from referrer)
 *
 * IMPORTANT: This file can ONLY be imported in server contexts (Server Components,
 * Server Actions, Route Handlers). It uses next/headers which is not available
 * in client components.
 *
 * =============================================================================
 * USAGE INSTRUCTIONS FOR AGENTS/DEVELOPERS
 * =============================================================================
 *
 * When making ANY request to the 1health API, you MUST use `authFetch` instead
 * of the native `fetch`. This ensures proper token management and automatic
 * refresh handling.
 *
 * IMPORTANT: The 1health base URL is stored in a cookie (`onehealth_base_url`)
 * which is set automatically when users arrive at /auth from 1health.
 * Use `getOneHealthBaseUrl()` to retrieve it for building API URLs.
 *
 * EXAMPLE - Server Action:
 * \`\`\`typescript
 * "use server"
 * import { authFetch, getOneHealthBaseUrl } from "@/lib/auth-server"
 *
 * export async function getPatientData(patientId: string) {
 *   const baseUrl = await getOneHealthBaseUrl()
 *   const { response, debugInfo } = await authFetch(
 *     `${baseUrl}/api/v2/health/patient/${patientId}`,
 *     { method: "GET" }
 *   )
 *
 *   if (!response.ok) {
 *     // Handle non-auth errors (auth errors are handled automatically)
 *     return { success: false, error: response.statusText }
 *   }
 *
 *   const data = await response.json()
 *   return { success: true, data }
 * }
 * \`\`\`
 *
 * EXAMPLE - Route Handler:
 * \`\`\`typescript
 * import { authFetch, getOneHealthBaseUrl } from "@/lib/auth-server"
 * import { NextResponse } from "next/server"
 *
 * export async function GET() {
 *   const baseUrl = await getOneHealthBaseUrl()
 *   const { response, debugInfo } = await authFetch(
 *     `${baseUrl}/api/v2/user/myself`
 *   )
 *   const data = await response.json()
 *   return NextResponse.json(data)
 * }
 * \`\`\`
 *
 * EXAMPLE - Multipart/FormData (file uploads):
 * \`\`\`typescript
 * const formData = new FormData()
 * formData.append("file", fileBlob, "document.pdf")
 * formData.append("patientId", "123")
 *
 * const baseUrl = await getOneHealthBaseUrl()
 * const { response, debugInfo } = await authFetch(
 *   `${baseUrl}/api/v2/health/document/upload`,
 *   { method: "POST", body: formData }
 * )
 * // DO NOT set Content-Type header for FormData - browser handles it
 * \`\`\`
 *
 * IMPORTANT NOTES:
 * - DO NOT manually set Authorization headers - authFetch does this automatically
 * - DO NOT manually read access_token cookies - authFetch handles this
 * - DO NOT implement your own token refresh logic - authFetch handles this
 * - DO NOT hardcode 1health URLs - use getOneHealthBaseUrl() instead
 * - If authFetch returns a redirect response, the user's session has expired
 *   and they need to re-authenticate through 1health
 *
 * =============================================================================
 */

import { cookies } from "next/headers"
import type { ApiDebugInfo } from "./api-debug"
import { formatApiDebug, isDebugEnabled } from "./api-debug"
import { emitRequestLog, emitResponseLog } from "./debug-log-emitter"

/**
 * Retrieves the 1health base URL from cookies.
 * This is set by the /auth page from document.referrer.
 * Falls back to NEXT_PUBLIC_1H_URL env var if cookie not set.
 */
export async function getOneHealthBaseUrl(): Promise<string> {
  const cookieStore = await cookies()
  const urlFromCookie = cookieStore.get("onehealth_base_url")?.value

  if (urlFromCookie) {
    return decodeURIComponent(urlFromCookie)
  }

  const envUrl = process.env.NEXT_PUBLIC_1H_URL
  if (envUrl) {
    return envUrl
  }

  throw new Error("No 1health base URL available. User must authenticate via /auth first.")
}

/**
 * Retrieves the current access token from cookies.
 * For server-side use only.
 */
export async function getAccessToken(): Promise<string | null> {
  const cookieStore = await cookies()
  return cookieStore.get("access_token")?.value || null
}

/**
 * Retrieves the current refresh token from cookies.
 * For server-side use only.
 */
export async function getRefreshToken(): Promise<string | null> {
  const cookieStore = await cookies()
  return cookieStore.get("refresh_token")?.value || null
}

/**
 * Retrieves the user's organization ID from cookies.
 * For server-side use only.
 */
export async function getOrganizationId(): Promise<number | null> {
  const cookieStore = await cookies()
  const orgIdCookie = cookieStore.get("user_org_id")

  if (!orgIdCookie?.value) {
    return null
  }

  const orgId = Number.parseInt(orgIdCookie.value, 10)
  return Number.isNaN(orgId) ? null : orgId
}

/**
 * Retrieves the current user ID from cookies.
 * For server-side use only.
 */
export async function getUserId(): Promise<number | null> {
  const cookieStore = await cookies()
  const userIdCookie = cookieStore.get("user_id")

  if (!userIdCookie?.value) {
    return null
  }

  const userId = Number.parseInt(userIdCookie.value, 10)
  return Number.isNaN(userId) ? null : userId
}

/**
 * Retrieves the workflow owner tenant ID from cookies.
 * This is set automatically when journey grid data is fetched.
 * For server-side use only.
 */
export async function getWorkflowOwnerTenantId(): Promise<number | null> {
  const cookieStore = await cookies()
  const tenantIdCookie = cookieStore.get("workflow_owner_tenant_id")

  if (!tenantIdCookie?.value) {
    return null
  }

  const tenantId = Number.parseInt(tenantIdCookie.value, 10)
  return Number.isNaN(tenantId) ? null : tenantId
}

/**
 * Sets the workflow owner tenant ID cookie.
 * Called automatically after journey grid API fetches.
 */
export async function setWorkflowOwnerTenantIdCookie(tenantId: number): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.set("workflow_owner_tenant_id", tenantId.toString(), {
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: "/",
  })
}

/**
 * Attempts to refresh the access token using the refresh token.
 * Returns the new access token if successful, null if refresh fails.
 */
export async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = await getRefreshToken()

  if (!refreshToken) {
    return null
  }

  let authUrl: string
  try {
    authUrl = await getOneHealthBaseUrl()
  } catch (error) {
    console.error("[auth] Cannot refresh token - no 1health base URL available")
    return null
  }

  try {
    const response = await fetch(`${authUrl}/auth/oauth2/token`, {
      method: "POST",
      headers: {
        Accept: "application/json, text/plain, */*",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(refreshToken)}&client_id=public-client`,
    })

    if (!response.ok) {
      console.error("[auth] Token refresh failed:", response.statusText)
      return null
    }

    const data = await response.json()

    // Update cookies with new tokens
    const cookieStore = await cookies()
    const accessTokenMaxAge = data.expires_in || 3600
    const refreshTokenMaxAge = 60 * 60 * 24 * 7 // 7 days

    cookieStore.set("access_token", data.access_token, {
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: accessTokenMaxAge,
      path: "/",
    })

    if (data.refresh_token) {
      cookieStore.set("refresh_token", data.refresh_token, {
        httpOnly: false,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: refreshTokenMaxAge,
        path: "/",
      })
    }

    const tokenExpiresAt = Date.now() + accessTokenMaxAge * 1000
    cookieStore.set("token_expires_at", String(tokenExpiresAt), {
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: refreshTokenMaxAge,
      path: "/",
    })

    return data.access_token
  } catch (error) {
    console.error("[auth] Token refresh error:", error)
    return null
  }
}

/**
 * Redirects the user to 1health for re-authentication.
 * Called when both access token and refresh token are invalid/expired.
 * Uses the stored base URL from cookie, falls back to env var.
 */
export async function getLoginUrl(): Promise<string> {
  let loginUrl: string
  try {
    loginUrl = await getOneHealthBaseUrl()
  } catch {
    loginUrl = process.env.NEXT_PUBLIC_1H_URL || ""
  }

  if (!loginUrl) {
    throw new Error("No 1health URL available for redirect")
  }

  return loginUrl
}

/**
 * =============================================================================
 * authFetch - AUTHENTICATED FETCH WRAPPER
 * =============================================================================
 *
 * Use this function for ALL 1health API requests. It automatically:
 *   1. Attaches the Bearer token from cookies
 *   2. Intercepts 401 Unauthorized responses
 *   3. Attempts to refresh the token
 *   4. Retries the original request with the new token
 *   5. Redirects to 1health login if refresh fails
 *   6. Returns debug metadata for client-side logging
 *
 * @param url - The 1health API endpoint URL (use getOneHealthBaseUrl() to build it)
 * @param options - Standard fetch options (method, body, headers, etc.)
 * @returns Promise<{ response: Response, debugInfo: ApiDebugInfo }> - The fetch response and debug metadata
 *
 * SUPPORTED CONTENT TYPES:
 * - JSON (default): Pass a JSON string or object as body
 * - FormData/Multipart: Pass a FormData instance as body (Content-Type auto-set by browser)
 * - URL-encoded: Set Content-Type header manually to "application/x-www-form-urlencoded"
 *
 * @example JSON request
 * const baseUrl = await getOneHealthBaseUrl()
 * const { response, debugInfo } = await authFetch(
 *   `${baseUrl}/api/v2/health/patient/123`,
 *   { method: "GET" }
 * )
 *
 * @example Multipart/FormData request
 * const formData = new FormData()
 * formData.append("file", fileBlob, "document.pdf")
 * formData.append("patientId", "123")
 *
 * const baseUrl = await getOneHealthBaseUrl()
 * const { response, debugInfo } = await authFetch(
 *   `${baseUrl}/api/v2/health/document/upload`,
 *   { method: "POST", body: formData }
 * )
 */
export async function authFetch(
  url: string,
  options: RequestInit = {},
): Promise<{ response: Response; debugInfo: ApiDebugInfo }> {
  const accessToken = await getAccessToken()

  if (!accessToken) {
    // No access token - try to refresh
    const newToken = await refreshAccessToken()
    if (!newToken) {
      throw new Error("SESSION_EXPIRED")
    }
    // Retry with new token
    return authFetch(url, options)
  }

  // Merge Authorization header with any existing headers
  const headers = new Headers(options.headers)
  headers.set("Authorization", `Bearer ${accessToken}`)

  // FormData requires the browser to set the Content-Type with boundary
  const isFormData = options.body instanceof FormData
  if (options.body && !headers.has("Content-Type") && !isFormData) {
    headers.set("Content-Type", "application/json")
  }

  const logBody = isFormData
    ? `[FormData with ${Array.from((options.body as FormData).keys()).length} field(s): ${Array.from((options.body as FormData).keys()).join(", ")}]`
    : options.body

  const method = options.method || "GET"
  const headersObj = Object.fromEntries(headers.entries())

  const debugEnabled = isDebugEnabled()
  console.log(
    `[v0] authFetch - isDebugEnabled: ${debugEnabled}, NEXT_PUBLIC_ENABLE_DEBUG_STREAM: ${process.env.NEXT_PUBLIC_ENABLE_DEBUG_STREAM}`,
  )

  emitRequestLog("api-call", method, url, headersObj, logBody as string | object | undefined)

  const startTime = Date.now()

  const response = await fetch(url, {
    ...options,
    headers,
  })

  const responseClone = response.clone()
  const responseBody = await responseClone.text()

  const duration = Date.now() - startTime

  emitResponseLog(
    "api-call",
    method,
    url,
    response.status,
    response.statusText,
    Object.fromEntries(response.headers.entries()),
    responseBody,
    duration,
  )

  const debugInfo: ApiDebugInfo = {
    url,
    method,
    headers: headersObj,
    body: logBody,
    status: response.status,
    statusText: response.statusText,
    responseHeaders: Object.fromEntries(response.headers.entries()),
    responseBody: responseBody,
    duration,
  }

  if (debugEnabled) {
    console.log(formatApiDebug(debugInfo))
  }

  // Handle 401 Unauthorized - attempt token refresh
  if (response.status === 401) {
    const newToken = await refreshAccessToken()

    if (!newToken) {
      throw new Error("SESSION_EXPIRED")
    }

    // Retry the request with the new token
    headers.set("Authorization", `Bearer ${newToken}`)
    const retryHeadersObj = Object.fromEntries(headers.entries())

    emitRequestLog("api-call", method, url, retryHeadersObj, logBody as string | object | undefined)

    const retryStartTime = Date.now()

    const retryResponse = await fetch(url, {
      ...options,
      headers,
    })

    const retryClone = retryResponse.clone()
    const retryBody = await retryClone.text()

    const retryDuration = Date.now() - retryStartTime

    emitResponseLog(
      "api-call",
      method,
      url,
      retryResponse.status,
      retryResponse.statusText,
      Object.fromEntries(retryResponse.headers.entries()),
      retryBody,
      retryDuration,
    )

    const retryDebugInfo: ApiDebugInfo = {
      url,
      method,
      headers: retryHeadersObj,
      body: logBody,
      status: retryResponse.status,
      statusText: retryResponse.statusText,
      responseHeaders: Object.fromEntries(retryResponse.headers.entries()),
      responseBody: retryBody,
      duration: retryDuration,
    }

    if (debugEnabled) {
      console.log("[1HEALTH API] Retried after token refresh:")
      console.log(formatApiDebug(retryDebugInfo))
    }

    return { response: retryResponse, debugInfo: retryDebugInfo }
  }

  return { response, debugInfo }
}
