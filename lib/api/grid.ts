/**
 * =============================================================================
 * 1health API — grid / view query (`POST /api/v3/health/grid/<view>`)
 * =============================================================================
 *
 * The list engine for server-defined views. Rows come back PRE-FLATTENED (plain
 * field names, no `ROOT.`/edge prefixes), with a standard paginated envelope.
 * Use this to replicate a table/grid the platform already defines; use
 * `query.ts` for flexible entity+relationship reads.
 *
 * A view is almost always pre-scoped by an id — pass it as the first `filterBy`
 * entry (e.g. a campaign/list/tenant id).
 *
 * Row shape is app-specific, so it's generic here (`Record<string, unknown>` by
 * default) — pass your own row type as `T`.
 *
 * See docs/api/QUERY.md § Grid.
 * =============================================================================
 */

import { callApi, type ApiResponse } from "./client"
import { endpoints } from "./config"
import type { GridRequest, PaginatedResponse } from "./types"

export interface GridPageOptions extends GridRequest {
  page?: number
  /** Page size. Sent as both `limit` and `size` (some views want both). */
  size?: number
}

/**
 * Fetch a single page from a grid view.
 *
 * @param view  the view segment, e.g. "journey" -> POST /api/v3/health/grid/journey
 * @example
 * const res = await runGridQuery<MyRow>("journey", {
 *   filterBy: [{ key: "workflowCampaignId", value: campaignId, operator: "equals" }],
 *   orderBy: [{ key: "updated", order: "DESC" }],
 *   page: 0, size: 25,
 * })
 */
export async function runGridQuery<T = Record<string, unknown>>(
  view: string,
  options: GridPageOptions = {},
): Promise<ApiResponse<PaginatedResponse<T>>> {
  const { page = 0, size = 25, filterBy = [], orderBy = [] } = options
  const query = `?page=${page}&limit=${size}&size=${size}`
  return callApi<PaginatedResponse<T>>("grid/runGridQuery", `${endpoints.grid(view)}${query}`, {
    method: "POST",
    body: JSON.stringify({ filterBy, orderBy }),
  })
}

/**
 * Fetch ALL pages of a grid view, looping until `lastPage` (falling back to a
 * short-page check). Supports cancellation and a progress callback.
 *
 * @param onProgress called after each page with (loadedSoFar, totalElements)
 */
export async function fetchAllGridPages<T = Record<string, unknown>>(
  view: string,
  options: GridRequest & { size?: number; signal?: AbortSignal } = {},
  onProgress?: (loaded: number, total: number) => void,
): Promise<T[]> {
  const size = options.size ?? 100
  const rows: T[] = []
  let page = 0
  const maxPages = 10_000 // safety backstop

  while (page < maxPages) {
    if (options.signal?.aborted) break
    const res = await runGridQuery<T>(view, {
      filterBy: options.filterBy,
      orderBy: options.orderBy,
      page,
      size,
    })
    if (!res.success || !res.data) break

    const { data, totalElements, lastPage, numberOfElements } = res.data
    rows.push(...data)
    onProgress?.(rows.length, totalElements ?? rows.length)

    const reachedEnd =
      lastPage === true ||
      data.length < size ||
      (typeof numberOfElements === "number" && numberOfElements < size)
    if (reachedEnd) break
    page++
  }
  return rows
}
