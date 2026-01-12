/**
 * File Actions
 *
 * URL Pattern: /api/v2/file/{fileId}/download
 * Purpose: Download files from the 1Health file system
 */

"use server"

import { authFetch, getOneHealthBaseUrl, type ApiDebugInfo } from "@/lib/auth-server"

/**
 * Download a file by ID and return as base64
 */
export async function downloadJourneyFile(fileId: number): Promise<{
  success: boolean
  data?: string // base64 encoded file
  fileName?: string
  error?: string
}> {
  try {
    const baseUrl = await getOneHealthBaseUrl()
    const url = `${baseUrl}/api/v2/file/${fileId}/download`

    const { response } = await authFetch(url, {
      method: "GET",
    })

    if (!response.ok) {
      const errorBody = await response.text()
      console.error("[v0] downloadJourneyFile error:", response.status, errorBody)
      throw new Error(`API request failed with status ${response.status}`)
    }

    // Get the filename from Content-Disposition header if available
    const contentDisposition = response.headers.get("Content-Disposition")
    let fileName = `file-${new Date().toISOString()}`
    if (contentDisposition) {
      const match = contentDisposition.match(/filename="?([^";\n]+)"?/)
      if (match) {
        fileName = match[1]
      }
    }

    // Convert blob to base64 to pass through server action
    const arrayBuffer = await response.arrayBuffer()
    const base64 = Buffer.from(arrayBuffer).toString("base64")

    return {
      success: true,
      data: base64,
      fileName,
    }
  } catch (error) {
    console.error("Error downloading journey file:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to download file",
    }
  }
}

/**
 * Download an export file by ID and return as base64
 * Used specifically for grid export downloads
 */
export async function downloadExportFile(fileId: number): Promise<{
  data: string
  fileName: string
  apiCalls?: ApiDebugInfo[]
}> {
  const baseUrl = await getOneHealthBaseUrl()

  const { response, debugInfo } = await authFetch(`${baseUrl}/api/v2/file/${fileId}/download`, {
    method: "GET",
  })

  if (!response.ok) {
    throw new Error(`Download failed: ${response.statusText}`)
  }

  // Get the filename from Content-Disposition header if available
  const contentDisposition = response.headers.get("Content-Disposition")
  let fileName = `export-${new Date().toISOString()}.xlsx`
  if (contentDisposition) {
    const match = contentDisposition.match(/filename="?([^";\n]+)"?/)
    if (match) {
      fileName = match[1]
    }
  }

  // Convert blob to base64 to pass through server action
  const arrayBuffer = await response.arrayBuffer()
  const base64 = Buffer.from(arrayBuffer).toString("base64")

  return { data: base64, fileName, apiCalls: [debugInfo] }
}
