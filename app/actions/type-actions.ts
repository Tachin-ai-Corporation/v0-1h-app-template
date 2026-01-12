/**
 * =============================================================================
 * TYPE METADATA ACTIONS
 * =============================================================================
 *
 * Server actions for fetching type metadata from 1health.
 * Used by the Query Builder to understand available types, attributes,
 * and relationships for building queries.
 *
 * ENDPOINTS:
 * - GET /v2/type/all - List all available types
 * - GET /v2/type/key/{typeName} - Get type details (attributes, relationships)
 *
 * USAGE:
 * \`\`\`typescript
 * import { fetchAllTypes, fetchTypeDetails } from "@/app/actions/type-actions"
 *
 * // Get all available types
 * const types = await fetchAllTypes()
 *
 * // Get details for a specific type
 * const personType = await fetchTypeDetails("Person")
 * \`\`\`
 *
 * =============================================================================
 */

"use server"

import { authFetch, getOneHealthBaseUrl } from "@/lib/auth-server"

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

/**
 * Attribute value for VALUE_LIST type attributes
 */
export interface AttributeValue {
  id: number
  name: string
  description?: string
  isDeleted?: boolean
}

/**
 * Attribute definition from type metadata
 */
export interface TypeAttribute {
  id: number
  name: string
  description?: string
  attrKey: string
  type: "INTEGER" | "TEXT" | "BOOLEAN" | "VALUE_LIST" | "DATETIME" | "DECIMAL" | "DATE" | string
  atrbType?: string // Human-readable type: "int", "text", "boolean", "value list", etc.
  isRequired?: boolean
  isDeleted?: boolean
  attributeValues?: AttributeValue[] // For VALUE_LIST types
  defaultValue?: string
  minLength?: number
  maxLength?: number
}

/**
 * Relationship definition from type metadata
 */
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
  inward?: string // e.g., "has"
  outward?: string // e.g., "is part of"
  isDeleted?: boolean
  attributes?: TypeAttribute[] // Relationship attributes
}

/**
 * Full type definition from /v2/type/key/{typeName}
 */
export interface TypeDefinition {
  id: number
  name: string
  description?: string
  boKey: string // The key used in queries, e.g., "Person", "WorkflowTemplate"
  tableName?: string
  instancesCount?: number
  isDeleted?: boolean
  attributes: TypeAttribute[]
  relationships: TypeRelationship[]
}

/**
 * Summary type info from /v2/type/all
 */
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
// ACTIONS
// =============================================================================

/**
 * Fetches all available types from 1health.
 * Returns a list of type summaries with boKey (used in queries) and basic info.
 *
 * Endpoint: GET /api/v2/type/all
 */
export async function fetchAllTypes(): Promise<FetchAllTypesResult> {
  try {
    const baseUrl = await getOneHealthBaseUrl()
    const { response } = await authFetch(`${baseUrl}/api/v2/type/all`, {
      method: "GET",
    })

    if (!response.ok) {
      return {
        success: false,
        error: `Failed to fetch types: ${response.status} ${response.statusText}`,
      }
    }

    const rawData = await response.json()

    // The API returns an array of type definitions
    const types: TypeSummary[] = (Array.isArray(rawData) ? rawData : []).map((item: Record<string, unknown>) => ({
      id: item.id as number,
      name: item.name as string,
      description: item.description as string | undefined,
      boKey: item.boKey as string,
      instancesCount: item.instancesCount as number | undefined,
    }))

    // Sort alphabetically by name for easier browsing
    types.sort((a, b) => a.name.localeCompare(b.name))

    return {
      success: true,
      data: types,
    }
  } catch (error) {
    if (error instanceof Error && error.message === "SESSION_EXPIRED") {
      return { success: false, error: "SESSION_EXPIRED" }
    }
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error fetching types",
    }
  }
}

/**
 * Fetches detailed type information including attributes and relationships.
 * Used to understand what fields can be queried/filtered for a given type.
 *
 * Endpoint: GET /api/v2/type/key/{typeName}
 *
 * @param typeName - The boKey of the type (e.g., "Person", "WorkflowTemplate")
 */
export async function fetchTypeDetails(typeName: string): Promise<FetchTypeDetailsResult> {
  try {
    const baseUrl = await getOneHealthBaseUrl()
    const { response } = await authFetch(`${baseUrl}/api/v2/type/key/${encodeURIComponent(typeName)}`, {
      method: "GET",
    })

    if (!response.ok) {
      return {
        success: false,
        error: `Failed to fetch type details for ${typeName}: ${response.status} ${response.statusText}`,
      }
    }

    const rawData = await response.json()

    // The API returns an array with a single type definition
    const rawType = Array.isArray(rawData) ? rawData[0] : rawData

    if (!rawType) {
      return {
        success: false,
        error: `No type definition found for ${typeName}`,
      }
    }

    // Parse attributes
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

    // Parse relationships
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

    return {
      success: true,
      data: typeDefinition,
    }
  } catch (error) {
    if (error instanceof Error && error.message === "SESSION_EXPIRED") {
      return { success: false, error: "SESSION_EXPIRED" }
    }
    return {
      success: false,
      error: error instanceof Error ? error.message : `Unknown error fetching type details for ${typeName}`,
    }
  }
}
