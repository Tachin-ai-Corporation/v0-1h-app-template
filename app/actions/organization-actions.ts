/**
 * Organization Actions
 *
 * URL Patterns:
 * - /api/v2/organization/list - Search partner organizations
 * - /api/v2/organization/partner/invitation - Create partner organization
 * - /api/v2/organization/partner/{orgId} - Update partner organization
 *
 * Purpose: Manage partner organizations (create, search, update)
 */

"use server"

import { authFetch, getOneHealthBaseUrl } from "@/lib/auth-server"

export interface PartnerOrganizationResult {
  boiId: number
  tenantId: number
  tenantName: string
  subdomain: string
  supportEmail: string
  supportPhone: string
  supportPhoneRegion: string
  supportPageURL: string
  applicationName: string
  facilityName: string
  tagLine: string
  tenantLogo: string | null
  tenantDarkLogo: string | null
  tenantTitleIcon: string | null
  tenantDarkTitleIcon: string | null
  primaryColor: string
  secondaryColor: string
  hipaaCoveredEntity: string | null
  organization: {
    name: string
    id: number
    companyTaxId: string
    type: string[]
    organizationTenantId: number
    duns: string
    labClia: string
    labDirector: string
    corporateEmailDomain: string
    shortOrganizationName: string
    personContacts: Array<{
      id: number
      email: string
      firstName: string
      middleName: string
      lastName: string
      phoneNumber: string
      phoneNumberRegion: string
      contactTypes: string[]
    }> | null
    npi: string | null
    headquarterAddress: {
      name: string
      id: number
      country: string
      addressLine1: string
      addressLine2: string
      cityName: string
      stateName: string
      postalCode: string
      lat: number
      lon: number
      county: string
      type: string
      fullAddress: string
      personLocationType: string | null
      isValidated: boolean
      isPrimary: boolean | null
    } | null
    primaryCorporateEmail: string | null
    primaryCorporatePhone: string | null
    primaryCorporatePhoneRegion: string | null
    partnershipStatus: string
    direction: string
  }
}

/**
 * Search for partner organizations by name
 */
export async function searchPartnerOrganizations(
  searchQuery: string,
): Promise<{ success: boolean; data?: PartnerOrganizationResult[]; error?: string }> {
  try {
    const baseUrl = await getOneHealthBaseUrl()
    const encodedName = encodeURIComponent(searchQuery.trim())
    const url = `${baseUrl}/api/v2/organization/list?name=${encodedName}&claimFilter=claim-and-pending&page=0&size=8`

    const { response } = await authFetch(url, {
      method: "GET",
    })

    if (!response.ok) {
      const errorBody = await response.text()
      console.error("[v0] searchPartnerOrganizations error:", response.status, errorBody)
      return { success: false, error: `API request failed with status ${response.status}: ${errorBody}` }
    }

    const result = await response.json()

    const organizations: PartnerOrganizationResult[] = []
    if (result && result.data && Array.isArray(result.data)) {
      for (const item of result.data) {
        organizations.push(item)
      }
    }

    return { success: true, data: organizations }
  } catch (error) {
    console.error("Error searching partner organizations:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to search partner organizations",
    }
  }
}

/**
 * Fetch partner organization details by ID
 */
export async function fetchPartnerOrganizationDetails(
  orgId: number,
): Promise<{ success: boolean; data?: PartnerOrganizationResult; error?: string }> {
  try {
    const baseUrl = await getOneHealthBaseUrl()
    const url = `${baseUrl}/api/v2/organization/list?organizationId=${orgId}&claimFilter=claim-and-pending&page=0&size=1`

    const { response } = await authFetch(url, {
      method: "GET",
    })

    if (!response.ok) {
      const errorBody = await response.text()
      console.error("[v0] fetchPartnerOrganizationDetails error:", response.status, errorBody)
      throw new Error(`API request failed with status ${response.status}`)
    }

    const result = await response.json()

    if (result && result.data && Array.isArray(result.data) && result.data.length > 0) {
      return { success: true, data: result.data[0] }
    }

    return { success: false, error: "Organization not found" }
  } catch (error) {
    console.error("Error fetching partner organization details:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch partner organization details",
    }
  }
}

/**
 * Create a new partner organization
 */
export async function createPartnerOrganization(name: string): Promise<{
  success: boolean
  data?: { id: number; name: string; tenantId: number }
  error?: string
}> {
  try {
    const baseUrl = await getOneHealthBaseUrl()
    const url = `${baseUrl}/api/v2/organization/partner/invitation`

    const { response } = await authFetch(url, {
      method: "POST",
      body: JSON.stringify({
        name: name,
        tin: name,
      }),
    })

    if (!response.ok) {
      const errorBody = await response.text()
      return { success: false, error: `API request failed with status ${response.status}: ${errorBody}` }
    }

    const responseText = await response.text()
    if (!responseText) {
      return { success: false, error: "Empty response from API" }
    }

    const data = JSON.parse(responseText)
    return { success: true, data }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" }
  }
}

/**
 * Create a new partner organization with TIN
 */
export async function createPartnerOrganizationWithTin(
  name: string,
  tin: string,
): Promise<{
  success: boolean
  data?: { id: number; name: string; tenantId: number }
  error?: string
}> {
  try {
    const baseUrl = await getOneHealthBaseUrl()
    const url = `${baseUrl}/api/v2/organization/partner/invitation`

    const { response } = await authFetch(url, {
      method: "POST",
      body: JSON.stringify({
        name: name,
        tin: tin,
      }),
    })

    if (!response.ok) {
      const errorBody = await response.text()
      return { success: false, error: `API request failed with status ${response.status}: ${errorBody}` }
    }

    const responseText = await response.text()
    if (!responseText) {
      return { success: false, error: "Empty response from API" }
    }

    const data = JSON.parse(responseText)
    return { success: true, data }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" }
  }
}

interface UpdatePartnerPayload {
  name: string
  headquarterAddress: {
    addressLine1: string
    addressLine2?: string
    city: string
    state: string
    zipCode: string
    fullAddress: string
  }
}

/**
 * Update a partner organization
 */
export async function updatePartnerOrganization(
  orgId: number,
  payload: UpdatePartnerPayload,
): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const baseUrl = await getOneHealthBaseUrl()
    const url = `${baseUrl}/api/v2/organization/partner/${orgId}`

    const apiPayload = {
      name: payload.name,
      headquarterAddress: {
        addressLine1: payload.headquarterAddress.addressLine1,
        addressLine2: payload.headquarterAddress.addressLine2 || "",
        fullAddress: payload.headquarterAddress.fullAddress,
        city: payload.headquarterAddress.city,
        state: payload.headquarterAddress.state,
        zipCode: payload.headquarterAddress.zipCode,
      },
    }

    const { response } = await authFetch(url, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(apiPayload),
    })

    if (!response.ok) {
      const errorBody = await response.text()
      console.error("[v0] updatePartnerOrganization error:", response.status, errorBody)
      throw new Error(`API request failed with status ${response.status}: ${errorBody}`)
    }

    const responseText = await response.text()
    let result = null
    if (responseText) {
      try {
        result = JSON.parse(responseText)
      } catch {
        // Response is not JSON, that's okay
      }
    }

    return { success: true, data: result }
  } catch (error) {
    console.error("Error updating partner organization:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update partner organization",
    }
  }
}
