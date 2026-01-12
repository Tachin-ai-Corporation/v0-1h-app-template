/**
 * =============================================================================
 * QUERY ACTIONS
 * =============================================================================
 *
 * Server actions for executing 1health /query API requests.
 * Used by the Query Builder to execute test queries.
 *
 * =============================================================================
 */

"use server"

import { authFetch, getOneHealthBaseUrl } from "@/lib/auth-server"

interface ExecuteQueryResult {
  success: boolean
  data?: unknown
  error?: string
}

/**
 * Executes a /query API request.
 * This is a server action wrapper around authFetch for use by client components.
 *
 * @param request - The query request body
 */
export async function executeQuery(request: Record<string, unknown>): Promise<ExecuteQueryResult> {
  try {
    const baseUrl = await getOneHealthBaseUrl()
    const { response } = await authFetch(`${baseUrl}/api/v2/query`, {
      method: "POST",
      body: JSON.stringify(request),
    })

    if (!response.ok) {
      const errorText = await response.text()
      return {
        success: false,
        error: `HTTP ${response.status}: ${errorText}`,
      }
    }

    const data = await response.json()
    return {
      success: true,
      data,
    }
  } catch (error) {
    if (error instanceof Error && error.message === "SESSION_EXPIRED") {
      return { success: false, error: "SESSION_EXPIRED" }
    }
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error executing query",
    }
  }
}
