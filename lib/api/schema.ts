/**
 * =============================================================================
 * 1health API — schema discovery (type / attribute / relationship metadata)
 * =============================================================================
 *
 * The platform IS introspectable at runtime. Two endpoints:
 *   GET /api/v2/type/all            → every data object type (summaries)
 *   GET /api/v2/type/key/{typeName} → one type's attributes + relationships
 *
 * Use this to build queries generically (no hardcoded attribute names), to power
 * a schema-aware UI, or just to look up the exact `attrKey` / `relKey` strings a
 * query needs. Hardcoding attribute keys is still fine for a fixed app — but you
 * are NOT forced to; discovery is available.
 *
 * Results are cached in-memory and duplicate in-flight requests are deduped, so
 * calling `fetchTypeDetails("Person")` repeatedly is cheap.
 *
 * See docs/api/SCHEMA-DISCOVERY.md.
 * =============================================================================
 */

import { callApi, ok, type ApiResponse } from "./client"
import { endpoints } from "./config"

// ============================================================================
// Types
// ============================================================================

/** An enum option for a VALUE_LIST attribute. */
export interface AttributeValue {
  id: number
  name: string
  description?: string
}

/** Common attribute data types. Kept open (`| string`) — new ones appear. */
export type AttributeType =
  | "TEXT"
  | "STRING"
  | "INTEGER"
  | "DECIMAL"
  | "NUMBER"
  | "BOOLEAN"
  | "DATE"
  | "DATETIME"
  | "TIMESTAMP"
  | "VALUE_LIST"
  | "JSON"
  | "JSONB"
  | (string & {})

export interface TypeAttribute {
  id: number
  name: string
  description?: string
  /** The string you put in a query's `attributes` / `filter`. */
  attrKey: string
  type: AttributeType
  isRequired?: boolean
  /** Enum options (present for VALUE_LIST attributes). */
  attributeValues?: AttributeValue[]
  defaultValue?: string
  minLength?: number
  maxLength?: number
}

export interface TypeRelationship {
  id: number
  name: string
  /** The EXACT edge segment for a relationship path — never hand-construct it. */
  relKey: string
  reverseRelKey?: string
  direction: "FORWARD" | "BACKWARDS"
  fromBoClassName: string
  toBoClassName: string
  fromBoClassId?: number
  toBoClassId?: number
  inward?: string
  outward?: string
}

