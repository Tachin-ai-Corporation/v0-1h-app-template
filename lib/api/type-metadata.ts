/**
 * Client-side Type Metadata API
 *
 * Replaces: app/actions/type-actions.ts
 */

import { authFetch, getOneHealthBaseUrl } from "@/lib/auth-client"

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

export interface AttributeValue {
  id: number
  name: string
  description?: string
  isDeleted?: boolean
}

export interface TypeAttribute {
  id: number
  name: string
  description?: string
  attrKey: string
  type: "INTEGER" | "TEXT" | "BOOLEAN" | "VALUE_LIST" | "DATETIME" | "DECIMAL" | "DATE" | string
  atrbType?: string
  isRequired?: boolean
  isDeleted?: boolean
  attributeValues?: AttributeValue[]
  defaultValue?: string
  minLength?: number
  maxLength?: number
}

export interface TypeRelationship {
  id: number
  name: string
  relKey: string
  reverseRelKey?: string
  direction: "FORWARD" | "BACKWARDS"
  fromBoClassName: string
  toBoClassName: string
  fromBoClassId: number
  toBoClassId: number
  inward?: string
  outward?: string
  isDeleted?: boolean
  attributes?: TypeAttribute[]
}

export interface TypeDefinition {
  id: number
  name: string
  description?: string
  boKey: string
  tableName?: string
  instancesCount?: number
  isDeleted?: boolean
  attributes: TypeAttribute[]
  relationships: TypeRelationship[]
}

export interface TypeSummary {
  id: number
  name: string
  description?: string
  boKey: string
  instancesCount?: number
}

// =============================================================================
// API RESPONSE TYPES
// =============================================================================

interface FetchAllTypesResult {
  success: boolean
  data?: TypeSummary[]
  error?: string
}

interface FetchTypeDetailsResult {
  success: boolean
  data?: TypeDefinition
  error?: string
}

// =============================================================================
// CACHING LAYER
// =============================================================================

const typeCache = new Map<string, TypeDefinition>()

const pendingRequests = new Map<string, Promise<FetchTypeDetailsResult>>()

/**
 * Gets cached type details if available (synchronous).
 */
export function getCachedTypeDetails(typeName: string): TypeDefinition | null {
  return typeCache.get(typeName) || null
}

/**
 * Clears the type cache (useful for testing or forcing refresh).
 */
export function clearTypeCache(): void {
  typeCache.clear()
  pendingRequests.clear()
}

/**
 * Prefetches multiple types in parallel, using cache for already-fetched types.
 * Returns a map of typeName -> TypeDefinition for successfully fetched types.
 */
export async function prefetchTypeDetails(typeNames: string[]): Promise<Map<string, TypeDefinition>> {
  const results = new Map<string, TypeDefinition>()
  const toFetch: string[] = []

  for (const typeName of typeNames) {
    const cached = typeCache.get(typeName)
    if (cached) {
      results.set(typeName, cached)
    } else if (!toFetch.includes(typeName)) {
      toFetch.push(typeName)
    }
  }

  // Fetch uncached types in parallel
  if (toFetch.length > 0) {
    const fetchPromises = toFetch.map((typeName) => fetchTypeDetails(typeName))
    const fetchResults = await Promise.all(fetchPromises)

    for (let i = 0; i < toFetch.length; i++) {
      const result = fetchResults[i]
      if (result.success && result.data) {
        results.set(toFetch[i], result.data)
      }
    }
  }

  return results
}

// =============================================================================
// API FUNCTIONS
// =============================================================================

/**
 * Fetches all available types from 1health.
 */
export async function fetchAllTypes(): Promise<FetchAllTypesResult> {
  try {
    const baseUrl = getOneHealthBaseUrl()
    const response = await authFetch(`${baseUrl}/api/v2/type/all`, { method: "GET" })

    if (!response.ok) {
      return { success: false, error: `Failed to fetch types: ${response.status} ${response.statusText}` }
    }

    const rawData = await response.json()
    const types: TypeSummary[] = (Array.isArray(rawData) ? rawData : [])
      .map((item: Record<string, unknown>) => ({
        id: item.id as number,
        name: item.name as string,
        description: item.description as string | undefined,
        boKey: item.boKey as string,
        instancesCount: item.instancesCount as number | undefined,
      }))
      .sort((a: TypeSummary, b: TypeSummary) => a.name.localeCompare(b.name))

    return { success: true, data: types }
  } catch (error) {
    if (error instanceof Error && error.message === "SESSION_EXPIRED") {
      return { success: false, error: "SESSION_EXPIRED" }
    }
    return { success: false, error: error instanceof Error ? error.message : "Unknown error fetching types" }
  }
}

