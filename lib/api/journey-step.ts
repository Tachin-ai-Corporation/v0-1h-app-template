/**
 * =============================================================================
 * 1health API — journey steps (read + dynamic submission)
 * =============================================================================
 *
 * A journey advances by SUBMITTING its currently-actionable step (`canSubmit`).
 * There is no separate "complete" call — a valid submit advances the journey.
 *
 * Three submission shapes exist; pick by what the step's schema looks like:
 *   A. submitStep            — plain named-key JSON (built-in steps: pickers, ids)
 *   B. submitStepFields      — dynamic custom fields, no file (multipart ?attachment)
 *   C. submitStepWithFile    — dynamic custom fields + a file upload
 *   (deleteStepFile removes a previously-uploaded file via the same endpoint)
 *
 * THE dynamic-fields rule: you must echo EVERY field back, mutating only the
 * one(s) you changed — it's read-all → mutate → write-all, not a partial patch.
 * `buildStepMetadata` does this for you.
 *
 * Resolve field ids by LABEL at runtime (see workflow-template.resolveFieldsByLabel);
 * never hardcode `fieldIdentifier` GUIDs — they differ per environment.
 *
 * See docs/api/WORKFLOWS.md § Submitting steps and docs/api/DYNAMIC-STEPS.md.
 * =============================================================================
 */

import { callApi, type ApiResponse } from "./client"
import { endpoints } from "./config"
import type { DynamicField, JourneyStepsData, StepInfo, WorkflowTemplateStep } from "./types"

// Field helpers live in workflow-template; re-exported here for one-stop imports.
export { getDynamicFields, findFieldByLabel, resolveFieldsByLabel } from "./workflow-template"

// ============================================================================
// Reading steps
// ============================================================================

/** List all steps for a journey (flat array + the journey's customData). */
export async function fetchJourneySteps(journeyId: number): Promise<ApiResponse<JourneyStepsData>> {
  return callApi<JourneyStepsData>("journeyStep/fetchJourneySteps", endpoints.journeySteps(journeyId))
}

/** Fetch one step's live info: field schema + current values + files + canSubmit. */
export async function fetchStepInfo(journeyId: number, stepId: number): Promise<ApiResponse<StepInfo>> {
  return callApi<StepInfo>("journeyStep/fetchStepInfo", endpoints.stepInfo(journeyId, stepId))
}

/** Find a step by name in a fetched steps list. */
export function findStepByName(
  steps: JourneyStepsData | undefined | null,
  name: string,
): WorkflowTemplateStep | undefined {
  return steps?.workflowTemplateSteps?.find((s) => s.name === name)
}

/** Find the currently-actionable step (the one with `canSubmit === true`). */
export function findActionableStep(
  steps: JourneyStepsData | undefined | null,
): WorkflowTemplateStep | undefined {
  return steps?.workflowTemplateSteps?.find((s) => s.canSubmit === true)
}

// ============================================================================
// Building the dynamic-fields metadata payload
// ============================================================================

/**
 * Build the `metadata` map for a dynamic-fields submit. Every field is echoed
 * back keyed by its `fieldIdentifier`; `changes` (also keyed by fieldIdentifier)
 * overrides only the `value` of the fields you're editing.
 *
 * @example
 * const ids = resolveFieldsByLabel(fields, { note: "Clinical Note" })
 * const metadata = buildStepMetadata(fields, { [ids.note!]: "All clear" })
 */
export function buildStepMetadata(
  fields: DynamicField[],
  changes: Record<string, unknown> = {},
): Record<string, DynamicField> {
  const metadata: Record<string, DynamicField> = {}
  for (const field of fields) {
    metadata[field.fieldIdentifier] = { ...field }
  }
  for (const [fieldId, value] of Object.entries(changes)) {
    if (metadata[fieldId]) {
      metadata[fieldId] = { ...metadata[fieldId], value }
    }
  }
  return metadata
}

// ============================================================================
// Submitting steps
// ============================================================================

/**
 * Recipe A — submit a built-in step with a plain, well-known JSON body (no
 * dynamic-field wrapping). e.g. `{ personId: 123 }` or an org-picker payload.
 */
export async function submitStep(
  journeyId: number,
  stepId: number,
  body: Record<string, unknown>,
): Promise<ApiResponse<unknown>> {
  return callApi("journeyStep/submitStep", endpoints.stepSubmit(journeyId, stepId, false), {
    method: "POST",
    body: JSON.stringify(body),
  })
}

/**
 * Recipe B — submit dynamic custom fields (no file). Sends multipart with
 * `?attachment` (required for the metadata shape even without a file).
 * Pass the step's full `fields` (from fetchStepInfo) plus `changes` keyed by
 * fieldIdentifier.
 */
export async function submitStepFields(
  journeyId: number,
  stepId: number,
  fields: DynamicField[],
  changes: Record<string, unknown>,
): Promise<ApiResponse<unknown>> {
  const metadata = buildStepMetadata(fields, changes)
  const formData = new FormData()
  formData.append("rawData[0].data", JSON.stringify({ metadata }))
  return callApi("journeyStep/submitStepFields", endpoints.stepSubmit(journeyId, stepId, true), {
    method: "POST",
    body: formData,
  })
}

/**
 * Recipe C — submit dynamic custom fields WITH a file for one field. The file
 * field's `value` stays a placeholder; the binary rides in a second rawData part
 * tagged with the field's identifier.
 */
export async function submitStepWithFile(
  journeyId: number,
  stepId: number,
  fields: DynamicField[],
  fileFieldId: string,
  file: File,
  changes: Record<string, unknown> = {},
): Promise<ApiResponse<unknown>> {
  const metadata = buildStepMetadata(fields, changes)
  const formData = new FormData()
  formData.append("rawData[0].data", JSON.stringify({ metadata }))
  formData.append("rawData[1].file", file, file.name)
  formData.append("rawData[1].data", JSON.stringify({ identifier: fileFieldId }))
  return callApi("journeyStep/submitStepWithFile", endpoints.stepSubmit(journeyId, stepId, true), {
    method: "POST",
    body: formData,
  })
}

/** Remove a previously-uploaded file from a field (delete-by-flag, same endpoint). */
export async function deleteStepFile(
  journeyId: number,
  stepId: number,
  fields: DynamicField[],
  fileFieldId: string,
  file: { id: number; name: string },
): Promise<ApiResponse<unknown>> {
  const metadata = buildStepMetadata(fields)
  const formData = new FormData()
  formData.append("rawData[0].data", JSON.stringify({ metadata }))
  formData.append(
    "rawData[1].data",
    JSON.stringify({ identifier: fileFieldId, name: file.name, id: file.id, delete: true }),
  )
  return callApi("journeyStep/deleteStepFile", endpoints.stepSubmit(journeyId, stepId, true), {
    method: "POST",
    body: formData,
  })
}

/** Update a step's properties directly (observed use: setting `dueDate`). */
export async function updateStepDueDate(
  journeyId: number,
  stepId: number,
  dueDate: string,
): Promise<ApiResponse<unknown>> {
  return callApi("journeyStep/updateStepDueDate", endpoints.step(journeyId, stepId), {
    method: "PUT",
    body: JSON.stringify({ dueDate }),
  })
}
