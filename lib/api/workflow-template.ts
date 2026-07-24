/**
 * =============================================================================
 * 1health API — workflow template hierarchy (the "definition" side)
 * =============================================================================
 *
 * Resolves the template chain that sits behind a campaign. A campaign points at
 * TWO distinct templates (both on the campaign GET) — know which one you want:
 *
 *   Campaign
 *     ├─ workflowTemplateGroup.published  ─▶ DESIGN-TIME template (the tenant
 *     │                                      template you author/publish)
 *     └─ baseWorkflowTemplate ────────────▶ CAMPAIGN BASE template: a CLONE of the
 *                                            design-time one, minted for this campaign.
 *                                            NEW journeys copy from THIS.
 *   WorkflowTemplate ──▶ rootNodes (the step-tree definition, a linked list)
 *                        └─ Step definition ──▶ Step configuration (field schema)
 *
 *   - `resolveTemplate(campaignId)`        → the GROUP's published/draft template
 *                                            (design-time layer).
 *   - `resolveCampaignTemplates(campaignId)` → the CAMPAIGN BASE clone + design-time
 *                                            parent + roll-forward history.
 *
 * You need the field schema (labels, types, options, per-environment
 * `fieldIdentifier` GUIDs) BEFORE a running journey — e.g. to pre-validate input
 * or resolve field GUIDs by label. If you already have a journey + step id,
 * `journey-step.fetchStepInfo` returns the same schema plus current values.
 *
 * Campaigns and template groups ARE listable — see `campaign.listCampaigns` /
 * `endpoints.templateGroupList` and docs/api/PROVISIONING.md.
 * =============================================================================
 */

import { callApi, type ApiResponse } from "./client"
import { endpoints } from "./config"
import type {
  DynamicField,
  StepConfiguration,
  ResolvedTemplate,
  WorkflowTemplateDefinition,
  WorkflowTemplateNode,
  CampaignTemplateRefs,
  Campaign,
} from "./types"

/** GET a campaign; returns its `workflowTemplateGroup.id`. */
export async function fetchCampaignGroupId(campaignId: number): Promise<number | null> {
  const res = await callApi<{ workflowTemplateGroup?: { id?: number } }>(
    "workflowTemplate/fetchCampaignGroupId",
    endpoints.workflowCampaign(campaignId),
  )
  return res.data?.workflowTemplateGroup?.id ?? null
}

/** GET a template group; returns the published template id (falls back to draft). */
export async function fetchTemplateIdFromGroup(
  groupId: number,
): Promise<{ id: number; version: "published" | "draft" } | null> {
  const res = await callApi<{ published?: { id?: number }; draft?: { id?: number } }>(
    "workflowTemplate/fetchTemplateIdFromGroup",
    endpoints.workflowTemplateGroup(groupId),
  )
  if (res.data?.published?.id) return { id: res.data.published.id, version: "published" }
  if (res.data?.draft?.id) return { id: res.data.draft.id, version: "draft" }
  return null
}

/**
 * Walk campaign → group → template in one call, resolving the **design-time**
 * (tenant) template — the group's published version, falling back to draft. This
 * is the template you author; it is NOT the per-campaign clone journeys copy from.
 * For that, use {@link resolveCampaignTemplates}. Returns all resolved ids so you
 * can cache them.
 */
export async function resolveTemplate(campaignId: number): Promise<ApiResponse<ResolvedTemplate>> {
  try {
    const groupId = await fetchCampaignGroupId(campaignId)
    if (!groupId) return { success: false, error: `No template group for campaign ${campaignId}` }

    const template = await fetchTemplateIdFromGroup(groupId)
    if (!template) return { success: false, error: `No published/draft template in group ${groupId}` }

    return {
      success: true,
      data: {
        campaignId,
        workflowTemplateGroupId: groupId,
        workflowTemplateId: template.id,
        version: template.version,
      },
    }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "resolveTemplate failed" }
  }
}

/**
 * Read a campaign's template refs (from the campaign GET). Distinguishes the
 * CAMPAIGN BASE clone (`baseWorkflowTemplateId` — what new journeys copy from)
 * from the DESIGN-TIME template it was cloned from
 * (`designTimeWorkflowTemplateId`, == the group's published id), plus the
 * roll-forward history. Use this when you need the template a campaign's journeys
 * actually run — e.g. to read the *live* step config for THIS campaign.
 */
