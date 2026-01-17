/**
 * Query Parser
 *
 * Parses a query payload JSON and converts it to QueryBuilderState.
 * Used for importing saved queries or pasting previous payloads.
 */

import type {
  QueryBuilderState,
  AttributeSelection,
  RelationshipSelection,
  QueryRelationshipRequest,
} from "@/lib/types/query-builder"
import {
  prefetchTypeDetails,
  type TypeAttribute,
  type TypeRelationship,
  type TypeDefinition,
} from "@/lib/api/type-metadata"

// Parsed query payload structure (what user pastes)
export interface ParsedQueryPayload {
  key: string
  attributes?: string[]
  filter?: string
  relationships?: QueryRelationshipRequest[]
  limit?: number
  offset?: number
}

const BASELINE_ATTRIBUTES: TypeAttribute[] = [
  { id: 0, attrKey: "id", name: "ID", type: "STRING", attributeValues: [] },
  { id: 0, attrKey: "created", name: "Created", type: "TIMESTAMP", attributeValues: [] },
  { id: 0, attrKey: "updated", name: "Updated", type: "TIMESTAMP", attributeValues: [] },
]

// Parse RSQL filter string into attribute filters
// e.g., "workflowCampaignId==91009622;status=in=(Active,Pending);updated=ge="2026-01-04T00:00:00";updated=le="2026-01-12T00:00:00""
function parseFilterString(filter: string): Map<string, { operator: string; value: string; valueEnd?: string }> {
  const filters = new Map<string, { operator: string; value: string; valueEnd?: string }>()

  if (!filter) return filters

  // Split by semicolon (AND operator in RSQL), but be careful of semicolons in quoted values
  const parts: string[] = []
  let current = ""
  let inQuotes = false

  for (let i = 0; i < filter.length; i++) {
    const char = filter[i]
    if (char === '"') {
      inQuotes = !inQuotes
    }
    if (char === ";" && !inQuotes) {
      if (current.trim()) parts.push(current.trim())
      current = ""
    } else {
      current += char
    }
  }
  if (current.trim()) parts.push(current.trim())

  // Group range filters (=ge= and =le= on same attribute)
  const rangeStarts = new Map<string, string>()
  const rangeEnds = new Map<string, string>()

  for (const part of parts) {
    const trimmed = part.trim()
    if (!trimmed) continue

    // Check for =in= operator
    const inMatch = trimmed.match(/^(\w+)=in=$$([^)]*)$$/)
    if (inMatch) {
      filters.set(inMatch[1], { operator: "=in=", value: inMatch[2] })
      continue
    }

    // Check for comparison operators (=ge=, =le=, =gt=, =lt=)
    const compMatch = trimmed.match(/^(\w+)(=ge=|=le=|=gt=|=lt=)"?([^"]*)"?$/)
    if (compMatch) {
      const [, attrKey, op, value] = compMatch
      if (op === "=ge=") {
        rangeStarts.set(attrKey, value)
      } else if (op === "=le=") {
        rangeEnds.set(attrKey, value)
      } else {
        filters.set(attrKey, { operator: op, value })
      }
      continue
    }

    // Check for == operator
    const eqMatch = trimmed.match(/^(\w+)==(.+)$/)
    if (eqMatch) {
      filters.set(eqMatch[1], { operator: "==", value: eqMatch[2] })
    }
  }

  // Combine range filters into a single "range" operator
  for (const [attrKey, startValue] of rangeStarts) {
    const endValue = rangeEnds.get(attrKey)
    if (endValue) {
      filters.set(attrKey, { operator: "range", value: startValue, valueEnd: endValue })
      rangeEnds.delete(attrKey)
    } else {
      // Only start, treat as >= filter
      filters.set(attrKey, { operator: "=ge=", value: startValue })
    }
  }

  // Handle any remaining end-only ranges as <= filters
  for (const [attrKey, endValue] of rangeEnds) {
    filters.set(attrKey, { operator: "=le=", value: endValue })
  }

  return filters
}

// Convert TypeAttribute array to AttributeSelection array with selections applied
function mapAttributesToSelections(
  typeAttributes: TypeAttribute[],
  selectedAttributes: string[] | undefined,
  filterMap: Map<string, { operator: string; value: string; valueEnd?: string }>,
): AttributeSelection[] {
  const selectedSet = new Set(selectedAttributes || [])

  const allAttributes = [...BASELINE_ATTRIBUTES, ...typeAttributes]

  return allAttributes.map((attr) => {
    const filter = filterMap.get(attr.attrKey)
    return {
      key: attr.attrKey,
      label: attr.name,
      type: attr.type,
      selected: selectedSet.has(attr.attrKey) || (attr.attrKey === "id" && !selectedAttributes),
      filterEnabled: !!filter,
      filterOperator: filter?.operator || "==",
      filterValue: filter?.value || "",
      filterValueEnd: filter?.valueEnd,
      valueOptions: attr.attributeValues?.map((v) => v.name),
    }
  })
}

// Parse relationship key to extract components
// e.g., "WorkflowTemplate.WorkflowTemplateHasGoToMarketOrganization.Organization"
// Returns { fromType, relKey, toType }
function parseRelationshipKey(key: string): { fromType: string; relKey: string; toType: string } | null {
  const parts = key.split(".")
  if (parts.length !== 3) return null
  return {
    fromType: parts[0],
    relKey: parts[1],
    toType: parts[2],
  }
}

