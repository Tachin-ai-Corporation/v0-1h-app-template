/**
 * Client-side Query Person API
 *
 * Replaces: app/actions/query/query-person.ts
 */

import { authFetch, getOneHealthBaseUrl } from "@/lib/auth-client"

export interface ExternalSystemId {
  id?: number
  externalId: string
  systemName: string
}

export interface QueryResult<T> {
  success: boolean
  data?: T
  error?: string
}

export async function getExternalSystemIds(personId: number): Promise<QueryResult<ExternalSystemId[]>> {
  try {
    const baseUrl = getOneHealthBaseUrl()
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

    const response = await authFetch(url, { method: "POST", body: JSON.stringify(requestBody) })
    const responseText = await response.text()

    if (!response.ok) {
      console.error("[v0] getExternalSystemIds error:", response.status, responseText)
      return { success: false, error: `Failed to fetch: ${response.status}` }
    }

    let result
    try {
      result = JSON.parse(responseText)
    } catch {
      return { success: false, error: "Failed to parse response" }
    }

    if (!result.data || result.data.length === 0) {
      return { success: true, data: [] }
    }

    const externalIds: ExternalSystemId[] = []
    const personRecord = result.data[0]
    const importRecordRelKey = "Person.PersonIsRepresentedByImportResultRecord.ImportResultRecord"
    const importRecords = personRecord.relationships?.[importRecordRelKey] || []

    for (const importRecordWrapper of importRecords) {
      const importRecord = importRecordWrapper.instance
      if (!importRecord) continue

      const importAttrs = importRecord.attributes || {}
      let externalSystemId: string | null = null
      let importRecordId: number | null = null

      for (const [key, value] of Object.entries(importAttrs)) {
        if (key.endsWith(".externalSystemId") && value) externalSystemId = String(value)
        if (key.endsWith(".id") && key.includes("ImportResultRecord") && !key.includes("ExternalIntegration"))
          importRecordId = Number(value)
      }

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
        externalIds.push({ id: importRecordId, externalId: externalSystemId, systemName })
      }
    }

    return { success: true, data: externalIds }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error"
    console.error("[v0] getExternalSystemIds exception:", errorMessage)
    return { success: false, error: errorMessage }
  }
}

export async function getPersonCustomData(
  personId: number,
): Promise<QueryResult<{ customData: Record<string, any> | null }>> {
  try {
    const baseUrl = getOneHealthBaseUrl()
    const url = `${baseUrl}/api/v2/query`

    const requestBody = { key: "Person", attributes: ["id", "customData"], filter: `id==${personId}`, limit: 1 }

    const response = await authFetch(url, { method: "POST", body: JSON.stringify(requestBody) })
    const responseText = await response.text()

    if (!response.ok) {
      console.error("[v0] getPersonCustomData error:", response.status, responseText)
      return { success: false, error: `Failed to fetch: ${response.status}` }
    }

    let result
    try {
      result = JSON.parse(responseText)
    } catch {
      return { success: false, error: "Failed to parse response" }
    }

    if (!result.data || result.data.length === 0) {
      return { success: true, data: { customData: null } }
    }

    const personRecord = result.data[0]
    const attrs = personRecord.attributes || {}

    let customData: Record<string, any> | null = null
    for (const [key, value] of Object.entries(attrs)) {
      if (key.endsWith(".customData") && value) {
        customData = typeof value === "string" ? JSON.parse(value) : value
        break
      }
    }

    return { success: true, data: { customData } }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error"
    console.error("[v0] getPersonCustomData exception:", errorMessage)
    return { success: false, error: errorMessage }
  }
}
