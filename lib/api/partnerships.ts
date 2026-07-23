/**
 * =============================================================================
 * 1health API — partner organizations
 * =============================================================================
 *
 * Lists the tenant's partner organizations. Mainly used to resolve the
 * `partnerOrgId` you need when sharing a campaign (see campaign.shareCampaign*)
 * or a journey with a partner.
 *
 *   GET /api/v2/organization/partnership?partnershipStatus=Approved&searchText=&relKeys=…
 *
 * `relKeys` selects which partnership relationship types to include; the valid
 * keys are platform/domain-specific — pass the ones your tenant uses.
 * =============================================================================
 */

import { callApi, type ApiResponse } from "./client"
import { endpoints } from "./config"

export interface PartnerOrganization {
  id: number
  name: string
  tenantId: number
  shortOrganizationName?: string
  type?: string[]
  isClaimed?: boolean
  [key: string]: unknown
}

export interface Partnership {
  organization: PartnerOrganization
  direction?: string
  partnershipStatus?: string
}

export interface PartnershipsPage {
  data: Partnership[]
  totalElements?: number
  totalPages?: number
  pageNumber?: number
  [key: string]: unknown
}

export interface FetchPartnershipsOptions {
  searchText?: string
  page?: number
  size?: number
  /** Partnership status filter, e.g. "Approved". */
  status?: string
  /** Which relationship types to include (platform-specific keys). */
  relKeys?: string[]
}

/** List partner organizations (default: approved). */
export async function fetchPartnerships(
  options: FetchPartnershipsOptions = {},
): Promise<ApiResponse<PartnershipsPage>> {
  const { searchText = "", page = 0, size = 12, status = "Approved", relKeys = [] } = options
  const params = new URLSearchParams({
    page: String(page),
    size: String(size),
    partnershipStatus: status,
    searchText,
  })
  for (const key of relKeys) params.append("relKeys", key)
  return callApi<PartnershipsPage>(
    "partnerships/fetchPartnerships",
    `${endpoints.partnerships()}?${params.toString()}`,
  )
}
