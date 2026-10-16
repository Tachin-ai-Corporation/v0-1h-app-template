/**
 * =============================================================================
 * 1health API — custom data (`POST /api/v2/data/custom-data/bulk`)
 * =============================================================================
 *
 * `customData` is a schemaless JSON blob on any instance (journey, organization,
 * person, …). This module reads it (via the generic query engine) and patches it
 * (via the bulk endpoint).
 *
 * Two write modes:
 *   - APPEND  — SHALLOW (top-level-only) merge. Top-level keys you omit are kept,
 *               but any key you DO send has its whole value replaced — nested
 *               objects are NOT deep-merged. Great for flat/top-level fields.
 *   - REPLACE — overwrites the whole blob.
 *
 * ⚠️ Because APPEND is shallow, a partial write under a NESTED / namespaced key
 * (e.g. `appData.<appId>`) replaces that entire subtree — silently wiping its
 * sibling keys (and other apps' namespaces). To update one nested field, read →
 * deep-merge client-side → write the complete subtree: `mergeCustomData` does
 * exactly that. See docs/api/GOTCHAS.md § Custom data writes.
 *
 * There is NO delete verb. To remove a key you read the blob, drop the key
 * client-side, and REPLACE — `deleteCustomDataKeys` does exactly that.
 *
 * ⚠️ Every read → modify → write must ABORT when the read fails. A write built
 * on an empty "nothing read" base wipes the data you meant to keep (APPEND drops
 * the subtree's siblings; REPLACE drops everything). `mergeCustomData` and
 * `deleteCustomDataKeys` read with `fetchCustomData` and write nothing unless
 * the instance was actually read. Do the same in your own read-modify-writes.
 *
 * Convention: namespace anything YOUR app owns under `appData.<appId>` so
 * multiple apps sharing an instance don't collide — but pair it with
 * `mergeCustomData` (not raw APPEND) for partial updates (`appData` helper).
 *
 * See docs/api/CUSTOM-DATA.md.
 * =============================================================================
 */

import { callApi, ok, type ApiResponse } from "./client"
import { endpoints } from "./config"
import type { CustomDataOperation, CustomDataUpdate } from "./types"
import { runQuery, findAttr, parseCustomData, eq } from "./query"

/** Low-level bulk patch. Accepts one or many updates. */
export async function updateCustomData(
  updates: CustomDataUpdate | CustomDataUpdate[],
): Promise<ApiResponse<unknown>> {
  const body = Array.isArray(updates) ? updates : [updates]
  return callApi("customData/updateCustomData", endpoints.customDataBulk(), {
    method: "POST",
    body: JSON.stringify(body),
  })
}

/**
 * Shallow (top-level) merge into an instance's `customData`: top-level keys you
 * omit are kept, but each key you send has its whole value replaced — nested
 * objects are NOT deep-merged. Safe for flat top-level fields; for nested or
 * `appData.<appId>`-namespaced updates use `mergeCustomData`. See GOTCHAS.
 */
export async function appendCustomData(
  instanceId: number,
  customData: Record<string, unknown>,
): Promise<ApiResponse<unknown>> {
  return updateCustomData({ instanceId, customData, operation: "APPEND" })
}

/** Overwrite an instance's entire `customData` blob. */
export async function replaceCustomData(
  instanceId: number,
  customData: Record<string, unknown>,
): Promise<ApiResponse<unknown>> {
  return updateCustomData({ instanceId, customData, operation: "REPLACE" })
}

/**
 * Read an instance's `customData` via the generic query engine, reporting
 * failure instead of hiding it. `type` is the data-object-type key (e.g.
 * "Organization").
 *
 *   - `success: true`  — the instance was read; `data` is its blob (`{}` when it
 *                        has no customData yet).
 *   - `success: false` — the query failed (network, expired session, gateway
 *                        refusal), or the instance didn't come back (not found,
 *                        or not readable by this caller).
 *
 * Use this before any read → modify → write, and write nothing on failure.
 */
