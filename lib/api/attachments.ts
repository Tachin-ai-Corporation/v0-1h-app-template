/**
 * =============================================================================
 * 1health API — journey attachments & files
 * =============================================================================
 *
 * Two distinct file mechanisms exist (don't confuse them):
 *   1. A step's own `fileUpload` dynamic field — submitted through the step
 *      submit endpoint (see journey-step.submitStepWithFile).
 *   2. A free-standing attachment on a step, via the generic typed-entity
 *      relation upload — this module.
 *
 * The relation-upload path is generic: `/api/v2/health/type/{EntityType}/{id}/
 * relation/{RelationName}/file/upload` — reusable for any entity/relation.
 *
 * See docs/api/WORKFLOWS.md § Attachments.
 * =============================================================================
 */

import { callApi, callApiRaw, type ApiResponse } from "./client"
import { endpoints } from "./config"

/** Loosely-typed documents payload (grouped by step); cast as needed. */
export type JourneyDocuments = Record<string, unknown>

/** List all attachments for a journey, grouped by step. */
export async function fetchJourneyDocuments(journeyId: number): Promise<ApiResponse<JourneyDocuments>> {
  return callApi<JourneyDocuments>("attachments/fetchJourneyDocuments", endpoints.journeyDocuments(journeyId))
}

/**
 * Upload a free-standing attachment onto a step (typed-entity relation upload).
 * The multipart body carries the binary under the `file` part.
 */
export async function uploadStepAttachment(
  stepId: number,
  file: File,
  isPublic = false,
): Promise<ApiResponse<unknown>> {
  const formData = new FormData()
  formData.append("file", file, file.name)
  return callApi("attachments/uploadStepAttachment", endpoints.stepFileUpload(stepId, file.name, isPublic), {
    method: "POST",
    body: formData,
  })
}

/**
 * Download a file's binary. Returns the Blob plus the filename parsed from the
 * `Content-Disposition` header (when present).
 */
export async function downloadFile(fileId: number): Promise<ApiResponse<{ blob: Blob; filename: string }>> {
  try {
    const response = await callApiRaw(endpoints.fileDownload(fileId), { method: "GET" })
    if (!response.ok) {
      return { success: false, error: `downloadFile failed (${response.status})`, statusCode: response.status }
    }
    const blob = await response.blob()
    const disposition = response.headers.get("Content-Disposition") ?? ""
    const match = disposition.match(/filename="?([^"]+)"?/i)
    const filename = match?.[1] ?? `file-${fileId}`
    return { success: true, data: { blob, filename } }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "downloadFile failed" }
  }
}

/** Delete a file (hard delete by default — there is no soft-delete verb). */
export async function deleteFile(fileId: number, hardDelete = true): Promise<ApiResponse<unknown>> {
  return callApi("attachments/deleteFile", endpoints.fileDelete(fileId, hardDelete), { method: "DELETE" })
}
