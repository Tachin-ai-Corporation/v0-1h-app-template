/**
 * =============================================================================
 * 1health API — step configuration (notifications & webhooks)
 * =============================================================================
 *
 * "Step subscriptions" — email notifications and webhooks — live on a workflow
 * template **step's configuration**. Editing them is the concrete way to change
 * a campaign's template config: you target the step on the campaign's base
 * template (see docs/api/PROVISIONING.md § template layers — the layer you edit
 * sets the scope).
 *
 * Read  (2 calls):
 *   1. resolveCampaignSteps(campaignId)  → { templateId, steps } via POST /query
 *   2. fetchStepConfiguration(templateId, stepId)  (in workflow-template.ts)
 *        → StepConfiguration incl. `notifications` + `webhooks`
 * Write:
 *   PUT /api/v2/health/workflow-template-step/{stepId}/configuration
 *   multipart `rawData[0].data` = a PARTIAL StepConfiguration; only the
 *   top-level keys you send are updated (send `{notifications:[…]}` OR
 *   `{webhooks:[…]}` — server preserves everything else).
 *
 * Write rule (as everywhere): round-trip the existing row (drop `id`), override
 * only what changed, and keep siblings — the backend validates required scalars
 * that you must echo back.
 * =============================================================================
 */

import { callApi, ok, type ApiResponse } from "./client"
import { endpoints } from "./config"
import { runQueryRows, eq, getRootAttr, getRelated, getRelatedAttr } from "./query"
import type { StepNotification, StepWebhook } from "./types"

/** The standard trigger phase for a "file dropped / step done" subscription. */
export const WHEN_ON_STEP_COMPLETION = "On Step Completion"
/** Recommended cap for notification recipients. */
export const MAX_NOTIFICATION_EMAILS = 5

const REL_ROOT_STEP = "WorkflowTemplate.WorkflowTemplateHasRootWorkflowTemplateStep.WorkflowTemplateStep"
const REL_CHILD_STEP = "WorkflowTemplateStep.WorkflowTemplateStepHasChildWorkflowTemplateStep.WorkflowTemplateStep"

export interface CampaignStep {
  id: number
  name: string | null
}

export interface ResolvedCampaignSteps {
  /** The campaign's base WorkflowTemplate id. */
  templateId: number
  /** The root step. */
  rootStep: CampaignStep | null
  /** Child steps under the root (this is where config commonly lives). */
  childSteps: CampaignStep[]
}

/**
 * Resolve a campaign to its base template id and step list (root + children)
 * via the generic query engine. Which step carries the config you want to edit
 * is app-specific — pick from `childSteps` (or `rootStep`) by name.
 */
export async function resolveCampaignSteps(campaignId: number): Promise<ApiResponse<ResolvedCampaignSteps>> {
  const rows = await runQueryRows({
    key: "WorkflowTemplate",
    attributes: ["id"],
    filter: eq("workflowCampaignId", campaignId),
    relationships: [
      {
        key: REL_ROOT_STEP,
        attributes: ["id", "name"],
        limit: 1,
        relationships: [{ key: REL_CHILD_STEP, attributes: ["id", "name"], limit: 20 }],
      },
    ],
    limit: 1,
  })

  if (rows.length === 0) return { success: false, error: `No template found for campaign ${campaignId}` }
  const row = rows[0]
  const templateId = getRootAttr<number>(row, "WorkflowTemplate", "id")
  if (!templateId) return { success: false, error: "Template has no id" }

  const rootWrapper = getRelated(row, REL_ROOT_STEP)[0]
  const rootStep: CampaignStep | null = rootWrapper
    ? {
        id: getRelatedAttr<number>(rootWrapper, "WorkflowTemplateHasRootWorkflowTemplateStep", "WorkflowTemplateStep", "id")!,
        name: getRelatedAttr<string>(rootWrapper, "WorkflowTemplateHasRootWorkflowTemplateStep", "WorkflowTemplateStep", "name") ?? null,
      }
    : null

  const childWrappers = rootWrapper?.instance?.relationships?.[REL_CHILD_STEP] ?? []
  const childSteps: CampaignStep[] = childWrappers
    .map((w) => ({
      id: getRelatedAttr<number>(w, "WorkflowTemplateStepHasChildWorkflowTemplateStep", "WorkflowTemplateStep", "id")!,
      name: getRelatedAttr<string>(w, "WorkflowTemplateStepHasChildWorkflowTemplateStep", "WorkflowTemplateStep", "name") ?? null,
    }))
    .filter((s) => s.id != null)

  return ok({ templateId, rootStep, childSteps })
}

