/**
 * Client-side User API
 *
 * Replaces: app/actions/user-actions.ts
 */

import { authFetch, getOneHealthBaseUrl } from "@/lib/auth-client"

export interface UserInfo {
  id: number
  username: string
  firstName: string
  lastName: string
  email: string
  roles: string[]
  tenantContext: { id: number; name: string }
  systemAdministrator: boolean
}

export interface MyselfResult {
  success: boolean
  data?: UserInfo
  error?: string
}

export async function fetchMyself(): Promise<MyselfResult> {
  try {
    const baseUrl = getOneHealthBaseUrl()
    const url = `${baseUrl}/api/v2/user/myself`

    console.log("[v0] fetchMyself - raw cookie value:", document.cookie.match(/onehealth_base_url=([^;]*)/)?.[1])
    console.log("[v0] fetchMyself - getOneHealthBaseUrl() returned:", baseUrl)
    console.log("[v0] fetchMyself - constructed URL:", url)

    const response = await authFetch(url, { method: "GET" })

    if (!response.ok) {
      const errorText = await response.text()
      console.error("[v0] fetchMyself error:", response.status, errorText)
      return { success: false, error: `Failed to fetch user info: ${response.status}` }
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
    console.error("[v0] fetchMyself exception:", error)
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" }
  }
}

export async function isSystemAdmin(): Promise<boolean> {
  const result = await fetchMyself()
  if (!result.success || !result.data) return false
  return result.data.roles.includes("System Admin") || result.data.systemAdministrator
}