export async function fetchCustomData(
  type: string,
  instanceId: number,
): Promise<ApiResponse<Record<string, unknown>>> {
  const res = await runQuery({
    key: type,
    attributes: ["id", "customData"],
    filter: eq("id", instanceId),
    limit: 1,
  })
  const rows = res.success ? res.data?.data : undefined
  if (!Array.isArray(rows)) {
    return { success: false, error: res.error ?? `Could not read customData of ${type} ${instanceId}`, statusCode: res.statusCode }
  }
  if (rows.length === 0) {
    return { success: false, error: `${type} ${instanceId} not found (or not readable)`, statusCode: res.statusCode }
  }
  return ok(parseCustomData(findAttr(rows[0], "customData")), res.statusCode)
}

/**
 * Read an instance's `customData` for DISPLAY. Returns `{}` if not found or on
 * error — so never write back what it returns; a failed read looks like an
 * empty blob. For read → modify → write use `fetchCustomData`, or
 * `mergeCustomData` / `deleteCustomDataKeys`.
 */
export async function readCustomData(
  type: string,
  instanceId: number,
): Promise<Record<string, unknown>> {
  const res = await fetchCustomData(type, instanceId)
  return res.success && res.data ? res.data : {}
}

/** True for a mergeable plain object (not null, not an array). */
function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v)
}

/** Recursively merge plain objects; arrays and scalars from `patch` replace `base`. */
function deepMerge(base: unknown, patch: unknown): unknown {
  if (!isPlainObject(base) || !isPlainObject(patch)) return patch
  const out: Record<string, unknown> = { ...base }
  for (const key of Object.keys(patch)) out[key] = deepMerge(base[key], patch[key])
  return out
}

/**
 * Safely update NESTED / namespaced `customData`. APPEND only shallow-merges (see
 * the module header), so a raw partial `appendCustomData` under a shared top-level
 * key like `appData.<appId>` would replace that whole subtree. This reads the
 * current blob, deep-merges your payload into it CLIENT-SIDE, then APPENDs only the
 * merged top-level keys — so nested siblings survive and unrelated top-level keys
 * are left untouched (also safe against a concurrent writer of a *different*
 * top-level key).
 *
 * `type` is the owning object-type key (e.g. "Organization"), needed to read.
 * If that read fails, nothing is written and the read's error is returned —
 * merging onto an empty base would wipe the subtree's existing siblings.
 *
 * @example
 *   await mergeCustomData("Organization", orgId, appData(appId, { phase: "x" }))
 *   // sets appData.<appId>.phase, keeps appData.<appId>.index and other apps' data
 */
export async function mergeCustomData(
  type: string,
  instanceId: number,
  data: Record<string, unknown>,
): Promise<ApiResponse<unknown>> {
  const read = await fetchCustomData(type, instanceId)
  if (!read.success || !read.data) return read
  const current = read.data
  const merged: Record<string, unknown> = {}
  for (const key of Object.keys(data)) merged[key] = deepMerge(current[key], data[key])
  return appendCustomData(instanceId, merged)
}

/**
 * Remove top-level keys from an instance's `customData` (read → drop → REPLACE).
 * Demonstrates the delete-by-omission pattern; extend for nested paths as needed.
 * If the read fails, nothing is written and the read's error is returned — a
 * REPLACE built on an empty base would erase the whole blob.
 */
export async function deleteCustomDataKeys(
  type: string,
  instanceId: number,
  keys: string[],
): Promise<ApiResponse<unknown>> {
  const read = await fetchCustomData(type, instanceId)
  if (!read.success || !read.data) return read
  const current = read.data
  for (const key of keys) delete current[key]
  return replaceCustomData(instanceId, current)
}

/**
 * Wrap a payload under `appData.<appId>` so it's namespaced to your app.
 *
 * ⚠️ For PARTIAL updates, pair with `mergeCustomData`, NOT `appendCustomData`:
 * APPEND is a top-level-only merge, so `appendCustomData(id, appData(...))`
 * replaces the ENTIRE `appData` subtree — wiping other apps' namespaces AND your
 * own sibling keys. `mergeCustomData` deep-merges client-side first.
 *
 * @example
 *   await mergeCustomData("Organization", orgId, appData(appId, { phase: "x" }))
 *   // => customData.appData["<appId>"].phase, siblings preserved
 */
export function appData(appId: string, data: Record<string, unknown>): Record<string, unknown> {
  return { appData: { [appId]: data } }
}

export type { CustomDataOperation, CustomDataUpdate }
