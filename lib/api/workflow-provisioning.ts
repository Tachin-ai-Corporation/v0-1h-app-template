/**
 * =============================================================================
 * 1health API — workflow provisioning / self-bootstrap
 * =============================================================================
 *
 * Some apps require a specific workflow template to exist in the tenant before
 * they work. This module lets an app **provision itself on any client account**,
 * by NAME, idempotently — no hardcoded ids, no manual setup.
 *
 * Concepts:
 *   - Template GROUP   — a named definition, with `published` and/or `draft`
 *                        version pointers.
 *   - Published        — a shared/catalog template, cloneable into any tenant.
 *   - Draft            — a tenant-local copy that must be published before a
 *                        campaign can use it.
 *   - Campaign         — the running instance (see campaign.ts).
 *
 * The bootstrap flow (each step is check-then-act, so re-running is safe):
 *   1. find local group by name → if found, use it
 *   2. else find a published group by name → clone it into the tenant
 *   3. ensure the group has a published version (publish the draft if needed)
 *   4. create a campaign from the group
 *   5. activate the campaign
 *   6. (optional) share the campaign with a partner org
 *
 * See docs/api/PROVISIONING.md for the full protocol and the two "which
 * campaign" strategies (bootstrap-by-name vs. cache ids in customData).
 * =============================================================================
 */

import { callApi, ok, type ApiResponse } from "./client"
import { endpoints } from "./config"
import type { TemplateGroupDetail, BootstrapProgress, BootstrapResult, CreateCampaignInput } from "./types"
import { createCampaign, activateCampaign, shareCampaignWithPartner, findCampaignByName } from "./campaign"

// ============================================================================
// Template group lookup / clone / publish
// ============================================================================

/** Find a LOCAL template group by name. Returns its id, or null if absent. */
export async function findTemplateGroupByName(name: string): Promise<ApiResponse<number | null>> {
  const res = await callApi<{ data?: { id: number }[] }>(
    "provisioning/findTemplateGroupByName",
    endpoints.templateGroupList(name),
  )
  if (!res.success) return res as ApiResponse<number | null>
  return ok(res.data?.data?.[0]?.id ?? null)
}

/** Find a PUBLISHED (shared/catalog) template group by name, for cloning. */
export async function findPublishedTemplateByName(name: string): Promise<ApiResponse<number | null>> {
  const res = await callApi<{ data?: { id: number }[] }>(
    "provisioning/findPublishedTemplateByName",
    endpoints.publishedTemplateGroupList(name),
  )
  if (!res.success) return res as ApiResponse<number | null>
  return ok(res.data?.data?.[0]?.id ?? null)
}

/** Clone a published template group into the current tenant. Returns new group id. */
export async function cloneTemplateGroup(publishedId: number): Promise<ApiResponse<number>> {
  const res = await callApi<{ id: number }>(
    "provisioning/cloneTemplateGroup",
    endpoints.templateGroupClone(publishedId),
    { method: "POST" },
  )
  if (!res.success || !res.data) {
    return { success: false, error: res.error ?? "Clone failed", statusCode: res.statusCode }
  }
  return ok(res.data.id)
}

/** Get a template group's detail — including its `published`/`draft` pointers. */
export async function getTemplateGroupDetail(groupId: number): Promise<ApiResponse<TemplateGroupDetail>> {
  return callApi<TemplateGroupDetail>("provisioning/getTemplateGroupDetail", endpoints.workflowTemplateGroup(groupId))
}

interface RawNode {
  id: number | string
  nodeId: number | string
  availableStepId: number
  name: string
  type: string
  metadata: Record<string, unknown>
  node?: RawNode
  [key: string]: unknown
}

/**
 * The publish endpoint wants only a minimal node shape, but the draft GET
 * returns a rich one — strip each node (recursively) to the publishable fields.
 * `id`/`nodeId` are coerced to strings as the API expects.
 */
function cleanNode(raw: RawNode): Record<string, unknown> {
  const cleaned: Record<string, unknown> = {
    id: String(raw.id),
    nodeId: String(raw.nodeId),
    availableStepId: raw.availableStepId,
    name: raw.name,
    type: raw.type,
    metadata: raw.metadata,
  }
  if (raw.node) cleaned.node = cleanNode(raw.node)
  return cleaned
}

/** Read a draft template's node config, cleaned for re-publishing. */
export async function getDraftTemplateConfig(
  draftId: number,
): Promise<ApiResponse<{ rootNodes: Record<string, unknown>[]; stickyNotes: unknown[] }>> {
  const res = await callApi<{ rootNodes?: RawNode[]; stickyNotes?: unknown[] }>(
    "provisioning/getDraftTemplateConfig",
    endpoints.workflowTemplate(draftId),
  )
  if (!res.success || !res.data) return res as ApiResponse<{ rootNodes: Record<string, unknown>[]; stickyNotes: unknown[] }>
  return ok({
    rootNodes: (res.data.rootNodes ?? []).map(cleanNode),
    stickyNotes: res.data.stickyNotes ?? [],
  })
}

/** Publish a draft version (with its node payload). */
export async function publishDraftTemplate(
  draftId: number,
  payload: { rootNodes: Record<string, unknown>[]; stickyNotes: unknown[] },
): Promise<ApiResponse<unknown>> {
  return callApi("provisioning/publishDraftTemplate", endpoints.publishTemplate(draftId), {
    method: "PUT",
    body: JSON.stringify(payload),
  })
}

