// Journey API Response Types
export interface JourneyTag {
  name: string
  id: number
}

export interface Organization {
  name: string
  id: number
  tenantId: number
}

export interface ExternalSystem {
  name: string
  id: number
  externalSystemId: string
}

export interface JourneyData {
  id: number
  created: string
  updated: string
  isUat: boolean
  status: string
  type: string
  workflowCategory: string
  workflowStepInProgressCanSubmit: boolean
  workflowStepInProgressId: number
  workflowStepInProgressName: string
  workflowStepInProgressTime: number
  workflowStepInProgressType: string
  nextWorkflowStepId: number | null
  nextWorkflowStepName: string | null
  nextWorkflowStepDueDate: string | null
  timeLeftUntilDue: string | null
  workflowCampaignId: number
  memberId: number
  memberSex: string
  memberRace: string
  memberEmail: string | null
  memberPhone: string
  memberPhoneStatus: string | null
  memberLastName: string
  memberFirstName: string
  memberEthnicity: string
  memberDateOfBirth: string
  memberCounty: string
  memberCountry: string
  memberPostalCode: string
  memberAddressCity: string
  memberAddressStreet: string
  memberInsuranceContractId: string | null
  memberInsurancePolicyId: string | null
  templateOwnerOrganizationId: number
  templateOwnerOrganizationName: string
  templateOwnerOrganizationTenantId: number
  templateOwnerOrganizationLogoPublicUrl: string
  orderId: number | null
  orderPatientId: number | null
  orderPatientSex: string | null
  orderPatientRace: string | null
  orderPatientEmail: string | null
  orderPatientPhone: string | null
  orderPatientLastName: string | null
  orderPatientFirstName: string | null
  orderPatientEthnicity: string | null
  orderPatientDateOfBirth: string | null
  orderGtmOrganizationId: number | null
  orderGtmOrganizationName: string | null
  orderGtmOrganizationTenantId: number | null
  orderGtmOrganizationLogoPublicUrl: string | null
  brandedTemplateOwnerOrganizationId: number | null
  brandedTemplateOwnerOrganizationName: string | null
  brandedTemplateOwnerOrganizationTenantId: number | null
  brandedTemplateOwnerOrganizationLogoPublicUrl: string | null
  orderOrderingOrganizationId: number
  orderOrderingOrganizationName: string
  orderOrderingOrganizationTenantId: number
  comments: number
  tags: JourneyTag[]
  partnerTags: any | null
  labOrganizations: Organization[]
  healthcareOrganizations: Organization[]
  goToMarketOrganizations: Organization[]
  supplierOrganizations: Organization[]
  externalSystems: ExternalSystem[]
  partnerOrganizationAssignments: any[]
  myOrganizationUserAssignments: any[]
}

export interface JourneyGridResponse {
  data: JourneyData[]
  pageNumber: number
  pageSize: number
  offset: number
  emptyPage: boolean
  firstPage: boolean
  lastPage: boolean
  numberOfElements: number
  totalElements: number
  totalPages: number
}

// Journey API Request Types
export interface FilterCondition {
  key: string
  value: string | number
  operator: "equals" | "contains" | "greaterThan" | "lessThan" | "in"
}

export interface OrderByCondition {
  key: string
  order: "ASC" | "DESC"
}

export interface JourneyGridRequest {
  filterBy: FilterCondition[]
  orderBy: OrderByCondition[]
}

export interface JourneyGridParams {
  page?: number
  limit?: number
  size?: number
}

// API Error Types
export interface ApiError {
  message: string
  status?: number
  code?: string
  details?: any
}

// Export-related types
export interface ExportRequest {
  filterBy: FilterCondition[]
  orderBy: OrderByCondition[]
}

export interface SysProcessLogTrack {
  id: number
  SysFile: {
    id: number
    publicUrl: string
  }
}

export interface SysProcessLog {
  id: number
  status: string[]
  totalRecords: number
  processedRecords: number
  successRecords: number
  failedRecords: number
  SysProcessLogTracksExportedFile: {
    relationsCount: number
    relations: SysProcessLogTrack[]
  }
}

export interface ExportResponse {
  data: {
    SysProcessLog: {
      records: SysProcessLog[]
      recordsCount: number
    }
  }
}

export interface ExportStatusResponse {
  data: {
    SysProcessLog: {
      records: SysProcessLog[]
      recordsCount: number
    }
  }
}

export type FilterType = "text" | "boolean" | "dateRange"

// Re-export Column for backwards compatibility
export type { Column as ColumnDef } from "@/components/data-grid/types"