/**
 * Fetches detailed type information including attributes and relationships.
 * Uses caching to avoid redundant requests.
 */
export async function fetchTypeDetails(typeName: string): Promise<FetchTypeDetailsResult> {
  const cached = typeCache.get(typeName)
  if (cached) {
    return { success: true, data: cached }
  }

  const pending = pendingRequests.get(typeName)
  if (pending) {
    return pending
  }

  const fetchPromise = (async (): Promise<FetchTypeDetailsResult> => {
    try {
      const baseUrl = getOneHealthBaseUrl()
      const response = await authFetch(`${baseUrl}/api/v2/type/key/${encodeURIComponent(typeName)}`, { method: "GET" })

      if (!response.ok) {
        return {
          success: false,
          error: `Failed to fetch type details for ${typeName}: ${response.status} ${response.statusText}`,
        }
      }

      const rawData = await response.json()
      const rawType = Array.isArray(rawData) ? rawData[0] : rawData

      if (!rawType) {
        return { success: false, error: `No type definition found for ${typeName}` }
      }

      const attributes: TypeAttribute[] = (rawType.attributes || [])
        .filter((attr: Record<string, unknown>) => !attr.isDeleted)
        .map((attr: Record<string, unknown>) => ({
          id: attr.id as number,
          name: attr.name as string,
          description: attr.description as string | undefined,
          attrKey: attr.attrKey as string,
          type: attr.type as string,
          atrbType: attr.atrbType as string | undefined,
          isRequired: attr.isRequired as boolean | undefined,
          isDeleted: attr.isDeleted as boolean | undefined,
          attributeValues: ((attr.attributeValues as Record<string, unknown>[]) || [])
            .filter((v: Record<string, unknown>) => !v.isDeleted)
            .map((v: Record<string, unknown>) => ({
              id: v.id as number,
              name: v.name as string,
              description: v.description as string | undefined,
            })),
          defaultValue: attr.defaultValue as string | undefined,
          minLength: attr.minLength as number | undefined,
          maxLength: attr.maxLength as number | undefined,
        }))
        .sort((a: TypeAttribute, b: TypeAttribute) => a.name.localeCompare(b.name))

      const relationships: TypeRelationship[] = (rawType.relationships || [])
        .filter((rel: Record<string, unknown>) => !rel.isDeleted)
        .map((rel: Record<string, unknown>) => ({
          id: rel.id as number,
          name: rel.name as string,
          relKey: rel.relKey as string,
          reverseRelKey: rel.reverseRelKey as string | undefined,
          direction: rel.direction as "FORWARD" | "BACKWARDS",
          fromBoClassName: rel.fromBoClassName as string,
          toBoClassName: rel.toBoClassName as string,
          fromBoClassId: rel.fromBoClassId as number,
          toBoClassId: rel.toBoClassId as number,
          inward: rel.inward as string | undefined,
          outward: rel.outward as string | undefined,
          isDeleted: rel.isDeleted as boolean | undefined,
          attributes: ((rel.attributes as Record<string, unknown>[]) || [])
            .filter((a: Record<string, unknown>) => !a.isDeleted)
            .map((a: Record<string, unknown>) => ({
              id: a.id as number,
              name: a.name as string,
              attrKey: a.attrKey as string,
              type: a.type as string,
            })) as TypeAttribute[],
        }))
        .sort((a: TypeRelationship, b: TypeRelationship) => a.name.localeCompare(b.name))

      const typeDefinition: TypeDefinition = {
        id: rawType.id as number,
        name: rawType.name as string,
        description: rawType.description as string | undefined,
        boKey: rawType.boKey as string,
        tableName: rawType.tableName as string | undefined,
        instancesCount: rawType.instancesCount as number | undefined,
        isDeleted: rawType.isDeleted as boolean | undefined,
        attributes,
        relationships,
      }

      typeCache.set(typeName, typeDefinition)

      return { success: true, data: typeDefinition }
    } catch (error) {
      if (error instanceof Error && error.message === "SESSION_EXPIRED") {
        return { success: false, error: "SESSION_EXPIRED" }
      }
      return {
        success: false,
        error: error instanceof Error ? error.message : `Unknown error fetching type details for ${typeName}`,
      }
    } finally {
      pendingRequests.delete(typeName)
    }
  })()

  pendingRequests.set(typeName, fetchPromise)

  return fetchPromise
}
