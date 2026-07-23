/**
 * =============================================================================
 * 1health API — workflow template hierarchy (the "definition" side)
 * =============================================================================
 *
 * Resolves the template chain that sits behind a campaign:
 *
 *   Campaign ──▶ WorkflowTemplateGroup (draft / published)
 *            └──▶ WorkflowTemplate (rootNodes: the step-tree definition)
 *                 └──▶ Step definition ──▶ Step configuration (field schema)
 *
 * You need this when you must know a step's field schema (labels, types,
 * options, and the per-environment `fieldIdentifier` GUIDs) BEFORE you have a
 * running journey — e.g. to pre-validate input or resolve field GUIDs by label.
 * If you already have a journey + step id, `journey-step.fetchStepInfo` returns
 * the same field schema plus current values, and is simpler.
 *
 * There is NO "list campaigns/templates" endpoint — campaign ids come from
 * out-of-band tenant config (see docs/api/WORKFLOWS.md § Discovering campaigns).
 * =============================================================================
 */

import { callApi, type ApiResponse } from "./client"
import { endpoints } from "./config"
import type { DynamicField, StepConfiguration, ResolvedTemplate } from "./types"

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
 * Walk campaign → group → template in one call. Prefer published, fall back to
 * draft. Returns all resolved ids so you can cache them.
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
