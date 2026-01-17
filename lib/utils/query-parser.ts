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
function parseFilterString(filter: string): Map<string, { operator: string; value: string; valueEnd?: string }> {
  const filters = new Map<string, { operator: string; value: string; valueEnd?: string }>()

  if (!filter) return filters

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

  const rangeStarts = new Map<string, string>()
  const rangeEnds = new Map<string, string>()

  for (const part of parts) {
    const trimmed = part.trim()
    if (!trimmed) continue

    const inMatch = trimmed.match(/^(\w+)=in=$$([^)]*)$$/)
    if (inMatch) {
      filters.set(inMatch[1], { operator: "=in=", value: inMatch[2] })
      continue
    }

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

    const eqMatch = trimmed.match(/^(\w+)==(.+)$/)
    if (eqMatch) {
      filters.set(eqMatch[1], { operator: "==", value: eqMatch[2] })
    }
  }

  for (const [attrKey, startValue] of rangeStarts) {
    const endValue = rangeEnds.get(attrKey)
    if (endValue) {
      filters.set(attrKey, { operator: "range", value: startValue, valueEnd: endValue })
      rangeEnds.delete(attrKey)
    } else {
      filters.set(attrKey, { operator: "=ge=", value: startValue })
    }
  }

  for (const [attrKey, endValue] of rangeEnds) {
    filters.set(attrKey, { operator: "=le=", value: endValue })
  }

  return filters
}

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

function collectTypeNamesToFetch(
  rootType: string,
  payloadRelationships: QueryRelationshipRequest[] | undefined,
): string[] {
  const types = new Set<string>([rootType])

  function collectFromRelationships(relationships: QueryRelationshipRequest[] | undefined) {
    if (!relationships) return
    for (const rel of relationships) {
      const parts = rel.key.split(".")
      if (parts.length === 3) {
        types.add(parts[0])
        types.add(parts[2])
      }
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
): Promise<RelationshipSelection[]> {
  const results: RelationshipSelection[] = []

  for (const rel of availableRelationships) {
    const isForward = rel.direction === "FORWARD"
    const targetTypeRaw = isForward ? rel.toBoClassName : rel.fromBoClassName
    const targetTypeKey = targetTypeRaw.replace(/\s+/g, "")
    const fromTypeKey = fromType.replace(/\s+/g, "")

    const fullQueryPath = `${fromTypeKey}.${rel.relKey}.${targetTypeKey}`

    const payloadRel = payloadRelationships?.find((pr) => pr.key === fullQueryPath)

    const selection: RelationshipSelection = {
      id: crypto.randomUUID(),
      relationshipKey: fullQueryPath,
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

        selection.nestedRelationships = await buildRelationshipSelections(
          payloadRel.relationships,
          targetTypeData.relationships,
          targetTypeKey,
          prefetchedTypes,
          depth + 1,
        )
      }
    }

    results.push(selection)
  }

  return results
}

export async function parseQueryPayload(
  payload: ParsedQueryPayload,
): Promise<{ success: boolean; state?: QueryBuilderState; error?: string }> {
  try {
    const rootType = payload.key

    const typesToFetch = collectTypeNamesToFetch(rootType, payload.relationships)
    const prefetchedTypes = await prefetchTypeDetails(typesToFetch)

    const rootTypeData = prefetchedTypes.get(rootType)
    if (!rootTypeData) {
      return { success: false, error: `Failed to fetch type details for ${rootType}` }
    }

    const filterMap = parseFilterString(payload.filter || "")

    const attributes = mapAttributesToSelections(rootTypeData.attributes, payload.attributes, filterMap)

    const relationships = await buildRelationshipSelections(
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

export function extractJsonFromInput(input: string): ParsedQueryPayload | null {
  const trimmed = input.trim()

  if (trimmed.toLowerCase().startsWith("curl")) {
    const dMatch = trimmed.match(/-d\s+['"]?(\{[\s\S]*\})['"]?\s*$/m)
    if (dMatch) {
      try {
        return JSON.parse(dMatch[1])
      } catch {
        return null
      }
    }

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

  try {
    return JSON.parse(trimmed)
  } catch {
    return null
  }
}
