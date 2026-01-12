/**
 * Query Actions - Organization Entity
 *
 * URL Pattern: POST /api/v2/query
 * Entity Type: Organization
 *
 * Purpose: Query organization-related data via the generic query endpoint
 */

"use server"

import { authFetch, getOneHealthBaseUrl } from "@/lib/auth-server"
import type { OrganizationContactPoint, OrganizationContactPointsResult } from "./types"

/**
 * Search organizations by name
 *
 * Uses direct Organization attributes
 */
export async function searchOrganizationsAction(
  searchTerm: string,
): Promise<{ id: number; name: string; npi?: string }[]> {
  try {
    const baseUrl = await getOneHealthBaseUrl()
    const url = `${baseUrl}/api/v2/query`

    const { response } = await authFetch(url, {
      method: "POST",
      body: JSON.stringify({
        key: "Organization",
        attributes: ["id", "name", "npi"],
        filter: `name=ilike='*${searchTerm}*'`,
        limit: 20,
      }),
    })

    if (!response.ok) {
      console.error("[v0] searchOrganizationsAction error:", response.status)
      return []
    }

    const result = await response.json()

    if (!result.data) return []

    return result.data.map((item: any) => ({
      id: item.instanceId,
      name: item.attributes?.["ROOT.Organization.name"] || "",
      npi: item.attributes?.["ROOT.Organization.npi"] || undefined,
    }))
  } catch (error) {
    console.error("[v0] searchOrganizationsAction exception:", error)
    return []
  }
}

/**
 * Find organization contact points (fax numbers, etc.)
 *
 * Uses relationship: Organization.OrganizationPartnerCanBeReachedAtContactPoint.ContactPoint
 */
export async function findOrganizationContactPoints(orgId: number): Promise<OrganizationContactPointsResult> {
  try {
    const baseUrl = await getOneHealthBaseUrl()
    const url = `${baseUrl}/api/v2/query`

    const requestBody = {
      key: "Organization",
      attributes: ["id", "name"],
      filter: `id==${orgId}`,
      relationships: [
        {
          key: "Organization.OrganizationPartnerCanBeReachedAtContactPoint.ContactPoint",
          attributes: [
            "id",
            "type",
            "name",
            "value",
            "phoneNumberRegion",
            "verifiedNote",
            "verifiedDate",
            "customData",
          ],
          relationAttributes: ["id"],
          filter: "type=in=(Fax)",
          limit: 10,
          offset: 0,
        },
      ],
      limit: 1,
    }

    console.log("[v0] findOrganizationContactPoints REQUEST URL:", url)
    console.log("[v0] findOrganizationContactPoints REQUEST BODY:", JSON.stringify(requestBody, null, 2))

    const { response } = await authFetch(url, {
      method: "POST",
      body: JSON.stringify(requestBody),
    })

    console.log("[v0] findOrganizationContactPoints RESPONSE STATUS:", response.status)

    if (!response.ok) {
      console.error("[v0] findOrganizationContactPoints error:", response.status)
      return { contactPoints: [], primaryFax: null }
    }

    const result = await response.json()
    console.log("[v0] findOrganizationContactPoints RESPONSE BODY:", JSON.stringify(result, null, 2))

    if (!result.data || result.data.length === 0) {
      console.log("[v0] findOrganizationContactPoints: No data returned")
      return { contactPoints: [], primaryFax: null }
    }

    const relationshipKey = "Organization.OrganizationPartnerCanBeReachedAtContactPoint.ContactPoint"
    const attrPrefix = "OrganizationPartnerCanBeReachedAtContactPoint.ContactPoint."
    const relationships = result.data[0].relationships?.[relationshipKey] || []

    console.log("[v0] findOrganizationContactPoints RELATIONSHIPS:", JSON.stringify(relationships, null, 2))

    const contactPoints: OrganizationContactPoint[] = relationships
      .map((rel: any) => {
        const attrs = rel.instance?.attributes || {}

        // Extract type - it's an array, get first value
        const typeValue = attrs[`${attrPrefix}type`]
        const type = Array.isArray(typeValue) ? typeValue[0] : typeValue || ""

        return {
          id: attrs[`${attrPrefix}id`] || 0,
          type,
          name: attrs[`${attrPrefix}name`] || "",
          value: attrs[`${attrPrefix}value`] || "",
          verifiedNote: attrs[`${attrPrefix}verifiedNote`] || "",
          verifiedDate: attrs[`${attrPrefix}verifiedDate`] || "",
          customData: attrs[`${attrPrefix}customData`] || {},
        }
      })
      .filter((cp: OrganizationContactPoint) => cp.id > 0)

    console.log("[v0] findOrganizationContactPoints PARSED CONTACT POINTS:", JSON.stringify(contactPoints, null, 2))

    // Find primary fax
    const primaryFax = contactPoints.find((cp) => cp.type === "Fax" && cp.name === "Primary Fax") || null
    console.log("[v0] findOrganizationContactPoints PRIMARY FAX:", JSON.stringify(primaryFax, null, 2))

    return {
      contactPoints,
      primaryFax: primaryFax
        ? {
            id: primaryFax.id,
            type: primaryFax.type,
            name: primaryFax.name,
            value: primaryFax.value,
            verifiedNote: primaryFax.verifiedNote,
            verifiedDate: primaryFax.verifiedDate,
            customData: primaryFax.customData,
          }
        : null,
    }
  } catch (error) {
    console.error("[v0] findOrganizationContactPoints exception:", error)
    return { contactPoints: [], primaryFax: null }
  }
}

