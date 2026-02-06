/**
 * =============================================================================
 * 1HEALTH AUTHENTICATION SERVICE (SERVER-ONLY)
 * =============================================================================
 *
 * Server-side cookie accessors for authentication data. These are available
 * for use in Server Components, API routes, and middleware.
 *
 * NOTE: The initial LPL token exchange is handled directly by
 * app/api/token/route.tsx. These utilities provide read access to the
 * auth cookies that route sets.
 *
 * =============================================================================
 */

import { cookies } from "next/headers"

/** Retrieves the 1health base URL from cookies (set per-environment during auth). */
export async function getOneHealthBaseUrl(): Promise<string> {
  const cookieStore = await cookies()
  const url = cookieStore.get("onehealth_base_url")?.value
  if (url) return url
  throw new Error("No 1health base URL available. User must authenticate via /auth first.")
}

/** Retrieves the current access token from cookies. */
export async function getAccessToken(): Promise<string | null> {
  const cookieStore = await cookies()
  return cookieStore.get("access_token")?.value || null
}

/** Retrieves the current refresh token from cookies. */
export async function getRefreshToken(): Promise<string | null> {
  const cookieStore = await cookies()
  return cookieStore.get("refresh_token")?.value || null
}

/** Retrieves the user's organization ID from cookies. */
export async function getOrganizationId(): Promise<number | null> {
  const cookieStore = await cookies()
  const val = cookieStore.get("user_org_id")?.value
  if (!val) return null
  const id = Number.parseInt(val, 10)
  return Number.isNaN(id) ? null : id
}

/** Retrieves the current user ID from cookies. */
export async function getUserId(): Promise<number | null> {
  const cookieStore = await cookies()
  const val = cookieStore.get("user_id")?.value
  if (!val) return null
  const id = Number.parseInt(val, 10)
  return Number.isNaN(id) ? null : id
}

/** Retrieves the selected environment (demo/prod) from cookies. */
export async function getEnvironment(): Promise<string | null> {
  const cookieStore = await cookies()
  return cookieStore.get("onehealth_environment")?.value || null
}
