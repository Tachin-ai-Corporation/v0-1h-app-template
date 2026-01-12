/**
 * Custom Data Actions
 *
 * URL Patterns:
 * - POST /api/v2/query - Fetch custom data via query (use query actions)
 * - POST /api/v2/data/custom-data/bulk - Update custom data on any entity
 *
 * Purpose: Generic custom data operations for any 1health entity type.
 *
 * Custom data is a flexible JSON attribute available on all 1health entity types.
 * It allows storing arbitrary structured data without schema changes.
 *
 * USAGE:
 * - To READ custom data: Use the appropriate query action with "customData" in attributes
 *   IMPORTANT: Response attribute keys are PREFIXED:
 *   - Root entities: "ROOT.{EntityType}.customData"
 *   - Related entities: "{RelationshipName}.{ToType}.customData"
 *   See app/actions/query/README.md for full details.
 * - To WRITE custom data: Use updateCustomData() with APPEND or REPLACE operation
 */

"use server"

import { authFetch, getOneHealthBaseUrl } from "@/lib/auth-server"

/**
 * Operation type for custom data updates
 *
 * - APPEND: Merges new data with existing custom data (deep merge)
 * - REPLACE: Completely replaces existing custom data
 */
export type CustomDataOperation = "APPEND" | "REPLACE"

/**
 * Single custom data update request
 */
export interface CustomDataUpdate {
  /** The instance ID of the entity to update */
  instanceId: number
  /** The custom data to set/merge */
  customData: Record<string, any>
  /** Operation type: APPEND (merge) or REPLACE (overwrite) */
  operation: CustomDataOperation
}

/**
 * Result of a custom data update operation
 */
export interface CustomDataUpdateResult {
  success: boolean
  error?: string
}

/**
 * Update custom data on one or more entity instances
 *
 * This is a generic function that works with ANY 1health entity type.
 * The entity type is implicit - only the instanceId is needed.
 *
 * @param updates - Array of custom data updates to perform
 * @returns Result indicating success or failure
 *
 * @example
 * // Update custom data on a ContactPoint (APPEND mode - merges with existing)
 * await updateCustomData([{
 *   instanceId: 12345,
 *   customData: {
 *     verificationData: {
 *       verifiedDate: "2024-01-15",
 *       verifiedBy: "user@example.com"
 *     }
 *   },
 *   operation: "APPEND"
 * }])
 *
 * @example
 * // Update custom data on multiple entities at once
 * await updateCustomData([
 *   { instanceId: 123, customData: { status: "reviewed" }, operation: "APPEND" },
 *   { instanceId: 456, customData: { status: "reviewed" }, operation: "APPEND" },
 * ])
 *
 * @example
 * // Replace all custom data (use with caution)
 * await updateCustomData([{
 *   instanceId: 12345,
 *   customData: { newData: "only this will exist" },
 *   operation: "REPLACE"
 * }])
 */
export async function updateCustomData(updates: CustomDataUpdate[]): Promise<CustomDataUpdateResult> {
  try {
    const baseUrl = await getOneHealthBaseUrl()
    const url = `${baseUrl}/api/v2/data/custom-data/bulk`

    const { response } = await authFetch(url, {
      method: "POST",
      body: JSON.stringify(updates),
    })

    if (!response.ok) {
      const errorBody = await response.text()
      console.error("[v0] updateCustomData error:", response.status, errorBody)
      return {
        success: false,
        error: `API request failed with status ${response.status}: ${errorBody}`,
      }
    }

    return { success: true }
  } catch (error) {
    console.error("[v0] updateCustomData exception:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

/**
 * Update custom data on a single entity instance
 *
 * Convenience wrapper around updateCustomData for single-instance updates.
 *
 * @param instanceId - The entity instance ID
 * @param customData - The custom data to set/merge
 * @param operation - APPEND (default) or REPLACE
 */
export async function updateInstanceCustomData(
  instanceId: number,
  customData: Record<string, any>,
  operation: CustomDataOperation = "APPEND",
): Promise<CustomDataUpdateResult> {
  return updateCustomData([{ instanceId, customData, operation }])
}

/**
 * Update contact point custom data with verification info
 *
 * Specialized helper for the common pattern of storing per-target-org
 * verification data on contact points.
 *
 * @param contactPointId - The ContactPoint instance ID
 * @param targetOrgId - The target organization ID (used as key in custom data)
 * @param verifiedDate - ISO date string of verification
 * @param verifiedNote - Note about the verification
 */
export async function updateContactPointVerification(
  contactPointId: number,
  targetOrgId: number,
  verifiedDate: string,
  verifiedNote: string,
): Promise<CustomDataUpdateResult> {
  return updateCustomData([
    {
      instanceId: contactPointId,
      customData: {
        [targetOrgId]: {
          validationData: {
            verifiedDate,
            verifiedNote,
          },
        },
      },
      operation: "APPEND",
    },
  ])
}
