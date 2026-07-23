/**
 * Client-side Tenant API
 *
 * Fetches tenant/organization configuration from the 1health sys-config endpoint.
 * Uses authFetch for authenticated requests.
 */

import { authFetch, getOneHealthBaseUrl } from "@/lib/auth-client"

// ============================================================================
// Types
// ============================================================================

export interface TenantAddress {
  id: number
  fullAddress: string
  addressLine1: string
  addressLine2: string | null
  cityName: string
  stateName: string
  postalCode: string
  country: string
  county: string | null
  type: string
  lat: number | null
  lon: number | null
}

export interface TenantContact {
  id: number
  firstName: string
  middleName: string | null
  lastName: string
  email: string
  phoneNumber: string
  phoneNumberRegion: string
  contactTypes: string[]
}

export interface TenantLogo {
  name: string
  id: number
  currentVersionId: number
  publicUrl: string
}

export interface TenantOrganization {
  name: string
  id: number
  shortOrganizationName: string
  type: string[]
  companyTaxId: string | null
  organizationTenantId: number
  duns: string | null
  labClia: string | null
  labDirector: string | null
  corporateEmailDomain: string | null
  npi: string | null
  personContacts: TenantContact[]
  headquarterAddress: TenantAddress | null
  primaryCorporateEmail: string | null
  primaryCorporatePhone: string | null
  primaryCorporatePhoneRegion: string | null
  partnershipStatus: string | null
  direction: string | null
}

export interface TenantConfig {
  boiId: number
  tenantId: number
  tenantName: string
  subdomain: string
  supportEmail: string | null
  supportPhone: string | null
  supportPhoneURL: string | null
  supportPageURL: string | null
  applicationName: string | null
  facilityName: string | null
  tagLine: string | null
  tenantLogo: TenantLogo | null
  tenantDarkLogo: TenantLogo | null
  tenantTitleIcon: TenantLogo | null
  tenantDarkTitleIcon: TenantLogo | null
  primaryColor: string | null
  secondaryColor: string | null
  hipaaCoveredEntity: boolean
  organization: TenantOrganization | null
}

export interface TenantConfigResult {
  success: boolean
  data?: TenantConfig
  error?: string
}

// ============================================================================
// API Functions
// ============================================================================

/**
 * Fetches tenant sys-config for the given tenant ID.
 * Returns the first item from the response array (the API always returns an array).
 */
export async function fetchTenantConfig(tenantId: number): Promise<TenantConfigResult> {
  try {
    const baseUrl = getOneHealthBaseUrl()
    const url = `${baseUrl}/api/v2/tenant/sys-config?${encodeURIComponent("Tenant IDs")}=${tenantId}&includeAllRelations=true`

    const response = await authFetch(url, { method: "GET" })

    if (!response.ok) {
      const errorText = await response.text()
      console.error("[1health API] fetchTenantConfig error:", response.status, errorText)
      return { success: false, error: `Failed to fetch tenant config: ${response.status}` }
    }

    const data = await response.json()

    // API returns an array; take the first element
    const config = Array.isArray(data) ? data[0] : data
    if (!config) {
      return { success: false, error: "No tenant configuration found" }
    }

    return { success: true, data: config as TenantConfig }
  } catch (error) {
    console.error("[1health API] fetchTenantConfig exception:", error)
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" }
  }
}
