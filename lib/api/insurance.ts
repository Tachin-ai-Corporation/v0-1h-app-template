/**
 * Client-side Insurance API
 *
 * Replaces: app/actions/insurance-actions.ts
 */

import { authFetch, getOneHealthBaseUrl } from "@/lib/auth-client"

export interface Insurance {
  id: number
  memberIdNumber: string
  insuranceType: string
  planEffectiveDate: string
  expirationDate?: string
  cancellationDate?: string
  insuranceGroupId?: string
  insurancePrecedence: string
  relationshipToInsured?: string
  label?: string
  insuranceOrganizationDTO: {
    insuranceCompanyName: string
    insuranceCompanyId: number
    location?: string | null
    naicCode?: string | null
  }
}

export interface InsurancePayload {
  memberIdNumber: string
  insuranceType: string
  planEffectiveDate: string
  expirationDate?: string | null
  cancellationDate?: string | null
  insuranceGroupId?: string
  insurancePrecedence: string
  relationshipToInsured?: string
  insuranceOrganizationDTO: { insuranceCompanyId: number }
}

export async function getPatientInsurances(personId: string): Promise<Insurance[]> {
  try {
    const baseUrl = getOneHealthBaseUrl()
    const response = await authFetch(
      `${baseUrl}/api/v2/organization/patient/${personId}/insurance/list?page=0&size=50`,
      { method: "GET" },
    )

    if (!response.ok) {
      console.error(`Failed to fetch insurances: ${response.status}`)
      return []
    }

    const data = await response.json()
    return data.data || []
  } catch (error) {
    console.error("Error fetching insurances:", error)
    return []
  }
}

export async function createPatientInsurance(
  personId: string,
  payload: InsurancePayload,
): Promise<{ success: boolean; data?: Insurance; error?: string }> {
  try {
    const baseUrl = getOneHealthBaseUrl()
    const response = await authFetch(`${baseUrl}/api/v2/organization/patient/${personId}/insurance`, {
      method: "POST",
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`Failed to create insurance: ${response.status}`, errorText)
      return { success: false, error: `Failed to create insurance: ${response.status}` }
    }

    const data = await response.json()
    return { success: true, data }
  } catch (error) {
    console.error("Error creating insurance:", error)
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" }
  }
}

export async function updatePatientInsurance(
  personId: string,
  insuranceId: number,
  payload: InsurancePayload,
): Promise<{ success: boolean; data?: Insurance; error?: string }> {
  try {
    const baseUrl = getOneHealthBaseUrl()
    const response = await authFetch(`${baseUrl}/api/v2/organization/patient/${personId}/insurance/${insuranceId}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`Failed to update insurance: ${response.status}`, errorText)
      return { success: false, error: `Failed to update insurance: ${response.status}` }
    }

    const data = await response.json()
    return { success: true, data }
  } catch (error) {
    console.error("Error updating insurance:", error)
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" }
  }
}
