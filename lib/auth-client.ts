/**
 * =============================================================================
 * 1HEALTH AUTHENTICATION SERVICE (CLIENT-SIDE)
 * =============================================================================
 *
 * This module provides client-side authentication utilities for all 1health API
 * requests. It handles:
 *   - Token retrieval from cookies
 *   - Automatic token refresh on 401 responses
 *   - Direct communication with 1health (no server round-trip)
 *   - Debug logging to browser console
 *
 * IMPORTANT: This file is for CLIENT components only. It reads cookies from
 * document.cookie and makes fetch requests directly to 1health.
 *
 * =============================================================================
 * USAGE INSTRUCTIONS
 * =============================================================================
 *
 * When making ANY request to the 1health API from client components, use
 * `authFetch` instead of the native `fetch`. This ensures proper token
 * management and automatic refresh handling.
 *
 * EXAMPLE - Client Component:
 * \`\`\`typescript
 * "use client"
 * import { authFetch, getOneHealthBaseUrl } from "@/lib/auth-client"
 *
 * async function searchPatients(firstName: string) {
 *   const baseUrl = getOneHealthBaseUrl()
 *   const response = await authFetch(`${baseUrl}/api/v2/query`, {
 *     method: "POST",
 *     body: JSON.stringify({ key: "Patient", ... })
 *   })
 *   return response.json()
 * }
 * \`\`\`
 *
 * =============================================================================
 */

"use client"

// ============================================================================
// COOKIE UTILITIES
// ============================================================================

/**
 * Gets a cookie value by name from document.cookie
 */
export function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`))
  return match ? decodeURIComponent(match[1]) : null
}

/**
 * Sets a cookie with the given name, value, and maxAge (in seconds)
 */
export function setCookie(name: string, value: string, maxAge: number): void {
  if (typeof document === "undefined") return
  const secure = window.location.protocol === "https:" ? "; Secure" : ""
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAge}; SameSite=Lax${secure}`
}

/**
 * Deletes a cookie by setting its maxAge to 0
 */
export function deleteCookie(name: string): void {
  if (typeof document === "undefined") return
  document.cookie = `${name}=; path=/; max-age=0`
}

// ============================================================================
// TOKEN ACCESSORS
// ============================================================================

/**
 * Gets the current access token from cookies
 */
export function getAccessToken(): string | null {
  return getCookie("access_token")
}

/**
 * Gets the current refresh token from cookies
 */
export function getRefreshToken(): string | null {
  return getCookie("refresh_token")
}

/**
 * Gets the 1health base URL from cookies.
 * The URL is set per-environment (demo/prod) during authentication.
 */
export function getOneHealthBaseUrl(): string {
  const cookieUrl = getCookie("onehealth_base_url")
  if (cookieUrl) return cookieUrl

  throw new Error("No 1health base URL available. User must authenticate via /auth first.")
}

/**
 * Gets the user's organization ID from cookies
 */
export function getOrganizationId(): number | null {
  const orgIdCookie = getCookie("user_org_id")
  if (!orgIdCookie) return null
  const orgId = Number.parseInt(orgIdCookie, 10)
  return Number.isNaN(orgId) ? null : orgId
}

/**
 * Gets the current user ID from cookies
 */
export function getUserId(): number | null {
  const userIdCookie = getCookie("user_id")
  if (!userIdCookie) return null
  const userId = Number.parseInt(userIdCookie, 10)
  return Number.isNaN(userId) ? null : userId
}

/**
 * Gets the workflow owner tenant ID from cookies
 */
export function getWorkflowOwnerTenantId(): number | null {
  const tenantIdCookie = getCookie("workflow_owner_tenant_id")
  if (!tenantIdCookie) return null
  const tenantId = Number.parseInt(tenantIdCookie, 10)
  return Number.isNaN(tenantId) ? null : tenantId
}

/**
 * Sets the workflow owner tenant ID cookie
 */
export function setWorkflowOwnerTenantIdCookie(tenantId: number): void {
  setCookie("workflow_owner_tenant_id", tenantId.toString(), 60 * 60 * 24 * 7) // 7 days
}

// ============================================================================
// DEBUG LOGGING
// ============================================================================

interface ApiDebugInfo {
  url: string
  method: string
  headers: Record<string, string>
  body?: string | object
  status?: number
  statusText?: string
  responseBody?: string
  duration?: number
}

/**
 * Formats and logs API request/response to console
 * Headers and body are logged as formatted JSON strings for easy copying
 */
