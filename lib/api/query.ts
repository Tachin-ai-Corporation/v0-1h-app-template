/**
 * Client-side Query API
 *
 * Replaces: app/actions/query-actions.ts
 */

import { authFetch, getOneHealthBaseUrl } from "@/lib/auth-client"

interface ExecuteQueryResult {
  success: boolean
  data?: unknown
  error?: string
}

/**
 * Executes a /query API request.
 */
export async function executeQuery(request: Record<string, unknown>): Promise<ExecuteQueryResult> {
  try {
    const baseUrl = getOneHealthBaseUrl()
    const response = await authFetch(`${baseUrl}/api/v2/query`, {
      method: "POST",
      body: JSON.stringify(request),
    })

    if (!response.ok) {
      const errorText = await response.text()
      return { success: false, error: `HTTP ${response.status}: ${errorText}` }
    }

    const data = await response.json()
    return { success: true, data }
  } catch (error) {
    if (error instanceof Error && error.message === "SESSION_EXPIRED") {
      return { success: false, error: "SESSION_EXPIRED" }
    }
    return { success: false, error: error instanceof Error ? error.message : "Unknown error executing query" }
  }
}
