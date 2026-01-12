/**
 * =============================================================================
 * TYPE HELPER UTILITIES
 * =============================================================================
 *
 * Client-safe utility functions for working with type metadata.
 * These are NOT server actions - they can be imported by client components.
 */

import type { TypeRelationship } from "@/app/actions/type-actions"

/**
 * Helper to get the target type boKey for a relationship.
 * Handles both FORWARD and BACKWARDS relationships.
 *
 * @param relationship - The relationship definition
 * @param currentTypeBoKey - The current type's boKey
 */
export function getRelationshipTargetType(relationship: TypeRelationship, currentTypeBoKey: string): string {
  // For FORWARD relationships from current type, target is toBoClassName
  // For BACKWARDS relationships to current type, target is fromBoClassName
  if (relationship.direction === "FORWARD") {
    return relationship.toBoClassName.replace(/ /g, "")
  } else {
    return relationship.fromBoClassName.replace(/ /g, "")
  }
}

/**
 * Helper to format a relationship path for use in queries.
 *
 * CORRECT FORMAT: {FromType}.{relKey}.{ToType}
 *
 * The relKey is the EXACT value from the API's relationship.relKey property,
 * such as "WorkflowTemplateStepIsRootOfWorkflowTemplate".
 *
 * IMPORTANT: Do NOT construct the relKey yourself by concatenating type names!
 * Always use the relKey provided by the GET /v2/type/key/{type} API response.
 *
 * Example:
 * - FromType: "WorkflowTemplate"
 * - relKey: "WorkflowTemplateStepIsRootOfWorkflowTemplate" (from API)
 * - ToType: "WorkflowTemplateStep"
 * - Result: "WorkflowTemplate.WorkflowTemplateStepIsRootOfWorkflowTemplate.WorkflowTemplateStep"
 *
 * @param fromType - The source type boKey
 * @param relKey - The relationship key from the API (relationship.relKey)
 * @param toType - The target type boKey
 */
export function formatRelationshipPath(fromType: string, relKey: string, toType: string): string {
  const fromTypeClean = (fromType || "").replace(/\s+/g, "")
  const toTypeClean = (toType || "").replace(/\s+/g, "")
  // Use relKey as-is - it comes directly from the API
  return `${fromTypeClean}.${relKey}.${toTypeClean}`
}
