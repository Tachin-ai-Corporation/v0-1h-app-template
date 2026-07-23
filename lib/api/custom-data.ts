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
 *   - APPEND  — deep-merges into existing customData (preserves sibling keys).
 *   - REPLACE — overwrites the whole blob.
 *
 * There is NO delete verb. To remove a key you read the blob, drop the key
 * client-side, and REPLACE — `deleteCustomDataKeys` does exactly that.
 *
 * Convention: namespace anything YOUR app owns under `appData.<appId>` so
 * multiple apps sharing an instance don't clobber each other (`appData` helper).
 *
 * See docs/api/CUSTOM-DATA.md.
 * =============================================================================
 */

import { callApi, type ApiResponse } from "./client"
import { endpoints } from "./config"
import type { CustomDataOperation, CustomDataUpdate } from "./types"
import { runQueryRows, findAttr, parseCustomData, eq } from "./query"

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

/** Deep-merge `customData` into an instance (preserves other keys). */
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
 * Read an instance's `customData` via the generic query engine.
 * `type` is the data-object-type key (e.g. "Organization"). Returns `{}` if not
 * found or on error.
 */
export async function readCustomData(
  type: string,
  instanceId: number,
): Promise<Record<string, unknown>> {
  const rows = await runQueryRows({
    key: type,
    attributes: ["id", "customData"],
    filter: eq("id", instanceId),
    limit: 1,
  })
  if (rows.length === 0) return {}
  return parseCustomData(findAttr(rows[0], "customData"))
}

/**
 * Remove top-level keys from an instance's `customData` (read → drop → REPLACE).
 * Demonstrates the delete-by-omission pattern; extend for nested paths as needed.
 */
export async function deleteCustomDataKeys(
  type: string,
  instanceId: number,
  keys: string[],
): Promise<ApiResponse<unknown>> {
  const current = await readCustomData(type, instanceId)
  for (const key of keys) delete current[key]
  return replaceCustomData(instanceId, current)
}

/**
 * Wrap a payload under `appData.<appId>` so it's namespaced to your app.
 * Combine with `appendCustomData` to avoid clobbering other apps' data.
 *
 * @example appendCustomData(orgId, appData(appId, { settings: {...} }))
 * // => customData.appData["<appId>"].settings
 */
export function appData(appId: string, data: Record<string, unknown>): Record<string, unknown> {
  return { appData: { [appId]: data } }
}

export type { CustomDataOperation, CustomDataUpdate }
