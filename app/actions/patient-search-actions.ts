/**
 * Patient Search Actions
 *
 * URL Pattern: POST /api/v2/query
 * Entity Type: Person
 *
 * Purpose: Search for patients by name, DOB, or external ID
 */

"use server"

import { authFetch, getOneHealthBaseUrl } from "@/lib/auth-server"
import type { QueryResult } from "./query/types"

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

/**
 * Search for patients using the query API
 *
 * Supports searching by:
 * - First name (exact match, case-sensitive)
 * - Last name (exact match, case-sensitive)
 * - Date of birth (exact match)
 * - External system ID (exact match via ImportResultRecord)
 *
 * NOTE: Only exact matches are supported. The 1health query API
 * does not support LIKE/wildcard operators.
 */
export async function searchPatients(
  params: PatientSearchParams,
): Promise<QueryResult<{ patients: PatientSearchResult[]; total: number }>> {
  try {
    const baseUrl = await getOneHealthBaseUrl()
    const url = `${baseUrl}/api/v2/query`

    // Build filter conditions
    const filterParts: string[] = []

    if (params.lastName) {
      filterParts.push(`lastName=="${params.lastName}"`)
    }
    if (params.firstName) {
      filterParts.push(`firstName=="${params.firstName}"`)
    }
    if (params.dateOfBirth) {
      filterParts.push(`birthDate=="${params.dateOfBirth}"`)
    }

    // If searching by external ID, we need a different query structure
    if (params.externalId) {
      return searchPatientsByExternalId(params.externalId, params.limit, params.offset)
    }

    // Must have at least one search criteria
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

    console.log("[v0] searchPatients REQUEST:", JSON.stringify(requestBody, null, 2))

    const { response } = await authFetch(url, {
      method: "POST",
      body: JSON.stringify(requestBody),
    })

    const responseText = await response.text()

    console.log("[v0] searchPatients RESPONSE STATUS:", response.status)
    console.log("[v0] searchPatients RESPONSE:", responseText.substring(0, 2000))

    if (!response.ok) {
      console.error("[v0] searchPatients error:", response.status, responseText)
      return { success: false, error: `Search failed: ${response.status}` }
    }

    let result
    try {
      result = JSON.parse(responseText)
    } catch {
      return { success: false, error: "Failed to parse response" }
    }

    const patients: PatientSearchResult[] = []

    if (result.data && Array.isArray(result.data)) {
      for (const record of result.data) {
        const attrs = record.attributes || {}
        const patient = parsePersonAttributes(record.instanceId, attrs)
        if (patient) {
          patients.push(patient)
        }
      }
    }

    console.log("[v0] searchPatients found:", patients.length, "patients")

    return {
      success: true,
      data: {
        patients,
        total: result.totalCount || patients.length,
      },
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error"
    console.error("[v0] searchPatients exception:", errorMessage)
    return { success: false, error: errorMessage }
  }
}

/**
 * Search patients by external system ID
 * Uses ImportResultRecord relationship to find matching patients
 */
async function searchPatientsByExternalId(
  externalId: string,
  limit?: number,
  offset?: number,
): Promise<QueryResult<{ patients: PatientSearchResult[]; total: number }>> {
  try {
    const baseUrl = await getOneHealthBaseUrl()
    const url = `${baseUrl}/api/v2/query`

    // Query ImportResultRecord first, then get the Person
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

    console.log("[v0] searchPatientsByExternalId REQUEST:", JSON.stringify(requestBody, null, 2))

    const { response } = await authFetch(url, {
      method: "POST",
      body: JSON.stringify(requestBody),
    })

    const responseText = await response.text()

    console.log("[v0] searchPatientsByExternalId RESPONSE STATUS:", response.status)
    console.log("[v0] searchPatientsByExternalId RESPONSE:", responseText.substring(0, 2000))

    if (!response.ok) {
      return { success: false, error: `Search failed: ${response.status}` }
    }

    let result
    try {
      result = JSON.parse(responseText)
    } catch {
      return { success: false, error: "Failed to parse response" }
    }

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

    return {
      success: true,
      data: {
        patients,
        total: patients.length,
      },
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error"
    console.error("[v0] searchPatientsByExternalId exception:", errorMessage)
    return { success: false, error: errorMessage }
  }
}

/**
 * Parse person attributes from query response
 * Handles the prefixed attribute keys from the query API
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

  if (!firstName && !lastName) {
    return null
  }

  return {
    id,
    firstName,
    lastName,
    middleName,
    dateOfBirth: birthDate,
    gender,
    phone,
    email,
  }
}