function logApiCall(type: "request" | "response", info: ApiDebugInfo): void {
  const timestamp = new Date().toLocaleTimeString()

  const headersStr = JSON.stringify(info.headers, null, 2)

  let bodyStr: string | undefined
  if (info.body) {
    try {
      const parsed = typeof info.body === "string" ? JSON.parse(info.body) : info.body
      bodyStr = JSON.stringify(parsed, null, 2)
    } catch {
      bodyStr = String(info.body)
    }
  }

  if (type === "request") {
    console.groupCollapsed(
      `%c[1health API] %c[${timestamp}] %c${info.method} %c${info.url}`,
      "color: #888",
      "color: #666",
      "color: #4CAF50; font-weight: bold",
      "color: #2196F3",
    )
    console.log("Headers:\n" + headersStr)
    if (bodyStr) {
      console.log("Body:\n" + bodyStr)
    }
    console.groupEnd()
  } else {
    const statusColor = info.status && info.status >= 200 && info.status < 300 ? "#4CAF50" : "#f44336"
    console.groupCollapsed(
      `%c[1health API] %c[${timestamp}] %c${info.method} %c${info.url} %c${info.status} %c(${info.duration}ms)`,
      "color: #888",
      "color: #666",
      "color: #4CAF50; font-weight: bold",
      "color: #2196F3",
      `color: ${statusColor}; font-weight: bold`,
      "color: #888",
    )
    console.log("Status:", info.status, info.statusText)
    console.log("Duration:", `${info.duration}ms`)
    console.log("Headers:\n" + headersStr)
    if (info.responseBody) {
      let responseStr: string
      try {
        const parsed = JSON.parse(info.responseBody)
        responseStr = JSON.stringify(parsed, null, 2)
      } catch {
        responseStr = info.responseBody
      }
      console.log("Response:\n" + responseStr)
    }
    console.groupEnd()
  }
}

// ============================================================================
// TOKEN REFRESH
// ============================================================================

let isRefreshing = false
let refreshPromise: Promise<boolean> | null = null

/**
 * Refreshes the access token using the refresh token.
 * Makes a direct call to 1health OAuth endpoint.
 * Returns true if successful, false if refresh failed.
 */
export async function refreshToken(): Promise<boolean> {
  // Prevent concurrent refresh attempts
  if (isRefreshing && refreshPromise) {
    return refreshPromise
  }

  isRefreshing = true
  refreshPromise = (async () => {
    const currentRefreshToken = getRefreshToken()

    if (!currentRefreshToken) {
      console.error("[auth-client] No refresh token available")
      isRefreshing = false
      return false
    }

    let baseUrl: string
    try {
      baseUrl = getOneHealthBaseUrl()
    } catch {
      console.error("[auth-client] No 1health base URL available")
      isRefreshing = false
      return false
    }

    // Remove trailing /api or /api/ - OAuth endpoint is at root
    baseUrl = baseUrl.replace(/\/api\/?$/, "")
    const tokenUrl = `${baseUrl}/auth/oauth2/token`
    const requestBody = `grant_type=refresh_token&refresh_token=${encodeURIComponent(currentRefreshToken)}&client_id=public-client`

    const debugInfo: ApiDebugInfo = {
      url: tokenUrl,
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: requestBody,
    }

    logApiCall("request", debugInfo)

    const startTime = Date.now()

    try {
      const response = await fetch(tokenUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
        },
        body: requestBody,
      })

      const duration = Date.now() - startTime
      const responseText = await response.text()

      logApiCall("response", {
        ...debugInfo,
        status: response.status,
        statusText: response.statusText,
        responseBody: responseText,
        duration,
      })

      if (!response.ok) {
        console.error("[auth-client] Token refresh failed:", response.status, responseText)
        isRefreshing = false
        return false
      }

      const data = JSON.parse(responseText)
      const accessTokenMaxAge = data.expires_in || 3600
      const refreshTokenMaxAge = accessTokenMaxAge * 2

      // Update cookies with new tokens
      setCookie("access_token", data.access_token, accessTokenMaxAge)
      if (data.refresh_token) {
        setCookie("refresh_token", data.refresh_token, refreshTokenMaxAge)
      }

      // Set expiration timestamps
      const tokenExpiresAt = Math.floor(Date.now() / 1000) + accessTokenMaxAge
      const refreshTokenExpiresAt = Math.floor(Date.now() / 1000) + refreshTokenMaxAge
      setCookie("token_expires_at", tokenExpiresAt.toString(), accessTokenMaxAge)
      setCookie("refresh_token_expires_at", refreshTokenExpiresAt.toString(), refreshTokenMaxAge)

      console.log("[auth-client] Token refreshed successfully")
      isRefreshing = false
      return true
    } catch (error) {
      console.error("[auth-client] Token refresh error:", error)
      isRefreshing = false
      return false
    }
  })()

  return refreshPromise
}