export async function resolveCampaignTemplates(
  campaignId: number,
): Promise<ApiResponse<CampaignTemplateRefs>> {
  const res = await callApi<Campaign>(
    "workflowTemplate/resolveCampaignTemplates",
    endpoints.workflowCampaign(campaignId),
  )
  if (!res.success || !res.data) {
    return { success: false, error: res.error ?? `Failed to fetch campaign ${campaignId}`, statusCode: res.statusCode }
  }
  const c = res.data
  return {
    success: true,
    data: {
      campaignId,
      baseWorkflowTemplateId: c.baseWorkflowTemplate?.id ?? null,
      designTimeWorkflowTemplateId:
        c.baseWorkflowTemplate?.designTimeWorkflowTemplateId ?? c.workflowTemplateGroup?.published?.id ?? null,
      workflowTemplateGroupId: c.workflowTemplateGroup?.id ?? c.workflowTemplateGroupId ?? null,
      previousBaseWorkflowTemplateIds: (c.previousBaseWorkflowTemplates ?? []).map((t) => t.id),
    },
  }
}

/** Convenience: just the CAMPAIGN BASE template id (what this campaign's journeys clone from). */
export async function fetchCampaignBaseTemplateId(campaignId: number): Promise<number | null> {
  const res = await resolveCampaignTemplates(campaignId)
  return res.data?.baseWorkflowTemplateId ?? null
}

/**
 * GET a template's full definition — its `rootNodes` step-tree. Works for any
 * template id (design-time OR campaign base). Pair with `flattenTemplateNodes`
 * to get an ordered step list, then `fetchStepConfiguration` for a step's fields.
 */
export async function fetchWorkflowTemplate(templateId: number): Promise<ApiResponse<WorkflowTemplateDefinition>> {
  return callApi<WorkflowTemplateDefinition>(
    "workflowTemplate/fetchWorkflowTemplate",
    endpoints.workflowTemplate(templateId),
  )
}

/**
 * Linearize a template's nested `rootNodes` (each node nests its successor via
 * `.node`) into a flat, ordered step list. Assumes the common single-successor
 * chain; branching/decision nodes (multiple children) aren't followed — inspect
 * `key`/`metadata.nodeType` and walk those yourself if your template branches.
 */
export function flattenTemplateNodes(
  rootNodes: WorkflowTemplateNode[] | undefined | null,
): WorkflowTemplateNode[] {
  const out: WorkflowTemplateNode[] = []
  const seen = new Set<number>()
  let cur = rootNodes?.[0]
  while (cur && !seen.has(cur.id)) {
    seen.add(cur.id)
    out.push(cur)
    cur = cur.node
  }
  return out
}

/**
 * GET a step definition's configuration (its field schema). Returned shape is a
 * `StepConfiguration` (`metadata.dynamicFields.custom.fields[]`).
 */
export async function fetchStepConfiguration(
  templateId: number,
  stepId: number,
): Promise<ApiResponse<StepConfiguration>> {
  return callApi<StepConfiguration>(
    "workflowTemplate/fetchStepConfiguration",
    endpoints.workflowTemplateStepConfig(templateId, stepId),
  )
}

// ============================================================================
// Dynamic-field helpers (shared by the template & instance sides)
// ============================================================================

/** Safely pull the dynamic fields array out of a StepConfiguration/StepInfo. */
export function getDynamicFields(config: StepConfiguration | undefined | null): DynamicField[] {
  return config?.metadata?.dynamicFields?.custom?.fields ?? []
}

/** Find a single field by its (environment-stable) label. */
export function findFieldByLabel(fields: DynamicField[], label: string): DynamicField | undefined {
  return fields.find((f) => f.label === label)
}

/**
 * Resolve a set of field labels to their per-environment `fieldIdentifier`
 * GUIDs. Pass a map of `{ localName: "Exact Label" }`; get back
 * `{ localName: fieldIdentifier | undefined }`. This is THE way to avoid
 * hardcoding GUIDs.
 *
 * @example
 * const ids = resolveFieldsByLabel(fields, { code: "Procedure Code", dos: "Date of Service" })
 * // ids.code === "cd7fe0b7-..." (resolved at runtime for the current env)
 */
export function resolveFieldsByLabel<K extends string>(
  fields: DynamicField[],
  labelMap: Record<K, string>,
): Record<K, string | undefined> {
  const out = {} as Record<K, string | undefined>
  for (const localName in labelMap) {
    out[localName] = findFieldByLabel(fields, labelMap[localName])?.fieldIdentifier
  }
  return out
}
