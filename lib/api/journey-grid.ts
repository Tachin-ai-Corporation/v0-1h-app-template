/**
 * Client-side Journey Grid API
 *
 * Replaces: app/actions/journey-grid-actions.ts
 */

import { authFetch, getOneHealthBaseUrl, setWorkflowOwnerTenantIdCookie } from "@/lib/auth-client"
import type { JourneyGridResponse, OrderByCondition, FilterByCondition } from "@/lib/api/types"
import { API_CONFIG } from "@/lib/api/config"

const COLUMN_TO_FILTER_KEY_MAP: Record<string, string> = {
  myOrganizationUserAssignments: "myOrganizationUserAssignmentName",
  partnerOrganizationAssignments: "partnerOrganizationAssignmentName",
  labOrganizations: "labOrganizationName",
  healthcareOrganizations: "healthcareOrganizationName",
  goToMarketOrganizations: "goToMarketOrganizationName",
  supplierOrganizations: "supplierOrganizationName",
  tags: "tagId",
  partnerTags: "partnerTagId",
}

async function callJourneyAPI(
  campaignId: string,
  page: number,
  limit: number,
  additionalFilters: FilterByCondition[] = [],
  orderBy: OrderByCondition[] = [],
  columnFilters: Record<string, string> = {},
  columnTypes: Record<string, string> = {},
): Promise<JourneyGridResponse> {
  const baseUrl = getOneHealthBaseUrl()
  const url = `${baseUrl}${API_CONFIG.endpoints.journeyGrid}?page=${page}&limit=${limit}&size=${limit}`

  const filterBy: FilterByCondition[] = [
    { key: "workflowCampaignId", value: campaignId, operator: "equals" },
    ...additionalFilters,
  ]

  Object.entries(columnFilters).forEach(([key, value]) => {
    if (!value || value === "__ALL__" || value.trim() === "") return

    if (value === "__NONE__") {
      const filterKey = COLUMN_TO_FILTER_KEY_MAP[key] || key
      filterBy.push({ key: filterKey, value: "__IMPOSSIBLE_VALUE_THAT_MATCHES_NOTHING__", operator: "equals" })
      return
    }

    const columnType = columnTypes[key] || "text"
    let operator: string
    const filterValue: string = value.trim()

    if (columnType === "boolean") {
      operator = "equals"
    } else if (columnType === "select") {
      operator = "equals"
    } else if (columnType === "multiSelect") {
      const decodedValues = filterValue
        .split(",")
        .map((v) => decodeURIComponent(v.trim()))
        .filter((v) => v.length > 0)

      if (decodedValues.length === 1) {
        const filterKey = COLUMN_TO_FILTER_KEY_MAP[key] || key
        filterBy.push({ key: filterKey, value: decodedValues[0], operator: "contains" })
      }
      return
    } else if (columnType === "date") {
      const [dateOp, dates] = value.split(":")
      if (dateOp && dates) {
        const filterKey = COLUMN_TO_FILTER_KEY_MAP[key] || key
        const operatorMap: Record<string, string> = {
          before: "lessThan",
          after: "greaterThan",
          equals: "equals",
        }

        if (dateOp === "between") {
          const [startDate, endDate] = dates.split(",")
          if (startDate && endDate) {
            filterBy.push({ key: filterKey, value: startDate.trim(), operator: "greaterThan" })
            filterBy.push({ key: filterKey, value: endDate.trim(), operator: "lessThan" })
          }
        } else {
          const apiOperator = operatorMap[dateOp] || "equals"
          filterBy.push({ key: filterKey, value: dates.trim(), operator: apiOperator })
        }
        return
      } else {
        operator = "contains"
      }
    } else {
      if (value.includes(",")) {
        const values = value
          .split(",")
          .map((v) => v.trim())
          .filter((v) => v.length > 0)
        if (values.length > 1) {
          const filterKey = COLUMN_TO_FILTER_KEY_MAP[key] || key
          const inValue = `(${values.join(",")})`
          filterBy.push({ key: filterKey, value: inValue, operator: "in" })
          return
        }
      }
      operator = "contains"
    }

    const filterKey = COLUMN_TO_FILTER_KEY_MAP[key] || key
    filterBy.push({ key: filterKey, value: filterValue, operator })
  })

  const response = await authFetch(url, {
    method: "POST",
    body: JSON.stringify({
      filterBy,
      orderBy: orderBy.length > 0 ? orderBy : [{ key: "updated", order: "DESC" }],
    }),
  })

  if (!response.ok) {
    const errorBody = await response.text()
    console.error("[v0] API error:", response.status, errorBody)
    throw new Error(`API request failed with status ${response.status}`)
  }

  const data = await response.json()

  if (data.data && data.data.length > 0 && data.data[0].templateOwnerOrganizationTenantId) {
    const tenantId = data.data[0].templateOwnerOrganizationTenantId
    setWorkflowOwnerTenantIdCookie(tenantId)
  }

  return data
}

