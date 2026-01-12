/**
 * Query Actions - Index
 *
 * Re-exports all query actions for convenient importing.
 *
 * Usage:
 *   import { getExternalSystemIds, searchOrganizationsAction } from "@/app/actions/query"
 */

// Types
export type {
  ExternalSystemId,
  OrganizationContactPoint,
  OrganizationContactPointsResult,
  QueryResponse,
  InstanceData,
} from "./types"

// Person queries
export { getExternalSystemIds, getPersonCustomData } from "./query-person"

// Organization queries
export {
  searchOrganizationsAction,
  findOrganizationContactPoints,
  fetchBrandOrganizations,
} from "./query-organization"
