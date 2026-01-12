/**
 * Query Generator Utilities
 *
 * Converts QueryBuilderState into API request body and cURL commands.
 */

import type {
  QueryBuilderState,
  QueryRequestBody,
  QueryRelationshipRequest,
  AttributeSelection,
  RelationshipSelection,
} from "@/lib/types/query-builder"

/**
 * Format a datetime-local value to the API's expected format
 * Input: "2024-01-15T14:30" (from datetime-local input)
 * Output: "2024-01-15T00:00:00" (no quotes in this function, caller adds them)
 *
 * Updated format to match working API: YYYY-MM-DDTHH:mm:ss with double quotes
 */
function formatTimestampForApi(value: string): string {
  if (!value) return value

  // Remove any existing quotes first
  let cleanValue = value.replace(/^['"]|['"]$/g, "")

  // Remove Z suffix and microseconds if present
  cleanValue = cleanValue.replace(/\.\d+Z?$/, "").replace(/Z$/, "")

  // If it's just a date (YYYY-MM-DD), add time component
  if (/^\d{4}-\d{2}-\d{2}$/.test(cleanValue)) {
    cleanValue = `${cleanValue}T00:00:00`
  }

  // Ensure time has HH:mm:ss format
  if (cleanValue.includes("T")) {
    const parts = cleanValue.split("T")
    const datePart = parts[0]
    const timePart = parts[1] || "00:00:00"
    const timeParts = timePart.split(":")
    const hours = timeParts[0] || "00"
    const minutes = timeParts[1] || "00"
    const seconds = timeParts[2] || "00"
    cleanValue = `${datePart}T${hours}:${minutes}:${seconds}`
  }

  // Wrap in double quotes as per working API format
  return `"${cleanValue}"`
}

/**
 * Check if an attribute type is a timestamp type
 */
function isTimestampType(type: string): boolean {
  return type === "TIMESTAMP" || type === "DATE" || type === "DATETIME"
}

/**
 * Build the query request body from the builder state
 */
export function buildQueryRequest(state: QueryBuilderState): QueryRequestBody | null {
  if (!state.rootType) return null

  const request: QueryRequestBody = {
    key: state.rootType,
  }

  // Add selected attributes
  const selectedAttrs = state.attributes.filter((a) => a.selected).map((a) => a.key)
  if (selectedAttrs.length > 0) {
    request.attributes = selectedAttrs
  }

  // Build filter string from enabled filters
  const filterString = buildFilterString(state.attributes)
  if (filterString) {
    request.filter = filterString
  }

  const allRelationships = [...state.relationships, ...(state.backwardRelationships || [])]
  const relationships = buildRelationships(allRelationships)
  if (relationships.length > 0) {
    request.relationships = relationships
  }

  // Add pagination
  if (state.limit > 0) {
    request.limit = state.limit
  }
  if (state.offset > 0) {
    request.offset = state.offset
  }

  return request
}

/**
 * Build RSQL filter string from attribute selections
 */
export function buildFilterString(attributes: AttributeSelection[]): string {
  const filters = attributes
    .filter((a) => a.filterEnabled && a.filterValue.trim())
    .map((a) => {
      const isTimestamp = isTimestampType(a.type)
      const value = isTimestamp ? formatTimestampForApi(a.filterValue.trim()) : a.filterValue.trim()

      if (a.filterOperator === "range") {
        const startValue = value
        const endValue = isTimestamp ? formatTimestampForApi(a.filterValueEnd?.trim() || "") : a.filterValueEnd?.trim()
        if (!startValue || !endValue) return null
        // Range filter: key >= startValue AND key <= endValue
        return `${a.key}=ge=${startValue};${a.key}=le=${endValue}`
      }

      if (a.filterOperator === "=in=") {
        // Split comma-separated values and wrap in parentheses
        const values = a.filterValue
          .trim()
          .split(",")
          .map((v) => {
            const trimmed = v.trim()
            return isTimestamp ? formatTimestampForApi(trimmed) : trimmed
          })
          .filter(Boolean)
        if (values.length === 0) return null
        return `${a.key}=in=(${values.join(",")})`
      } else {
        return `${a.key}${a.filterOperator}${value}`
      }
    })
    .filter(Boolean)

  return filters.join(";")
}

/**
 * Build relationship requests recursively
 */
function buildRelationships(relationships: RelationshipSelection[]): QueryRelationshipRequest[] {
  return relationships
    .filter((r) => r.enabled)
    .map((r) => {
      const rel: QueryRelationshipRequest = {
        key: r.relationshipKey,
      }

      // Add selected attributes
      const selectedAttrs = r.attributes.filter((a) => a.selected).map((a) => a.key)
      if (selectedAttrs.length > 0) {
        rel.attributes = selectedAttrs
      }

      // Build filter string
      const filterString = buildFilterString(r.attributes)
      if (filterString) {
        rel.filter = filterString
      }

      // Add limit
      if (r.limit > 0) {
        rel.limit = r.limit
      }

      // Add nested relationships recursively
      const nestedRels = buildRelationships(r.nestedRelationships)
      if (nestedRels.length > 0) {
        rel.relationships = nestedRels
      }

      return rel
    })
}

/**
 * Generate a cURL command from the query request
 */
export function generateQueryCurl(request: QueryRequestBody, baseUrl = "https://app.1health.io"): string {
  const url = `${baseUrl}/api/v2/query`
  const body = JSON.stringify(request, null, 2)

  return `curl -X POST '${url}' \\
  -H 'Authorization: Bearer <YOUR_TOKEN>' \\
  -H 'Content-Type: application/json' \\
  -d '${body}'`
}

/**
 * Format JSON for display with syntax highlighting hints
 */
export function formatQueryJson(request: QueryRequestBody): string {
  return JSON.stringify(request, null, 2)
}
