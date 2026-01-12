/**
 * User Actions
 *
 * URL Pattern: GET /api/v2/user/myself
 *
 * Purpose: Fetch current user information including roles
 */

"use server"

import { authFetch, getOneHealthBaseUrl } from "@/lib/auth-server"

export interface UserInfo {
  id: number
  username: string
  firstName: string
  lastName: string
  email: string
  roles: string[]
  tenantContext: {
    id: number
    name: string
  }
  systemAdministrator: boolean
}

export interface MyselfResult {
  success: boolean
  data?: UserInfo
  error?: string
}

/**
 * Fetch current user information from the myself API
 */
export async function fetchMyselfAction(): Promise<MyselfResult> {
  try {
    const baseUrl = await getOneHealthBaseUrl()
    const url = `${baseUrl}/api/v2/user/myself`

    const { response } = await authFetch(url, {
      method: "GET",
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error("[v0] fetchMyselfAction error:", response.status, errorText)
      return {
        success: false,
        error: `Failed to fetch user info: ${response.status}`,
      }
    }

    const data = await response.json()

    return {
      success: true,
      data: {
        id: data.id,
        username: data.username,
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        roles: data.roles || [],
        tenantContext: data.tenantContext,
        systemAdministrator: data.systemAdministrator || false,
      },
    }
  } catch (error) {
    console.error("[v0] fetchMyselfAction exception:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

/**
 * Check if the current user is a System Admin
 */
export async function isSystemAdminAction(): Promise<boolean> {
  const result = await fetchMyselfAction()
  if (!result.success || !result.data) {
    return false
  }
  return result.data.roles.includes("System Admin") || result.data.systemAdministrator
}
