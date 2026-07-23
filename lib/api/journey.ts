/**
 * =============================================================================
 * 1health API — journeys (workflow INSTANCES)
 * =============================================================================
 *
 * A journey is a running instance of a workflow template, started from a
 * campaign. In the generic query engine a journey is typed `"WorkflowTemplate"`
 * (same type name as the definition) — distinguish by context, not type name.
 *
 * URL Patterns:
 *   POST /api/v2/journey                      - create/start a journey
 *   GET  /api/v2/journey/{id}                 - fetch one journey (may be array!)
 *   POST /api/v3/health/grid/journey          - list/filter journeys (see grid.ts)
 *   PUT  /api/v2/journey/status/bulk          - bulk status change
 *   POST /api/v2/journey/assign-users         - assign coordinators (array body!)
 *   POST /api/v2/journey/unassign-users       - unassign
 *
 * See docs/api/WORKFLOWS.md.
 * =============================================================================
 */

import { callApi, type ApiResponse } from "./client"
import { endpoints } from "./config"
import { runGridQuery, type GridPageOptions } from "./grid"
import type { CreatedJourney, SeedStep, PaginatedResponse } from "./types"

/** Loosely-typed journey detail; shape is app-specific, cast as needed. */
export type JourneyDetail = Record<string, unknown>

/**
 * Create/start a journey from a campaign. Optionally seed+submit the first
 * step(s) inline via `submitSteps` (each `{ key: stepName, data: {...} }`) to
 * avoid a create→fetch→submit round trip.
 */
export async function createJourney(
  campaignId: number,
  submitSteps?: SeedStep[],
): Promise<ApiResponse<CreatedJourney>> {
  const body = submitSteps ? { campaignId, submitSteps } : { campaignId }
  return callApi<CreatedJourney>("journey/createJourney", endpoints.journeyCreate(), {
    method: "POST",
    body: JSON.stringify(body),
  })
}

/**
 * Fetch a single journey's full detail. The endpoint sometimes returns an array
 * and sometimes a bare object — this unwraps to a single object either way.
 */
export async function fetchJourney(journeyId: number): Promise<ApiResponse<JourneyDetail>> {
  const res = await callApi<JourneyDetail | JourneyDetail[]>(
    "journey/fetchJourney",
    endpoints.journey(journeyId),
  )
  if (!res.success) return res as ApiResponse<JourneyDetail>
  const data = Array.isArray(res.data) ? res.data[0] : res.data
  return { success: true, data: data ?? {}, statusCode: res.statusCode }
}

/**
 * List journeys via the grid view (pre-flattened rows). Pass your own row type.
 * Scope by campaign or any other field through `filterBy`.
 *
 * @example
 * const res = await listJourneys<MyRow>({
 *   filterBy: [{ key: "workflowCampaignId", value: campaignId, operator: "equals" }],
 *   page: 0, size: 50,
 * })
 */
export async function listJourneys<T = Record<string, unknown>>(
  options: GridPageOptions = {},
): Promise<ApiResponse<PaginatedResponse<T>>> {
  return runGridQuery<T>("journey", options)
}

/** Bulk-change journey status. Status strings are app/config defined. */
export async function updateJourneyStatus(
  journeyIds: number[],
  status: string,
): Promise<ApiResponse<unknown>> {
  return callApi("journey/updateJourneyStatus", endpoints.journeyStatusBulk(), {
    method: "PUT",
    body: JSON.stringify({ journeyIds, status }),
  })
}

/** Assign users (coordinators) to journeys. Note: the body is an ARRAY. */
export async function assignUsersToJourneys(
  journeyIds: number[],
  userIds: number[],
): Promise<ApiResponse<unknown>> {
  return callApi("journey/assignUsersToJourneys", endpoints.journeyAssignUsers(), {
    method: "POST",
    body: JSON.stringify([{ journeyIds, userIds }]),
  })
}

/** Remove users from journeys. Same array-wrapped body as assign. */
export async function unassignUsersFromJourneys(
  journeyIds: number[],
  userIds: number[],
): Promise<ApiResponse<unknown>> {
  return callApi("journey/unassignUsersFromJourneys", endpoints.journeyUnassignUsers(), {
    method: "POST",
    body: JSON.stringify([{ journeyIds, userIds }]),
  })
}
