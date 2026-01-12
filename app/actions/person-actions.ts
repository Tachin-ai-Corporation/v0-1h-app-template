/**
 * Person Actions
 *
 * URL Patterns:
 *   - /api/v2/person/{personId} - Get person info
 *   - /api/v2/person/upsert - Create or update person
 *
 * Purpose: Person/patient data management
 *
 * Note: External system IDs use /api/v2/query (see app/actions/query/query-person.ts)
 * Note: Insurance operations use /api/v2/organization/patient (see insurance-actions.ts)
 */

"use server"

import { authFetch, getOneHealthBaseUrl } from "@/lib/auth-server"

export interface PatientInfo {
  id: number
  firstName: string
  lastName: string
  middleName?: string
  dateOfBirth: string
  gender: string
  phone?: string
  email?: string
  address?: {
    street?: string
    city?: string
    state?: string
    zipCode?: string
    fullAddress?: string
  }
}

interface PersonApiResponse {
  id: number
  firstName: string
  lastName: string
  middleName?: string
  birthDate: string
  biologicalGender: string
  genderIdentity?: string
  email?: string | null
  phoneNumber?: string | null
  phoneNumberRegion?: string | null
  location?: {
    addressLine1?: string
    addressLine2?: string
    cityName?: string
    stateName?: string
    postalCode?: string
    country?: string
    fullAddress?: string
  } | null
}

export async function getPatientInfo(personId: string): Promise<PatientInfo | null> {
  try {
    const baseUrl = await getOneHealthBaseUrl()
    const { response } = await authFetch(`${baseUrl}/api/v2/person/${personId}?type=Patient`, {
      method: "GET",
    })

    if (!response.ok) {
      console.error(`Failed to fetch patient info: ${response.status}`)
      return null
    }

    const data: PersonApiResponse = await response.json()

    console.log("[v0] Patient API response location:", JSON.stringify(data.location, null, 2))
    console.log("[v0] Patient API response phoneNumber:", data.phoneNumber)

    let normalizedPhone: string | undefined = undefined
    if (data.phoneNumber) {
      let phoneDigits = data.phoneNumber.replace(/\D/g, "")
      if (phoneDigits.length === 11 && phoneDigits.startsWith("1")) {
        phoneDigits = phoneDigits.slice(1)
      }
      normalizedPhone = phoneDigits || undefined
    }

    let addressData: PatientInfo["address"] = undefined
    if (data.location) {
      const loc = data.location
      const streetParts = [loc.addressLine1, loc.addressLine2].filter((part) => part && part !== "n/a")
      const street = streetParts.join(", ") || undefined
      const city = loc.cityName && loc.cityName !== "n/a" ? loc.cityName : undefined
      const state = loc.stateName && loc.stateName !== "n/a" ? loc.stateName : undefined
      const zipCode = loc.postalCode && loc.postalCode !== "n/a" ? loc.postalCode : undefined

      if (street || city || state || zipCode) {
        addressData = {
          street,
          city,
          state,
          zipCode,
          fullAddress: [street, city, state, zipCode].filter(Boolean).join(", "),
        }
      }
    }

    const patientInfo: PatientInfo = {
      id: data.id,
      firstName: data.firstName,
      lastName: data.lastName,
      middleName: data.middleName !== "n/a" ? data.middleName : undefined,
      dateOfBirth: data.birthDate,
      gender:
        data.biologicalGender !== "n/a"
          ? data.biologicalGender
          : data.genderIdentity !== "n/a"
            ? data.genderIdentity
            : "Unknown",
      phone: normalizedPhone,
      email: data.email || undefined,
      address: addressData,
    }

    return patientInfo
  } catch (error) {
    console.error("Error fetching patient info:", error)
    return null
  }
}

export interface UpsertPersonPayload {
  id: number
  firstName?: string
  lastName?: string
  middleName?: string
  birthDate?: string
  biologicalGender?: string
  email?: string
  phoneNumber?: {
    region: string
    value: string
  }
  addLocation?: {
    addressLine1?: string
    addressLine2?: string
    cityName?: string
    stateName?: string
    postalCode?: string
    country?: string
    primary?: boolean
  }
  markWithExternalSystemRecord?: {
    id?: number
    name: string
    recordId: string
  }
}

export async function upsertPerson(
  payload: UpsertPersonPayload,
  originalInfo?: PatientInfo,
): Promise<{ success: boolean; error?: string }> {
  try {
    const changedPayload: Record<string, unknown> = {
      id: payload.id,
    }

    if (!originalInfo) {
      Object.entries(payload).forEach(([key, value]) => {
        if (value !== undefined && key !== "id") {
          changedPayload[key] = value
        }
      })
    } else {
      if (payload.firstName && payload.firstName !== originalInfo.firstName) {
        changedPayload.firstName = payload.firstName
      }
      if (payload.lastName && payload.lastName !== originalInfo.lastName) {
        changedPayload.lastName = payload.lastName
      }
      if (payload.middleName !== undefined && payload.middleName !== (originalInfo.middleName || "")) {
        changedPayload.middleName = payload.middleName
      }
      if (payload.birthDate && payload.birthDate !== originalInfo.dateOfBirth) {
        changedPayload.birthDate = payload.birthDate
      }
      if (payload.biologicalGender && payload.biologicalGender !== originalInfo.gender) {
        changedPayload.biologicalGender = payload.biologicalGender
      }
      if (payload.email !== undefined && payload.email !== (originalInfo.email || "")) {
        changedPayload.email = payload.email
      }
      if (payload.phoneNumber) {
        const originalPhone = originalInfo.phone?.replace(/\D/g, "") || ""
        const newPhone = payload.phoneNumber.value.replace(/\D/g, "")
        if (newPhone !== originalPhone) {
          changedPayload.phoneNumber = payload.phoneNumber
        }
      }
      if (payload.addLocation) {
        const origAddr = originalInfo.address || {}
        if (
          payload.addLocation.addressLine1 !== (origAddr.street || "") ||
          payload.addLocation.cityName !== (origAddr.city || "") ||
          payload.addLocation.stateName !== (origAddr.state || "") ||
          payload.addLocation.postalCode !== (origAddr.zipCode || "")
        ) {
          changedPayload.addLocation = payload.addLocation
        }
      }
      if (payload.markWithExternalSystemRecord) {
        changedPayload.markWithExternalSystemRecord = payload.markWithExternalSystemRecord
      }
    }

    delete (changedPayload as Record<string, unknown>).markAsPatientToContextOrganization

    console.log("[v0] Upsert payload being sent:", JSON.stringify(changedPayload, null, 2))

    const baseUrl = await getOneHealthBaseUrl()
    const { response } = await authFetch(`${baseUrl}/api/v2/person/upsert`, {
      method: "POST",
      body: JSON.stringify(changedPayload),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`Failed to upsert person: ${response.status}`, errorText)
      return { success: false, error: `Failed to update: ${response.status}` }
    }

    return { success: true }
  } catch (error) {
    console.error("Error upserting person:", error)
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" }
  }
}