export interface FetchJourneyGridParams {
  campaignId: string
  page?: number
  pageSize?: number
  filters?: Record<string, string>
  columnTypes?: Record<string, string>
  sortColumn?: string | null
  sortDirection?: "asc" | "desc"
  additionalFilters?: FilterByCondition[]
}

export interface FetchJourneyGridResult {
  success: boolean
  data: any[]
  totalElements: number
  totalPages: number
  error?: string
}

export async function fetchJourneyGrid(params: FetchJourneyGridParams): Promise<FetchJourneyGridResult> {
  try {
    const {
      campaignId,
      page = 0,
      pageSize = 25,
      filters = {},
      columnTypes = {},
      sortColumn,
      sortDirection = "desc",
      additionalFilters = [],
    } = params

    if (!campaignId) {
      return { success: false, error: "Campaign ID is required", data: [], totalElements: 0, totalPages: 0 }
    }

    const orderBy: OrderByCondition[] = sortColumn
      ? [{ key: sortColumn, order: sortDirection.toUpperCase() as "ASC" | "DESC" }]
      : [{ key: "updated", order: "DESC" }]

    const response = await callJourneyAPI(campaignId, page, pageSize, additionalFilters, orderBy, filters, columnTypes)

    return {
      success: true,
      data: response.data,
      totalElements: response.totalElements,
      totalPages: response.totalPages,
    }
  } catch (error) {
    console.error("Error fetching journey grid data:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch grid data",
      data: [],
      totalElements: 0,
      totalPages: 0,
    }
  }
}

export async function fetchJourneyByMemberAndCampaign(
  memberId: string,
  campaignId: string,
): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const baseUrl = getOneHealthBaseUrl()
    const url = `${baseUrl}${API_CONFIG.endpoints.journeyGrid}?page=0&limit=1&size=1`

    const filterBy: FilterByCondition[] = [
      { key: "workflowCampaignId", value: campaignId, operator: "equals" },
      { key: "status", value: "In Progress", operator: "equals" },
      { key: "memberId", value: Number.parseInt(memberId, 10), operator: "equals" },
    ]

    const response = await authFetch(url, {
      method: "POST",
      body: JSON.stringify({ filterBy, orderBy: [] }),
    })

    if (!response.ok) {
      const errorBody = await response.text()
      console.error("[v0] fetchJourneyByMemberAndCampaign error:", response.status, errorBody)
      throw new Error(`API request failed with status ${response.status}`)
    }

    const data = await response.json()
    return { success: true, data: data.data && data.data.length > 0 ? data.data[0] : null }
  } catch (error) {
    console.error("Error fetching journey by member and campaign:", error)
    return { success: false, error: error instanceof Error ? error.message : "Failed to fetch journey data" }
  }
}

export async function fetchJourneysByCampaign(
  memberId: string,
  campaignId: string,
): Promise<{ success: boolean; data?: any[]; error?: string }> {
  try {
    const baseUrl = getOneHealthBaseUrl()
    const url = `${baseUrl}${API_CONFIG.endpoints.journeyGrid}?page=0&limit=100&size=100`

    const filterBy: FilterByCondition[] = [
      { key: "workflowCampaignId", value: campaignId, operator: "equals" },
      { key: "memberId", value: Number.parseInt(memberId, 10), operator: "equals" },
    ]

    const response = await authFetch(url, {
      method: "POST",
      body: JSON.stringify({ filterBy, orderBy: [{ key: "updated", order: "DESC" }] }),
    })

    if (!response.ok) {
      const errorBody = await response.text()
      console.error("[v0] fetchJourneysByCampaign error:", response.status, errorBody)
      throw new Error(`API request failed with status ${response.status}`)
    }

    const data = await response.json()
    return { success: true, data: data.data || [] }
  } catch (error) {
    console.error("Error fetching journeys by campaign:", error)
    return { success: false, error: error instanceof Error ? error.message : "Failed to fetch journey data" }
  }
}

export const fetchGridData = fetchJourneyGrid