/**
 * Ensure a template group has a published version. If it only has a draft,
 * read + clean its config and publish it. No-op if already published.
 */
export async function ensurePublishedVersion(groupId: number): Promise<ApiResponse<unknown>> {
  const detail = await getTemplateGroupDetail(groupId)
  if (!detail.success || !detail.data) return detail as ApiResponse<unknown>
  if (detail.data.published) return ok(undefined)
  if (detail.data.draft) {
    const cfg = await getDraftTemplateConfig(detail.data.draft.id)
    if (!cfg.success || !cfg.data) return cfg as ApiResponse<unknown>
    return publishDraftTemplate(detail.data.draft.id, cfg.data)
  }
  return { success: false, error: "Template group has neither a published nor a draft version" }
}

/**
 * Idempotently ensure a published template group exists locally for `name`:
 * find it, or clone the catalog version, then ensure it's published. Returns
 * the local group id.
 */
export async function ensureTemplateGroup(name: string): Promise<ApiResponse<number>> {
  const local = await findTemplateGroupByName(name)
  if (!local.success) return local as ApiResponse<number>

  let groupId = local.data ?? undefined
  if (!groupId) {
    const published = await findPublishedTemplateByName(name)
    if (!published.success) return published as ApiResponse<number>
    if (published.data == null) {
      return { success: false, error: `No published template group named "${name}" available to clone` }
    }
    const cloned = await cloneTemplateGroup(published.data)
    if (!cloned.success || cloned.data == null) return cloned as ApiResponse<number>
    groupId = cloned.data
  }

  const pub = await ensurePublishedVersion(groupId)
  if (!pub.success) return pub as ApiResponse<number>
  return ok(groupId)
}

// ============================================================================
// The bootstrap orchestrator
// ============================================================================

export interface EnsureWorkflowOptions {
  /** Template group name to find/clone (e.g. your app's template name). */
  templateName: string
  /** Name for the campaign to create (or reuse). */
  campaignName: string
  /** If true, reuse an existing campaign with the same name instead of creating. */
  reuseExistingCampaign?: boolean
  /** Extra campaign fields (description, labelTagIds, startDate, …). */
  campaign?: Partial<Omit<CreateCampaignInput, "name" | "workflowTemplateGroupId">>
  /** Optionally share the campaign with a partner org. */
  share?: { partnerOrgId: number; shareAccess?: string }
  /** Progress callback for UI feedback across the multi-step flow. */
  onProgress?: (progress: BootstrapProgress) => void
}

/**
 * Ensure the whole workflow exists and return a usable campaign id: provision
 * the template group (find/clone/publish), then create + activate + (optionally)
 * share a campaign. Idempotent for the template group; campaign creation is only
 * idempotent when `reuseExistingCampaign` is set.
 *
 * @example
 * const res = await ensureWorkflow({
 *   templateName: "myapp",
 *   campaignName: `MyApp – ${partnerName}`,
 *   reuseExistingCampaign: true,
 *   share: { partnerOrgId },
 *   onProgress: (p) => setStatus(p.message),
 * })
 * if (res.success) startJourney(res.campaignId!)
 */
export async function ensureWorkflow(opts: EnsureWorkflowOptions): Promise<BootstrapResult> {
  const report = (step: BootstrapProgress["step"], message: string) => opts.onProgress?.({ step, message })
  try {
    report("finding", "Checking workflow template…")
    const tg = await ensureTemplateGroup(opts.templateName)
    if (!tg.success || tg.data == null) {
      report("error", tg.error ?? "Failed to provision template")
      return { success: false, error: tg.error }
    }
    const workflowTemplateGroupId = tg.data

    if (opts.reuseExistingCampaign) {
      const existing = await findCampaignByName(opts.campaignName)
      if (existing.success && existing.data) {
        report("done", "Using existing campaign.")
        return { success: true, campaignId: existing.data.id, workflowTemplateGroupId, reusedExisting: true }
      }
    }

    report("creating", "Creating campaign…")
    const created = await createCampaign({ ...opts.campaign, name: opts.campaignName, workflowTemplateGroupId })
    if (!created.success || !created.data) {
      report("error", created.error ?? "Failed to create campaign")
      return { success: false, error: created.error, workflowTemplateGroupId }
    }
    const campaignId = created.data.id

    report("activating", "Activating campaign…")
    const activated = await activateCampaign(campaignId)
    if (!activated.success) {
      report("error", activated.error ?? "Failed to activate campaign")
      return { success: false, error: activated.error, campaignId, workflowTemplateGroupId }
    }

    if (opts.share) {
      report("sharing", "Sharing with partner…")
      const shared = await shareCampaignWithPartner(campaignId, opts.share.partnerOrgId, opts.share.shareAccess)
      if (!shared.success) {
        report("error", shared.error ?? "Failed to share campaign")
        return { success: false, error: shared.error, campaignId, workflowTemplateGroupId }
      }
    }

    report("done", "Workflow ready.")
    return { success: true, campaignId, workflowTemplateGroupId }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Bootstrap failed"
    report("error", message)
    return { success: false, error: message }
  }
}