/**
 * Fetch brand organizations for an organization
 *
 * Uses relationship: Organization.OrganizationHasBrandOrganization.Organization
 */
export async function fetchBrandOrganizations(
  orgId: number,
): Promise<{ id: number; name: string; customData?: Record<string, any> }[]> {
  try {
    const baseUrl = await getOneHealthBaseUrl()
    const url = `${baseUrl}/api/v2/query`

    const { response } = await authFetch(url, {
      method: "POST",
      body: JSON.stringify({
        key: "Organization",
        attributes: ["id"],
        relationships: [
          {
            key: "Organization.OrganizationHasBrandOrganization.Organization",
            attributes: ["id", "name", "customData"],
            relationAttributes: ["id"],
            limit: 50,
          },
        ],
        filter: `id==${orgId}`,
        limit: 1,
      }),
    })

    if (!response.ok) {
      console.error("[v0] fetchBrandOrganizations error:", response.status)
      return []
    }

    const result = await response.json()

    if (!result.data || result.data.length === 0) {
      return []
    }

    const attrs = result.data[0].attributes || {}
    const prefix = "OrganizationHasBrandOrganization.Organization."

    const brandOrgs: { id: number; name: string; customData?: Record<string, any> }[] = []
    const orgsMap = new Map<number, { id: number; name: string; customData?: Record<string, any> }>()

    for (const [key, value] of Object.entries(attrs)) {
      if (key.startsWith(prefix)) {
        const attrName = key.replace(prefix, "")
        const indexMatch = attrName.match(/^(\w+)\[(\d+)\]$/)

        if (indexMatch) {
          const [, attr, indexStr] = indexMatch
          const index = Number.parseInt(indexStr, 10)
          if (!orgsMap.has(index)) {
            orgsMap.set(index, { id: 0, name: "" })
          }
          const org = orgsMap.get(index)!
          if (attr === "id") org.id = value as number
          else if (attr === "name") org.name = value as string
          else if (attr === "customData") org.customData = value as Record<string, any>
        } else {
          if (!orgsMap.has(0)) {
            orgsMap.set(0, { id: 0, name: "" })
          }
          const org = orgsMap.get(0)!
          if (attrName === "id") org.id = value as number
          else if (attrName === "name") org.name = value as string
          else if (attrName === "customData") org.customData = value as Record<string, any>
        }
      }
    }

    return Array.from(orgsMap.values()).filter((org) => org.id > 0)
  } catch (error) {
    console.error("[v0] fetchBrandOrganizations exception:", error)
    return []
  }
}
