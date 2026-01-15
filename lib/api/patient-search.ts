/**
 * Client-side Patient Search API
 *
 * Replaces: app/actions/patient-search-actions.ts
 */

import { authFetch, getOneHealthBaseUrl } from "@/lib/auth-client"

export interface PatientSearchResult {
  id: number
  firstName: string
  lastName: string
  middleName?: string
  dateOfBirth: string
  gender: string
  phone?: string
  email?: string
}

export interface PatientSearchParams {
  firstName?: string
  lastName?: string
  dateOfBirth?: string
  externalId?: string
  limit?: number
  offset?: number
}

export interface PatientSearchResponse {
  success: boolean
  data?: { patients: PatientSearchResult[]; total: number }
  error?: string
}

/**
 * Parse person attributes from query response
 */
function parsePersonAttributes(instanceId: number, attrs: Record<string, any>): PatientSearchResult | null {
  let id = instanceId
  let firstName = ""
  let lastName = ""
  let middleName: string | undefined
  let birthDate = ""
  let gender = "Unknown"
  let phone: string | undefined
  let email: string | undefined

  for (const [key, value] of Object.entries(attrs)) {
    if (key.endsWith(".id") && key.includes("Person")) {
      id = Number(value)
    } else if (key.endsWith(".firstName") && value) {
      firstName = String(value)
    } else if (key.endsWith(".lastName") && value) {
      lastName = String(value)
    } else if (key.endsWith(".middleName") && value && value !== "n/a") {
      middleName = String(value)
    } else if (key.endsWith(".birthDate") && value) {
      birthDate = String(value)
    } else if (key.endsWith(".biologicalGender") && value && value !== "n/a") {
      gender = String(value)
    } else if (key.endsWith(".genderIdentity") && value && value !== "n/a" && gender === "Unknown") {
      gender = String(value)
    } else if (key.endsWith(".phoneNumber") && value) {
      phone = String(value)
    } else if (key.endsWith(".email") && value) {
      email = String(value)
    }
  }

  if (!firstName && !lastName) return null

  return { id, firstName, lastName, middleName, dateOfBirth: birthDate, gender, phone, email }
}

/**
 * Search patients by external system ID
 */
async function searchPatientsByExternalId(
  externalId: string,
  limit?: number,
  offset?: number,
): Promise<PatientSearchResponse> {
  try {
    const baseUrl = getOneHealthBaseUrl()
    const url = `${baseUrl}/api/v2/query`

    const requestBody = {
      key: "ImportResultRecord",
      attributes: ["id", "externalSystemId"],
      filter: `externalSystemId=="${externalId}"`,
      relationships: [
        {
          key: "ImportResultRecord.PersonIsRepresentedByImportResultRecord.Person",
          attributes: [
            "id",
            "firstName",
            "lastName",
            "middleName",
            "birthDate",
            "biologicalGender",
            "genderIdentity",
            "phoneNumber",
            "email",
          ],
          relationAttributes: ["id"],
          limit: 1,
        },
      ],
      limit: limit || 50,
      offset: offset || 0,
    }

    const response = await authFetch(url, {
      method: "POST",
      body: JSON.stringify(requestBody),
    })

    if (!response.ok) {
      return { success: false, error: `Search failed: ${response.status}` }
    }

    const result = await response.json()
    const patients: PatientSearchResult[] = []
    const seenIds = new Set<number>()

    if (result.data && Array.isArray(result.data)) {
      for (const importRecord of result.data) {
        const relKey = "ImportResultRecord.PersonIsRepresentedByImportResultRecord.Person"
        const personRecords = importRecord.relationships?.[relKey] || []

        for (const personWrapper of personRecords) {
          const personInstance = personWrapper.instance
          if (!personInstance) continue

          const attrs = personInstance.attributes || {}
          const patient = parsePersonAttributes(personInstance.instanceId, attrs)

          if (patient && !seenIds.has(patient.id)) {
            seenIds.add(patient.id)
            patients.push(patient)
          }
        }
      }
    }

    return { success: true, data: { patients, total: patients.length } }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error"
    return { success: false, error: errorMessage }
  }
}

/**
 * Search for patients using the query API
 */
export async function searchPatients(params: PatientSearchParams): Promise<PatientSearchResponse> {
  try {
    const baseUrl = getOneHealthBaseUrl()
    const url = `${baseUrl}/api/v2/query`

    const filterParts: string[] = []

    if (params.lastName) filterParts.push(`lastName=="${params.lastName}"`)
    if (params.firstName) filterParts.push(`firstName=="${params.firstName}"`)
    if (params.dateOfBirth) filterParts.push(`birthDate=="${params.dateOfBirth}"`)

    if (params.externalId) {
      return searchPatientsByExternalId(params.externalId, params.limit, params.offset)
    }

    if (filterParts.length === 0) {
      return { success: false, error: "At least one search criteria is required" }
    }

    const filter = filterParts.join(";")

    const requestBody = {
      key: "Person",
      attributes: [
        "id",
        "firstName",
        "lastName",
        "middleName",
        "birthDate",
        "biologicalGender",
        "genderIdentity",
        "phoneNumber",
        "email",
      ],
      filter,
      limit: params.limit || 50,
      offset: params.offset || 0,
    }

    const response = await authFetch(url, {
      method: "POST",
      body: JSON.stringify(requestBody),
    })

    if (!response.ok) {
      return { success: false, error: `Search failed: ${response.status}` }
    }

    const result = await response.json()
    const patients: PatientSearchResult[] = []

    if (result.data && Array.isArray(result.data)) {
      for (const record of result.data) {
        const attrs = record.attributes || {}
        const patient = parsePersonAttributes(record.instanceId, attrs)
        if (patient) patients.push(patient)
      }
    }

    return { success: true, data: { patients, total: result.totalCount || patients.length } }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error"
    return { success: false, error: errorMessage }
  }
}
