/**
 * Query Actions - Shared Types
 *
 * Common types used across all query action files.
 *
 * QUERY FILTER OPERATORS:
 * The 1health /api/v2/query endpoint only supports these filter operators:
 * - == (equals, exact match)
 * - =in= (in list, e.g. status=in=("active","pending"))
 *
 * NOT SUPPORTED:
 * - =like= (wildcard/partial match)
 * - =gt=, =lt=, =ge=, =le= (comparison operators)
 * - =ne= (not equals)
 */

/**
 * External system ID record from ImportResultRecord + ExternalIntegrationConfiguration
 */
export interface ExternalSystemId {
  id: number
  externalId: string
  systemName: string
}

/**
 * Organization contact point data
 */
export interface OrganizationContactPoint {
  id: number
  type: string
  name: string
  value: string
  phoneNumberRegion?: string
  verifiedNote?: string
  verifiedDate?: string
  customData?: Record<string, any>
}

/**
 * Result of fetching organization contact points
 */
export interface OrganizationContactPointsResult {
  contactPoints: OrganizationContactPoint[]
  primaryFax: OrganizationContactPoint | null
}

/**
 * Generic query response structure from /api/v2/query
 */
export interface QueryResponse {
  data?: InstanceData[]
  error?: string
}

/**
 * Instance data from query response
 */
export interface InstanceData {
  instanceId: number
  attributes: Record<string, any>
}

/**
 * Generic result type for query actions
 * Allows returning SESSION_EXPIRED and other errors to the client
 */
export interface QueryResult<T> {
  success: boolean
  data?: T
  error?: string
}
