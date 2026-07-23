/**
 * =============================================================================
 * 1health API — campaign lifecycle
 * =============================================================================
 *
 * A campaign is a template group's running instance at the tenant level — the
 * thing users' journeys attach to. This module creates, activates, shares, and
 * lists campaigns. For the full self-bootstrap flow (provision the template
 * group first, then create+activate+share a campaign), see
 * `workflow-provisioning.ts` and docs/api/PROVISIONING.md.
 *
 * URL Patterns:
 *   POST /api/v2/health/workflow-campaign                 - create
 *   POST /api/v2/health/workflow-campaign/{id}/run        - activate
 *   POST /api/v2/health/workflow-campaign/{id}/share      - share with partners
 *   GET  /api/v2/health/workflow-campaign/{id}            - fetch one
 *   POST /api/v3/health/grid/workflow-campaign            - list (grid)
 * =============================================================================
 */

import { callApi, type ApiResponse } from "./client"
import { endpoints } from "./config"
import { runGridQuery, type GridPageOptions } from "./grid"
import type { Campaign, CreateCampaignInput, ShareTarget, PaginatedResponse } from "./types"

/** ISO timestamp with milliseconds zeroed (the format the API expects). */
function isoStartDate(date = new Date()): string {
  return date.toISOString().replace(/\.\d{3}Z$/, ".000Z")
}

/** Create a campaign from a template group. Returns the new campaign id. */
export async function createCampaign(input: CreateCampaignInput): Promise<ApiResponse<{ id: number }>> {
  const body = {
    name: input.name,
    description: input.description ?? "",
    labelTagIds: input.labelTagIds ?? [],
    startDate: input.startDate ?? isoStartDate(),
    workflowTemplateGroupId: input.workflowTemplateGroupId,
    allowMultiplePatientJourneys: input.allowMultiplePatientJourneys ?? false,
  }
  return callApi<{ id: number }>("campaign/createCampaign", endpoints.campaignCreate(), {
    method: "POST",
    body: JSON.stringify(body),
  })
}

/** Activate ("run") a campaign so it can accept journeys. Required after create. */
export async function activateCampaign(campaignId: number, batchSize = 33): Promise<ApiResponse<unknown>> {
  return callApi("campaign/activateCampaign", endpoints.campaignRun(campaignId, batchSize), {
    method: "POST",
    body: JSON.stringify({}),
  })
}

/** Share a campaign with one or more targets (raw form). */
export async function shareCampaign(campaignId: number, targets: ShareTarget[]): Promise<ApiResponse<unknown>> {
  return callApi("campaign/shareCampaign", endpoints.campaignShare(campaignId), {
    method: "POST",
    body: JSON.stringify(targets),
  })
}

/** Share a campaign with a single partner organization (the common case). */
export async function shareCampaignWithPartner(
  campaignId: number,
  partnerOrgId: number,
  shareAccess = "Read",
): Promise<ApiResponse<unknown>> {
  return shareCampaign(campaignId, [
    { targetAccessEntity: "Partner Organization", targetEntityId: partnerOrgId, shareAccess },
  ])
}

/** Fetch a single campaign by id. */
export async function fetchCampaign(campaignId: number): Promise<ApiResponse<Campaign>> {
  return callApi<Campaign>("campaign/fetchCampaign", endpoints.workflowCampaign(campaignId))
}

/**
 * List campaigns via the grid view (pre-flattened rows). Scope with `filterBy`
 * (e.g. `workflowTemplateGroupName contains "MyApp"`).
 */
export async function listCampaigns<T = Campaign>(
  options: GridPageOptions = {},
): Promise<ApiResponse<PaginatedResponse<T>>> {
  return runGridQuery<T>("workflow-campaign", options)
}

/**
 * Find a campaign by exact name (case-insensitive), optionally within extra
 * filters (e.g. scoping to your app's template group). Returns the most recently
 * updated match, or null. Use before creating to avoid duplicate campaigns —
 * campaign creation is NOT idempotent.
 */
export async function findCampaignByName(
  name: string,
  extraFilters: GridPageOptions["filterBy"] = [],
): Promise<ApiResponse<Campaign | null>> {
  const res = await listCampaigns<Campaign>({
    filterBy: [...extraFilters, { key: "name", value: name, operator: "equals" }],
    orderBy: [{ key: "updated", order: "DESC" }],
    size: 50,
  })
  if (!res.success || !res.data) {
    return { success: false, error: res.error ?? "Failed to list campaigns", statusCode: res.statusCode }
  }
  const match = res.data.data.find((c) => c.name?.toLowerCase() === name.toLowerCase()) ?? null
  return { success: true, data: match }
}
