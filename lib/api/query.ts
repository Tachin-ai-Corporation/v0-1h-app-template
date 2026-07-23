/**
 * =============================================================================
 * 1health API — generic entity query (`POST /api/v2/query`)
 * =============================================================================
 *
 * The platform's flexible read engine: fetch any data-object-type by its string
 * `key`, project specific `attributes`, filter with RSQL, and eager-load related
 * entities via recursive `relationships`. Use this for "give me entity X (and
 * its related Y)" reads. For replicating a server-defined table/grid, use
 * `grid.ts` instead.
 *
 * Response quirk you MUST handle (helpers below do it for you):
 *   - root attributes come back prefixed  `ROOT.<Type>.<attr>`
 *   - related attributes come back prefixed `<Edge>.<Target>.<attr>`
 *     (the leading source-type segment is dropped)
 *
 * See docs/api/QUERY.md for the full walkthrough.
 * =============================================================================
 */

import { callApi, type ApiResponse } from "./client"
import { endpoints } from "./config"
import type { QueryRequest, QueryResponse, QueryResponseRow, QueryRelatedInstance } from "./types"

// ============================================================================
// RSQL filter builders
// ============================================================================
//
// RSQL/FIQL grammar the platform accepts. Combine clauses with `and` (`;`) and
// `or` (`,`). WHICH operators are valid depends on the attribute's type — use
// `operatorsForType` from schema.ts to drive a type-aware filter UI. Prefer
// these builders over hand-writing strings so quoting stays correct.

/** Quote a value for RSQL: numbers bare, strings single-quoted. */
function rsqlValue(value: string | number): string {
  return typeof value === "number" ? String(value) : `'${value}'`
}

// --- equality & comparison --------------------------------------------------
/** `attr==value` */
export function eq(attr: string, value: string | number): string { return `${attr}==${rsqlValue(value)}` }
/** `attr!=value` */
export function neq(attr: string, value: string | number): string { return `${attr}!=${rsqlValue(value)}` }
/** `attr=gt=value` (greater than) */
export function gt(attr: string, value: string | number): string { return `${attr}=gt=${rsqlValue(value)}` }
/** `attr=ge=value` (greater than or equal) */
export function ge(attr: string, value: string | number): string { return `${attr}=ge=${rsqlValue(value)}` }
/** `attr=lt=value` (less than) */
export function lt(attr: string, value: string | number): string { return `${attr}=lt=${rsqlValue(value)}` }
/** `attr=le=value` (less than or equal) */
export function le(attr: string, value: string | number): string { return `${attr}=le=${rsqlValue(value)}` }
/** Inclusive range: `attr=ge=start;attr=le=end`. Ideal for date ranges. */
export function range(attr: string, start: string | number, end: string | number): string {
  return `${ge(attr, start)};${le(attr, end)}`
}
/** Membership: `attr=in=(a,b,c)` */
export function inList(attr: string, values: Array<string | number>): string {
  return `${attr}=in=(${values.map(rsqlValue).join(",")})`
}

// --- text -------------------------------------------------------------------
/** Case-insensitive contains: `attr=ilike='*term*'` */
export function ilike(attr: string, term: string): string { return `${attr}=ilike='*${term}*'` }
/** Substring contains (case-sensitive): `attr=c=value` */
export function contains(attr: string, value: string): string { return `${attr}=c=${rsqlValue(value)}` }
/** Substring contains (ignore case): `attr=ic=value` */
export function containsI(attr: string, value: string): string { return `${attr}=ic=${rsqlValue(value)}` }
/** Does not contain: `attr=nc=value` */
export function notContains(attr: string, value: string): string { return `${attr}=nc=${rsqlValue(value)}` }
/** SQL-style pattern match: `attr=like=pattern` (use `%`/`*` wildcards) */
export function like(attr: string, pattern: string): string { return `${attr}=like=${rsqlValue(pattern)}` }
/** Regex: `attr=re=pattern` */
export function re(attr: string, pattern: string): string { return `${attr}=re=${rsqlValue(pattern)}` }
/** Negated regex: `attr=nre=pattern` */
export function nre(attr: string, pattern: string): string { return `${attr}=nre=${rsqlValue(pattern)}` }

// --- JSON / JSONB -----------------------------------------------------------
/** JSON containment: `attr=c='<json>'` (pass a JSON string) */
export function jsonContains(attr: string, json: string): string { return `${attr}=c='${json}'` }
/** Has key: `attr=hk='key'` */
export function hasKey(attr: string, key: string): string { return `${attr}=hk='${key}'` }
/** Has any of keys: `attr=hak=(k1,k2)` */
export function hasAnyKey(attr: string, keys: string[]): string { return `${attr}=hak=(${keys.join(",")})` }
/** Has all keys: `attr=haak=(k1,k2)` */
export function hasAllKeys(attr: string, keys: string[]): string { return `${attr}=haak=(${keys.join(",")})` }
/** JSONPath exists: `attr=jpe='path'` */
export function pathExists(attr: string, path: string): string { return `${attr}=jpe='${path}'` }
/** JSONPath matches: `attr=jpm='expr'` */
export function pathMatches(attr: string, expr: string): string { return `${attr}=jpm='${expr}'` }

