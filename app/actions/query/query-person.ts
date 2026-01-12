/**
 * Query Actions - Person Entity
 *
 * URL Pattern: POST /api/v2/query
 * Entity Type: Person
 *
 * Purpose: Query person-related data via the generic query endpoint
 */

"use server"

import { authFetch, getOneHealthBaseUrl } from "@/lib/auth-server"
import type { ExternalSystemId, QueryResult } from "./types"

/**
 * Fetches external system IDs for a person via ImportResultRecord relationship
 *
 * Query path:
 *   Person -> ImportResultRecord (get externalSystemId)
 *            -> ExternalIntegrationConfiguration (get name)
 *
 * Returns array of { id, externalId, systemName } for each ImportResultRecord
 */
export async function getExternalSystemIds(personId: number): Promise<QueryResult<ExternalSystemId[]>> {
  try {
    const baseUrl = await getOneHealthBaseUrl()
    const url = `${baseUrl}/api/v2/query`

    const requestBody = {
      key: "Person",
      attributes: ["id"],
      filter: `id==${personId}`,
      relationships: [
        {
          key: "Person.PersonIsRepresentedByImportResultRecord.ImportResultRecord",
          attributes: ["id", "externalSystemId"],
          relationAttributes: ["id"],
          limit: 50,
          // Nested relationship to get ExternalIntegrationConfiguration name
          relationships: [
            {
              key: "ImportResultRecord.ImportResultRecordFromExternalIntegrationConfiguration.ExternalIntegrationConfiguration",
              attributes: ["id", "name"],
              relationAttributes: ["id"],
              limit: 1,
            },
          ],
        },
      ],
      limit: 1,
      offset: 0,
    }

    console.log("[v0] getExternalSystemIds REQUEST URL:", url)
    console.log("[v0] getExternalSystemIds REQUEST BODY:", JSON.stringify(requestBody, null, 2))

    const { response } = await authFetch(url, {
      method: "POST",
      body: JSON.stringify(requestBody),
    })

    const responseText = await response.text()

    console.log("[v0] getExternalSystemIds RESPONSE STATUS:", response.status)
    console.log("[v0] getExternalSystemIds RESPONSE BODY:", responseText.substring(0, 3000))

    if (!response.ok) {
      console.error("[v0] getExternalSystemIds error:", response.status, responseText)
      return { success: false, error: `Failed to fetch: ${response.status}` }
    }

    let result
    try {
      result = JSON.parse(responseText)
    } catch {
      console.error("[v0] getExternalSystemIds: Failed to parse JSON response:", responseText.substring(0, 100))
      return { success: false, error: "Failed to parse response" }
    }

    if (!result.data || result.data.length === 0) {
      return { success: true, data: [] }
    }

    const externalIds: ExternalSystemId[] = []
    const personRecord = result.data[0]

    // Navigate to relationships object
    // Key format: "Person.PersonIsRepresentedByImportResultRecord.ImportResultRecord"
    const importRecordRelKey = "Person.PersonIsRepresentedByImportResultRecord.ImportResultRecord"
    const importRecords = personRecord.relationships?.[importRecordRelKey] || []

    console.log("[v0] getExternalSystemIds: Found", importRecords.length, "ImportResultRecords")

    for (const importRecordWrapper of importRecords) {
      const importRecord = importRecordWrapper.instance
      if (!importRecord) continue

      const importAttrs = importRecord.attributes || {}

      // Extract externalSystemId - attribute key is prefixed with relationship path
      let externalSystemId: string | null = null
      let importRecordId: number | null = null

      for (const [key, value] of Object.entries(importAttrs)) {
        if (key.endsWith(".externalSystemId") && value) {
          externalSystemId = String(value)
        }
        if (key.endsWith(".id") && key.includes("ImportResultRecord") && !key.includes("ExternalIntegration")) {
          importRecordId = Number(value)
        }
      }

      // Now get the ExternalIntegrationConfiguration name from nested relationship
      let systemName = "Unknown System"
      const configRelKey =
        "ImportResultRecord.ImportResultRecordFromExternalIntegrationConfiguration.ExternalIntegrationConfiguration"
      const configRecords = importRecord.relationships?.[configRelKey] || []

      if (configRecords.length > 0) {
        const configWrapper = configRecords[0]
        const configInstance = configWrapper.instance
        if (configInstance?.attributes) {
          for (const [key, value] of Object.entries(configInstance.attributes)) {
            if (key.endsWith(".name") && value) {
              systemName = String(value)
              break
            }
          }
        }
      }

      if (externalSystemId && importRecordId) {
        externalIds.push({
          id: importRecordId,
          externalId: externalSystemId,
          systemName,
        })
      }
    }

    console.log("[v0] getExternalSystemIds: Parsed", externalIds.length, "external IDs:", externalIds)

    return { success: true, data: externalIds }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error"
    console.error("[v0] getExternalSystemIds exception:", errorMessage)
    return { success: false, error: errorMessage }
  }
}

/**
 * Fetches customData for a person
 *
 * Query path: Person -> customData attribute
 *
 * Returns the customData object or null if not found
 */
export async function getPersonCustomData(
  personId: number,
): Promise<QueryResult<{ customData: Record<string, any> | null }>> {
  try {
    const baseUrl = await getOneHealthBaseUrl()
    const url = `${baseUrl}/api/v2/query`

    const requestBody = {
      key: "Person",
      attributes: ["id", "customData"],
      filter: `id==${personId}`,
      limit: 1,
    }

    console.log("[v0] getPersonCustomData REQUEST URL:", url)
    console.log("[v0] getPersonCustomData REQUEST BODY:", JSON.stringify(requestBody, null, 2))

    const { response } = await authFetch(url, {
      method: "POST",
      body: JSON.stringify(requestBody),
    })

    const responseText = await response.text()

    console.log("[v0] getPersonCustomData RESPONSE STATUS:", response.status)
    console.log("[v0] getPersonCustomData RESPONSE BODY:", responseText.substring(0, 3000))

    if (!response.ok) {
      console.error("[v0] getPersonCustomData error:", response.status, responseText)
      return { success: false, error: `Failed to fetch: ${response.status}` }
    }

    let result
    try {
      result = JSON.parse(responseText)
    } catch {
      console.error("[v0] getPersonCustomData: Failed to parse JSON response:", responseText.substring(0, 100))
      return { success: false, error: "Failed to parse response" }
    }

    if (!result.data || result.data.length === 0) {
      return { success: true, data: { customData: null } }
    }

    const personRecord = result.data[0]
    const attrs = personRecord.attributes || {}

    // Extract customData - attribute key is prefixed with "ROOT.Person."
    let customData: Record<string, any> | null = null
    for (const [key, value] of Object.entries(attrs)) {
      if (key.endsWith(".customData") && value) {
        customData = typeof value === "string" ? JSON.parse(value) : value
        break
      }
    }

    console.log("[v0] getPersonCustomData PARSED customData:", JSON.stringify(customData, null, 2))

    return { success: true, data: { customData } }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error"
    console.error("[v0] getPersonCustomData exception:", errorMessage)
    return { success: false, error: errorMessage }
  }
}