export interface TypeDefinition {
  id: number
  name: string
  description?: string
  /** The type key — use this as a query's `key`. */
  boKey: string
  tableName?: string
  instancesCount?: number
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

/**
 * System attributes present on EVERY entity — not returned in a type's
 * `attributes` list, so add them yourself when building a picker.
 */
export const BASELINE_ATTRIBUTES: ReadonlyArray<{ attrKey: string; name: string; type: AttributeType }> = [
  { attrKey: "id", name: "ID", type: "STRING" },
  { attrKey: "created", name: "Created", type: "TIMESTAMP" },
  { attrKey: "updated", name: "Updated", type: "TIMESTAMP" },
]

// ============================================================================
// Cache + dedup
// ============================================================================

const typeCache = new Map<string, TypeDefinition>()
const pending = new Map<string, Promise<ApiResponse<TypeDefinition>>>()

/** Synchronously read a cached type definition (null if not yet fetched). */
export function getCachedTypeDetails(typeName: string): TypeDefinition | null {
  return typeCache.get(typeName) ?? null
}

/** Clear the type cache (e.g. to force a refresh). */
export function clearTypeCache(): void {
  typeCache.clear()
  pending.clear()
}

// ============================================================================
// API
// ============================================================================

/** List all available data object types, sorted by name. */
export async function fetchAllTypes(): Promise<ApiResponse<TypeSummary[]>> {
  const res = await callApi<unknown>("schema/fetchAllTypes", endpoints.typeAll())
  if (!res.success) return res as ApiResponse<TypeSummary[]>
  const raw = Array.isArray(res.data) ? (res.data as Record<string, unknown>[]) : []
  const types: TypeSummary[] = raw
    .map((t) => ({
      id: t.id as number,
      name: t.name as string,
      description: t.description as string | undefined,
      boKey: t.boKey as string,
      instancesCount: t.instancesCount as number | undefined,
    }))
    .sort((a, b) => a.name.localeCompare(b.name))
  return ok(types)
}

/**
 * Fetch one type's full definition (attributes + relationships), cached and
 * deduped. Deleted attributes/relationships are filtered out; both are sorted
 * by name.
 */
export async function fetchTypeDetails(typeName: string): Promise<ApiResponse<TypeDefinition>> {
  const cached = typeCache.get(typeName)
  if (cached) return ok(cached)

  const inflight = pending.get(typeName)
  if (inflight) return inflight

  const promise = (async (): Promise<ApiResponse<TypeDefinition>> => {
    const res = await callApi<unknown>("schema/fetchTypeDetails", endpoints.typeByKey(typeName))
    if (!res.success) return res as ApiResponse<TypeDefinition>

    const raw = (Array.isArray(res.data) ? res.data[0] : res.data) as Record<string, unknown> | undefined
    if (!raw) return { success: false, error: `No type definition found for ${typeName}` }

    const def = mapTypeDefinition(raw)
    typeCache.set(typeName, def)
    return ok(def)
  })().finally(() => pending.delete(typeName))

  pending.set(typeName, promise)
  return promise
}

/**
 * Prefetch several types in parallel (using the cache). Returns a
 * `Map<typeName, TypeDefinition>` of the ones that resolved.
 */
export async function prefetchTypeDetails(typeNames: string[]): Promise<Map<string, TypeDefinition>> {
  const unique = Array.from(new Set(typeNames))
  const results = await Promise.all(unique.map((name) => fetchTypeDetails(name)))
  const map = new Map<string, TypeDefinition>()
  unique.forEach((name, i) => {
    const r = results[i]
    if (r.success && r.data) map.set(name, r.data)
  })
  return map
}

// ============================================================================
// Relationship helpers
// ============================================================================

/**
 * The target type key for a relationship, honoring direction:
 * FORWARD → `toBoClassName`, BACKWARDS → `fromBoClassName` (spaces stripped).
 */
export function getRelationshipTargetType(rel: TypeRelationship): string {
  const raw = rel.direction === "FORWARD" ? rel.toBoClassName : rel.fromBoClassName
  return (raw || "").replace(/\s+/g, "")
}

/**
 * Build a relationship path `{FromType}.{relKey}.{ToType}` for a query.
 * `relKey` MUST come from the type metadata (`relationship.relKey`) — never
 * concatenate type names to fabricate it. Type names have spaces stripped.
 */
export function formatRelationshipPath(fromType: string, relKey: string, toType: string): string {
  return `${(fromType || "").replace(/\s+/g, "")}.${relKey}.${(toType || "").replace(/\s+/g, "")}`
}

/** Convenience: the full query path for a relationship, from its owning type. */
export function relationshipPath(fromType: string, rel: TypeRelationship): string {
  return formatRelationshipPath(fromType, rel.relKey, getRelationshipTargetType(rel))
}

// ============================================================================
// Which operators apply to which attribute type
// ============================================================================

/**
 * The RSQL operators that make sense for a given attribute `type`. Drives
 * type-aware filter UIs (and keeps you from sending, say, `=gt=` on a boolean).
 */
export function operatorsForType(type: AttributeType): string[] {
  if (type === "TIMESTAMP" || type === "DATE" || type === "DATETIME") {
    return ["==", "!=", "=gt=", "=ge=", "=lt=", "=le=", "range"]
  }
  if (type === "INTEGER" || type === "DECIMAL" || type === "NUMBER") {
    return ["==", "!=", "=gt=", "=ge=", "=lt=", "=le=", "=in="]
  }
  if (type === "JSON" || type === "JSONB") {
    return ["==", "!=", "=c=", "=hk=", "=hak=", "=haak=", "=jpe=", "=jpm="]
  }
  // TEXT / STRING / VALUE_LIST / BOOLEAN and anything else
  return ["==", "!=", "=c=", "=nc=", "=ic=", "=inc=", "=like=", "=ilike=", "=re=", "=nre=", "=in="]
}

// ============================================================================
// Internal
// ============================================================================

function mapTypeDefinition(raw: Record<string, unknown>): TypeDefinition {
  const rawAttrs = (raw.attributes as Record<string, unknown>[] | undefined) ?? []
  const rawRels = (raw.relationships as Record<string, unknown>[] | undefined) ?? []

  const attributes: TypeAttribute[] = rawAttrs
    .filter((a) => !a.isDeleted)
    .map((a) => ({
      id: a.id as number,
      name: a.name as string,
      description: a.description as string | undefined,
      attrKey: a.attrKey as string,
      type: a.type as AttributeType,
      isRequired: a.isRequired as boolean | undefined,
      attributeValues: ((a.attributeValues as Record<string, unknown>[] | undefined) ?? [])
        .filter((v) => !v.isDeleted)
        .map((v) => ({ id: v.id as number, name: v.name as string, description: v.description as string | undefined })),
      defaultValue: a.defaultValue as string | undefined,
      minLength: a.minLength as number | undefined,
      maxLength: a.maxLength as number | undefined,
    }))
    .sort((a, b) => a.name.localeCompare(b.name))

  const relationships: TypeRelationship[] = rawRels
    .filter((r) => !r.isDeleted)
    .map((r) => ({
      id: r.id as number,
      name: r.name as string,
      relKey: r.relKey as string,
      reverseRelKey: r.reverseRelKey as string | undefined,
      direction: r.direction as "FORWARD" | "BACKWARDS",
      fromBoClassName: r.fromBoClassName as string,
      toBoClassName: r.toBoClassName as string,
      fromBoClassId: r.fromBoClassId as number | undefined,
      toBoClassId: r.toBoClassId as number | undefined,
      inward: r.inward as string | undefined,
      outward: r.outward as string | undefined,
    }))
    .sort((a, b) => a.name.localeCompare(b.name))

  return {
    id: raw.id as number,
    name: raw.name as string,
    description: raw.description as string | undefined,
    boKey: raw.boKey as string,
    tableName: raw.tableName as string | undefined,
    instancesCount: raw.instancesCount as number | undefined,
    attributes,
    relationships,
  }
}