function collectTypeNamesToFetch(
  rootType: string,
  payloadRelationships: QueryRelationshipRequest[] | undefined,
): string[] {
  const types = new Set<string>([rootType])

  function collectFromRelationships(relationships: QueryRelationshipRequest[] | undefined) {
    if (!relationships) return
    for (const rel of relationships) {
      // Parse the relationship key to get the target type
      const parts = rel.key.split(".")
      if (parts.length === 3) {
        // Add both types from the relationship key (in case of backward relationships)
        types.add(parts[0])
        types.add(parts[2])
      }
      // Recursively collect from nested relationships
      collectFromRelationships(rel.relationships)
    }
  }

  collectFromRelationships(payloadRelationships)
  return Array.from(types)
}

async function buildRelationshipSelections(
  payloadRelationships: QueryRelationshipRequest[] | undefined,
  availableRelationships: TypeRelationship[],
  fromType: string,
  prefetchedTypes: Map<string, TypeDefinition>,
  depth = 0,
): Promise<{ forward: RelationshipSelection[]; backward: RelationshipSelection[] }> {
  const forward: RelationshipSelection[] = []
  const backward: RelationshipSelection[] = []

  console.log(`[v0] buildRelationshipSelections depth=${depth} fromType=${fromType}`)
  console.log(`[v0]   payloadRelationshipKeys:`, payloadRelationships?.map((r) => r.key) || [])
  console.log(`[v0]   availableRelationships:`, availableRelationships.length)

  for (const rel of availableRelationships) {
    const isForward = rel.direction === "FORWARD"
    const targetTypeRaw = isForward ? rel.toBoClassName : rel.fromBoClassName
    const targetTypeKey = targetTypeRaw.replace(/\s+/g, "")
    const fromTypeKey = fromType.replace(/\s+/g, "")

    const fullQueryPath = isForward
      ? `${fromTypeKey}.${rel.relKey}.${targetTypeKey}`
      : `${targetTypeKey}.${rel.relKey}.${fromTypeKey}`

    // Match payload relationship using the full 3-part key
    const payloadRel = payloadRelationships?.find((pr) => pr.key === fullQueryPath)

    if (payloadRel) {
      console.log(`[v0]   MATCH: ${fullQueryPath} (has ${payloadRel.relationships?.length || 0} nested)`)
    }

    const selection: RelationshipSelection = {
      id: crypto.randomUUID(),
      relationshipKey: fullQueryPath, // Store full path for query generation
      relationshipName: rel.name,
      targetType: targetTypeKey,
      targetTypeLabel: targetTypeRaw,
      direction: rel.direction,
      enabled: !!payloadRel,
      limit: payloadRel?.limit || 10,
      attributes: [],
      nestedRelationships: [],
    }

    if (payloadRel) {
      const targetTypeData = prefetchedTypes.get(targetTypeKey)

      if (targetTypeData) {
        const filterMap = parseFilterString(payloadRel.filter || "")
        selection.attributes = mapAttributesToSelections(targetTypeData.attributes, payloadRel.attributes, filterMap)

        const nestedResult = await buildRelationshipSelections(
          payloadRel.relationships,
          targetTypeData.relationships,
          targetTypeKey,
          prefetchedTypes,
          depth + 1,
        )
        selection.nestedRelationships = [...nestedResult.forward, ...nestedResult.backward]

        const enabledNested = selection.nestedRelationships.filter((n) => n.enabled)
        console.log(
          `[v0]   Built ${selection.nestedRelationships.length} nested for ${fullQueryPath}, ${enabledNested.length} enabled`,
        )
      }
    }

    if (isForward) {
      forward.push(selection)
    } else {
      backward.push(selection)
    }
  }

  return { forward, backward }
}

// Main parser function - converts a query payload into QueryBuilderState
export async function parseQueryPayload(
  payload: ParsedQueryPayload,
): Promise<{ success: boolean; state?: QueryBuilderState; error?: string }> {
  try {
    const rootType = payload.key

    const typesToFetch = collectTypeNamesToFetch(rootType, payload.relationships)
    const prefetchedTypes = await prefetchTypeDetails(typesToFetch)

    // Get root type from prefetched data
    const rootTypeData = prefetchedTypes.get(rootType)
    if (!rootTypeData) {
      return { success: false, error: `Failed to fetch type details for ${rootType}` }
    }

    // Parse root filters
    const filterMap = parseFilterString(payload.filter || "")

    // Build attribute selections
    const attributes = mapAttributesToSelections(rootTypeData.attributes, payload.attributes, filterMap)

    const { forward: relationships, backward: backwardRelationships } = await buildRelationshipSelections(
      payload.relationships,
      rootTypeData.relationships,
      rootType,
      prefetchedTypes,
    )

    const state: QueryBuilderState = {
      rootType,
      rootTypeLabel: rootTypeData.name,
      attributes,
      relationships,
      backwardRelationships,
      limit: payload.limit || 10,
      offset: payload.offset || 0,
      isLoading: false,
      error: null,
    }

    return { success: true, state }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to parse query" }
  }
}

// Extract JSON from cURL command or raw JSON
export function extractJsonFromInput(input: string): ParsedQueryPayload | null {
  const trimmed = input.trim()

  // If it starts with curl, extract the -d payload
  if (trimmed.toLowerCase().startsWith("curl")) {
    // Match -d followed by single or double quoted JSON, or unquoted JSON
    const dMatch = trimmed.match(/-d\s+['"]?(\{[\s\S]*\})['"]?\s*$/m)
    if (dMatch) {
      try {
        return JSON.parse(dMatch[1])
      } catch {
        return null
      }
    }

    // Try matching -d with multiline JSON
    const multilineMatch = trimmed.match(/-d\s+'([\s\S]*?)'/)
    if (multilineMatch) {
      try {
        return JSON.parse(multilineMatch[1])
      } catch {
        return null
      }
    }

    return null
  }

  // Try parsing as raw JSON
  try {
    return JSON.parse(trimmed)
  } catch {
    return null
  }
}