// --- combinators ------------------------------------------------------------
/** Logical AND — joins clauses with `;` (FIQL AND). */
export function and(...conditions: string[]): string {
  return conditions.filter(Boolean).join(";")
}
/** Logical OR — joins clauses with `,` (FIQL OR), parenthesized when >1. */
export function or(...conditions: string[]): string {
  const parts = conditions.filter(Boolean)
  return parts.length > 1 ? `(${parts.join(",")})` : (parts[0] ?? "")
}

/**
 * Generic single-clause builder driven by a runtime operator string (e.g. one
 * chosen from `operatorsForType`). Handles the operators with special
 * serialization (`range`, `=in=`, key-list and JSONPath operators); everything
 * else is `attr<op><value>`. This bridges schema discovery → a query filter.
 */
export function buildFilter(
  attrKey: string,
  operator: string,
  value: string | number,
  valueEnd?: string | number,
): string {
  switch (operator) {
    case "range":
      return `${attrKey}=ge=${rsqlValue(value)};${attrKey}=le=${rsqlValue(valueEnd ?? "")}`
    case "=in=":
      return `${attrKey}=in=(${String(value).split(",").map((v) => rsqlValue(v.trim())).join(",")})`
    case "=hak=":
    case "=haak=":
      return `${attrKey}${operator}(${String(value).split(",").map((k) => k.trim()).join(",")})`
    case "=hk=":
    case "=jpe=":
    case "=jpm=":
      return `${attrKey}${operator}'${value}'`
    default:
      return `${attrKey}${operator}${rsqlValue(value)}`
  }
}

// ============================================================================
// Query execution
// ============================================================================

/**
 * Run a `/api/v2/query`. Returns the full envelope (`{ data, ...pagination }`).
 *
 * @example
 * const res = await runQuery({
 *   key: "Person",
 *   attributes: ["id", "firstName", "customData"],
 *   filter: eq("id", personId),
 *   limit: 1,
 * })
 */
export async function runQuery(request: QueryRequest): Promise<ApiResponse<QueryResponse>> {
  return callApi<QueryResponse>("query/runQuery", endpoints.query(), {
    method: "POST",
    body: JSON.stringify({ limit: 50, offset: 0, ...request }),
  })
}

/** Convenience: run a query and return just the rows array (empty on failure). */
export async function runQueryRows(request: QueryRequest): Promise<QueryResponseRow[]> {
  const res = await runQuery(request)
  return res.success && res.data ? res.data.data : []
}

/**
 * Fetch ALL pages of a query by looping `offset` until a short page is returned.
 * `/api/v2/query` exposes no `lastPage` flag, so the last page is detected by
 * `rows.length < pageSize`. Guard `maxPages` prevents runaway loops.
 */
export async function runQueryAll(
  request: QueryRequest,
  pageSize = 100,
  maxPages = 100,
): Promise<QueryResponseRow[]> {
  const all: QueryResponseRow[] = []
  let offset = 0
  for (let page = 0; page < maxPages; page++) {
    const rows = await runQueryRows({ ...request, limit: pageSize, offset })
    all.push(...rows)
    if (rows.length < pageSize) break
    offset += pageSize
  }
  return all
}

// ============================================================================
// Response extraction helpers
// ============================================================================

/**
 * Read a root attribute by exact key: `row.attributes["ROOT.<Type>.<attr>"]`.
 * Use when you know the exact type name you queried.
 */
export function getRootAttr<T = unknown>(row: QueryResponseRow, type: string, attr: string): T | undefined {
  return row.attributes?.[`ROOT.${type}.${attr}`] as T | undefined
}

/**
 * Read a root attribute by suffix, ignoring the prefix
 * (`Object.entries(...).find(k => k.endsWith("." + attr))`). Robust when the
 * exact prefix is awkward to predict — the recommended default.
 */
export function findAttr<T = unknown>(row: QueryResponseRow, attr: string): T | undefined {
  const entry = Object.entries(row.attributes ?? {}).find(([k]) => k.endsWith(`.${attr}`))
  return entry?.[1] as T | undefined
}

/** Get the related-instance wrappers for a relationship key (empty if none). */
export function getRelated(row: QueryResponseRow, relationshipKey: string): QueryRelatedInstance[] {
  return row.relationships?.[relationshipKey] ?? []
}

/**
 * Read an attribute off a related instance:
 * `wrapper.instance.attributes["<Edge>.<Target>.<attr>"]`.
 * Remember the leading source-type segment is dropped in the response.
 */
export function getRelatedAttr<T = unknown>(
  wrapper: QueryRelatedInstance,
  edge: string,
  target: string,
  attr: string,
): T | undefined {
  return wrapper.instance?.attributes?.[`${edge}.${target}.${attr}`] as T | undefined
}

/**
 * `customData` sometimes arrives as a JSON string instead of an object — parse
 * defensively. Returns `{}` if unparseable/empty.
 */
export function parseCustomData(value: unknown): Record<string, unknown> {
  if (!value) return {}
  if (typeof value === "object") return value as Record<string, unknown>
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as Record<string, unknown>
    } catch {
      return {}
    }
  }
  return {}
}
