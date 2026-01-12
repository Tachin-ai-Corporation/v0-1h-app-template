/**
 * =============================================================================
 * WORKFLOW TEMPLATE ACTIONS
 * =============================================================================
 *
 * Server actions for fetching workflow template metadata from 1health.
 * WorkflowTemplate metadata provides information about available statuses,
 * steps, categories, and other configuration for journey/campaign grids.
 *
 * USAGE:
 * ```typescript
 * import { fetchWorkflowTemplateMetadata } from "@/app/actions/workflow-template-actions"
 *
 * // Fetch all workflow template metadata
 * const result = await fetchWorkflowTemplateMetadata()
 * if (result.success) {
 *   console.log(result.data.statuses)     // Available status values
 *   console.log(result.data.categories)   // Workflow categories
 *   console.log(result.data.stepTypes)    // Step type definitions
 * }
 * ```
 *
 * =============================================================================
 */

"use server"

import { authFetch, getOneHealthBaseUrl } from "@/lib/auth-server"

/**
 * Raw response type from /api/v2/type/key/{resourceType}
 * This is a generic metadata endpoint that returns type information
 */
export interface TypeKeyResponse {
  id: number
  resourceType: string
  name: string
  values?: TypeKeyValue[]
  [key: string]: unknown
}

export interface TypeKeyValue {
  id: number
  name: string
  key?: string
  description?: string
  sortOrder?: number
  isActive?: boolean
  [key: string]: unknown
}

/**
 * Parsed workflow template metadata with commonly used fields
 */
export interface WorkflowTemplateMetadata {
  raw: TypeKeyResponse
  statuses: TypeKeyValue[]
  categories: TypeKeyValue[]
  stepTypes: TypeKeyValue[]
  [key: string]: unknown
}

export interface WorkflowTemplateResult {
  success: boolean
  data?: WorkflowTemplateMetadata
  error?: string
}

/**
 * Fetches workflow template type metadata from 1health.
 * This endpoint provides metadata about WorkflowTemplate resources including
 * available statuses, categories, step types, etc.
 *
 * Endpoint: GET /api/v2/type/key/WorkflowTemplate
 *
 * @returns WorkflowTemplateResult with parsed metadata or error
 */
export async function fetchWorkflowTemplateMetadata(): Promise<WorkflowTemplateResult> {
  try {
    const baseUrl = await getOneHealthBaseUrl()
    const { response } = await authFetch(`${baseUrl}/api/v2/type/key/WorkflowTemplate`, {
      method: "GET",
    })

    if (!response.ok) {
      return {
        success: false,
        error: `Failed to fetch workflow template metadata: ${response.status} ${response.statusText}`,
      }
    }

    const raw: TypeKeyResponse = await response.json()

    // Parse the response to extract commonly used fields
    // The structure may vary, so we extract what we can and preserve the raw response
    const metadata: WorkflowTemplateMetadata = {
      raw,
      statuses: extractTypeKeyValues(raw, "status", "statuses"),
      categories: extractTypeKeyValues(raw, "category", "categories", "workflowCategory"),
      stepTypes: extractTypeKeyValues(raw, "stepType", "stepTypes", "workflowStepType"),
    }

    return {
      success: true,
      data: metadata,
    }
  } catch (error) {
    if (error instanceof Error && error.message === "SESSION_EXPIRED") {
      return { success: false, error: "SESSION_EXPIRED" }
    }
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error fetching workflow template metadata",
    }
  }
}

/**
 * Generic function to fetch type metadata for any resource type.
 * Useful for fetching metadata for other resource types beyond WorkflowTemplate.
 *
 * Endpoint: GET /api/v2/type/key/{resourceType}
 *
 * @param resourceType - The resource type to fetch metadata for (e.g., "Person", "Organization")
 * @returns TypeKeyResponse with raw metadata or null on error
 */
export async function fetchTypeMetadata(
  resourceType: string,
): Promise<{ success: boolean; data?: TypeKeyResponse; error?: string }> {
  try {
    const baseUrl = await getOneHealthBaseUrl()
    const { response } = await authFetch(`${baseUrl}/api/v2/type/key/${resourceType}`, {
      method: "GET",
    })

    if (!response.ok) {
      return {
        success: false,
        error: `Failed to fetch ${resourceType} metadata: ${response.status} ${response.statusText}`,
      }
    }

    const data: TypeKeyResponse = await response.json()
    return { success: true, data }
  } catch (error) {
    if (error instanceof Error && error.message === "SESSION_EXPIRED") {
      return { success: false, error: "SESSION_EXPIRED" }
    }
    return {
      success: false,
      error: error instanceof Error ? error.message : `Unknown error fetching ${resourceType} metadata`,
    }
  }
}

/**
 * Helper function to extract TypeKeyValue arrays from various possible locations
 * in the response object, since the API structure may vary.
 */
function extractTypeKeyValues(data: TypeKeyResponse, ...possibleKeys: string[]): TypeKeyValue[] {
  for (const key of possibleKeys) {
    const value = data[key]
    if (Array.isArray(value)) {
      return value as TypeKeyValue[]
    }
  }

  // Check nested in values array
  if (Array.isArray(data.values)) {
    for (const key of possibleKeys) {
      const found = data.values.find(
        (v) => v.key?.toLowerCase() === key.toLowerCase() || v.name?.toLowerCase() === key.toLowerCase(),
      )
      if (found && Array.isArray(found.values)) {
        return found.values as unknown as TypeKeyValue[]
      }
    }
  }

  return []
}