/**
 * Write a PARTIAL step configuration. Send only the top-level keys you want to
 * change (e.g. `{ notifications: [...] }` or `{ webhooks: [...] }`); the server
 * preserves the rest. This is the generic "edit a template step's config" call.
 */
export async function updateStepConfiguration(
  stepId: number,
  partial: Record<string, unknown>,
): Promise<ApiResponse<unknown>> {
  const formData = new FormData()
  formData.append("rawData[0].data", JSON.stringify(partial))
  return callApi("stepConfig/updateStepConfiguration", endpoints.stepConfigWrite(stepId), {
    method: "PUT",
    body: formData,
  })
}

/** Drop `id` from a row (the server reuses it; working PUTs omit it). */
function withoutId<T extends { id?: number }>(row: T): Omit<T, "id"> {
  const { id, ...rest } = row
  return rest
}

/**
 * Set the email-recipient list for a step's notification. Round-trips the
 * existing notification row (minus `id`), overriding only `additionalEmails`
 * (and optional subject/body), and preserves sibling notifications. Creates one
 * with safe defaults if none exists.
 */
export async function setStepNotificationEmails(
  stepId: number,
  current: StepNotification[],
  emails: string[],
  copy?: { emailSubject?: string; emailMessage?: string },
): Promise<ApiResponse<unknown>> {
  const existing = current.find((n) => Array.isArray(n.additionalEmails)) ?? current[0]

  const row: StepNotification = existing
    ? { ...withoutId(existing), additionalEmails: emails, ...copy }
    : {
        name: "OnComplete",
        isActive: true,
        whenToExecute: [WHEN_ON_STEP_COMPLETION],
        additionalEmails: emails,
        // Required scalars the backend validates on create:
        smsMessage: "",
        completionButtonLabel: "",
        notifyPatient: false,
        notifyCustomer: false,
        sendCompletionLink: false,
        ...copy,
      }

  const siblings = current.filter((n) => n !== existing).map(withoutId)
  return updateStepConfiguration(stepId, { notifications: [...siblings, row] })
}

/**
 * Set (or remove) the webhook on a step. Pass `null` to remove (PUT
 * `{webhooks:[]}`). Round-trips the existing webhook (minus `id`), overriding
 * the endpoint/headers/failure-email; retries default to 3× / 3 min.
 */
export async function setStepWebhook(
  stepId: number,
  current: StepWebhook[],
  next: {
    endpointUrl: string
    header?: Record<string, string>
    failureNotificationEmails?: string[]
    name?: string
  } | null,
): Promise<ApiResponse<unknown>> {
  if (!next) return updateStepConfiguration(stepId, { webhooks: [] })

  const existing = current[0]
  const base = existing ? withoutId(existing) : {}
  const row: StepWebhook = {
    name: next.name ?? "Webhook",
    ...base,
    method: "POST",
    isActive: true,
    whenToExecute:
      Array.isArray(existing?.whenToExecute) && existing!.whenToExecute!.length > 0
        ? existing!.whenToExecute
        : [WHEN_ON_STEP_COMPLETION],
    endpointUrl: next.endpointUrl,
    header: next.header ?? {},
    failureNotificationEmails: next.failureNotificationEmails ?? [],
    retryIntervalMinutes: 3,
    numberOfRetriesBeforeFail: 3,
    ...(existing ? {} : { customBody: false, customBodyModel: "" }),
  }
  return updateStepConfiguration(stepId, { webhooks: [row] })
}