// ============================================================================
// AUTHENTICATED FETCH
// ============================================================================

export class SessionExpiredError extends Error {
  constructor() {
    super("SESSION_EXPIRED")
    this.name = "SessionExpiredError"
  }
}

/**
 * =============================================================================
 * authFetch - CLIENT-SIDE AUTHENTICATED FETCH
 * =============================================================================
 *
 * Use this function for ALL 1health API requests from client components.
 * It automatically:
 *   1. Attaches the Bearer token from cookies
 *   2. Logs request/response to browser console
 *   3. Intercepts 401 Unauthorized responses
 *   4. Attempts to refresh the token
 *   5. Retries the original request with the new token
 *   6. Throws SessionExpiredError if refresh fails
 *
 * @param url - The 1health API endpoint URL (use getOneHealthBaseUrl() to build it)
 * @param options - Standard fetch options (method, body, headers, etc.)
 * @returns Promise<Response> - The fetch response
 * @throws SessionExpiredError if token refresh fails
 *
 * @example
 * const baseUrl = getOneHealthBaseUrl()
 * const response = await authFetch(`${baseUrl}/api/v2/query`, {
 *   method: "POST",
 *   body: JSON.stringify({ key: "Patient", attributes: ["id", "name"] })
 * })
 * const data = await response.json()
 */
export async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  let accessToken = getAccessToken()

  // No access token - try to refresh first
  if (!accessToken) {
    const refreshed = await refreshToken()
    if (!refreshed) {
      throw new SessionExpiredError()
    }
    accessToken = getAccessToken()
    if (!accessToken) {
      throw new SessionExpiredError()
    }
  }

  // Build headers with Authorization
  const headers = new Headers(options.headers)
  headers.set("Authorization", `Bearer ${accessToken}`)

  // FormData requires the browser to set Content-Type with boundary
  const isFormData = options.body instanceof FormData
  if (options.body && !headers.has("Content-Type") && !isFormData) {
    headers.set("Content-Type", "application/json")
  }

  const method = options.method || "GET"
  const headersObj = Object.fromEntries(headers.entries())

  const logBody = isFormData
    ? `[FormData with ${Array.from((options.body as FormData).keys()).length} field(s)]`
    : options.body

  // Log request
  logApiCall("request", {
    url,
    method,
    headers: headersObj,
    body: logBody as string | undefined,
  })

  const startTime = Date.now()

  // Make the request
  const response = await fetch(url, {
    ...options,
    headers,
  })

  const duration = Date.now() - startTime

  // Clone response to read body for logging without consuming it
  const responseClone = response.clone()
  let responseBody: string
  try {
    responseBody = await responseClone.text()
  } catch {
    responseBody = "[Unable to read response body]"
  }

  // Log response
  logApiCall("response", {
    url,
    method,
    headers: headersObj,
    status: response.status,
    statusText: response.statusText,
    responseBody,
    duration,
  })

  // Handle 401 Unauthorized - attempt token refresh and retry
  if (response.status === 401) {
    console.log("[auth-client] Received 401, attempting token refresh...")
    const refreshed = await refreshToken()

    if (!refreshed) {
      throw new SessionExpiredError()
    }

    // Get the new token and retry
    const newAccessToken = getAccessToken()
    if (!newAccessToken) {
      throw new SessionExpiredError()
    }

    headers.set("Authorization", `Bearer ${newAccessToken}`)

    console.log("[auth-client] Retrying request with new token...")

    const retryHeaders = Object.fromEntries(headers.entries())

    logApiCall("request", {
      url,
      method,
      headers: retryHeaders,
      body: logBody as string | undefined,
    })

    const retryStartTime = Date.now()

    const retryResponse = await fetch(url, {
      ...options,
      headers,
    })

    const retryDuration = Date.now() - retryStartTime

    // Log retry response
    const retryClone = retryResponse.clone()
    let retryBody: string
    try {
      retryBody = await retryClone.text()
    } catch {
      retryBody = "[Unable to read response body]"
    }

    logApiCall("response", {
      url,
      method,
      headers: retryHeaders,
      status: retryResponse.status,
      statusText: retryResponse.statusText,
      responseBody: retryBody,
      duration: retryDuration,
    })

    return retryResponse
  }

  return response
}
