/**
 * =============================================================================
 * 1HEALTH AUTHENTICATION SERVICE (SERVER-ONLY)
 * =============================================================================
 *
 * This module provides server-side authentication utilities for the initial
 * LPL token exchange only. All subsequent API calls are made client-side.
 *
 * The only action requiring server-side execution is LPL decryption, which
 * uses ONEHEALTH_SECRET_KEY - the only secret in this application.
 *
 * =============================================================================
 */

import { cookies } from "next/headers"

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
