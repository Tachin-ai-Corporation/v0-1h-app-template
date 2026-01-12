/**
 * Contact Point Actions
 *
 * URL Patterns:
 * - POST /api/v2/organization/partner/{orgId}/contact-point - Create new contact point
 * - POST /api/graphql - Update contact point via GraphQL mutation
 *
 * Purpose: Manage organization contact points (fax numbers, phone numbers)
 *
 * NOTE: For custom data updates on contact points, use:
 * - updateContactPointVerification() from custom-data-actions.ts
 * - updateCustomData() from custom-data-actions.ts
 */

"use server"

import { authFetch, getOneHealthBaseUrl } from "@/lib/auth-server"

/**
 * Format a phone/fax number to the API-required format: +1 (XXX) XXX-XXXX
 *
 * @param value - Raw phone number in any format
 * @returns Formatted phone number string
 */
function formatPhoneForApi(value: string): string {
  // Strip all non-digits
  const digits = value.replace(/\D/g, "")

  // Ensure we have 11 digits with country code
  let normalized = digits
  if (digits.length === 10) {
    normalized = "1" + digits
  } else if (digits.length === 11 && digits.startsWith("1")) {
    normalized = digits
  } else {
    // Return as-is if unexpected format
    return value
  }

  // Format as +1 (XXX) XXX-XXXX
  const country = normalized.slice(0, 1)
  const area = normalized.slice(1, 4)
  const prefix = normalized.slice(4, 7)
  const line = normalized.slice(7, 11)

  return `+${country} (${area}) ${prefix}-${line}`
}

/**
 * Convert a date string to UTC timestamp format for the API
 *
 * @param dateStr - Date string in YYYY-MM-DD format (from client in their timezone)
 * @returns UTC timestamp in ISO format (e.g., "2025-12-21T08:00:00.000Z")
 */
function toUtcTimestamp(dateStr: string): string {
  // Parse the date string and create a Date object
  // The date comes from the client as YYYY-MM-DD, treat it as start of day in UTC
  const date = new Date(dateStr + "T00:00:00.000Z")
  return date.toISOString()
}

/**
 * Create a new contact point for an organization
 *
 * Endpoint: POST /api/v2/organization/partner/{orgId}/contact-point
 *
 * Payload format:
 * {
 *   "type": "Fax",
 *   "name": "Primary Fax",
 *   "value": "+1 (630) 816-5144",  // Must be formatted as +1 (XXX) XXX-XXXX
 *   "phoneNumberRegion": "us",
 *   "verifiedDate": "2025-01-15T00:00:00.000Z",   // Optional - UTC timestamp
 *   "verifiedNote": "Verified by user"  // Optional
 * }
 *
 * Response format:
 * {
 *   "name": "Primary Fax",
 *   "id": 91011964,
 *   "message": "ContactPoint has been created successfully."
 * }
 */
export async function createContactPoint(
  orgId: number,
  type: "Fax" | "Phone",
  name: string,
  value: string,
  verifiedDate?: string,
  verifiedNote?: string,
): Promise<{ success: boolean; data?: { id: number; name: string; message: string }; error?: string }> {
  try {
    const baseUrl = await getOneHealthBaseUrl()
    const url = `${baseUrl}/api/v2/organization/partner/${orgId}/contact-point`

    // Format the phone/fax value to required format
    const formattedValue = formatPhoneForApi(value)

    const payload: Record<string, any> = {
      type,
      name,
      value: formattedValue,
      phoneNumberRegion: "us",
    }

    // Add optional verification fields for Fax type
    if (type === "Fax" && verifiedDate) {
      payload.verifiedDate = toUtcTimestamp(verifiedDate)
      payload.verifiedNote = verifiedNote || "Verified by user"
    }

    console.log("[v0] createContactPoint - URL:", url)
    console.log("[v0] createContactPoint - Payload:", JSON.stringify(payload, null, 2))

    const { response } = await authFetch(url, {
      method: "POST",
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const errorBody = await response.text()
      console.error("[v0] createContactPoint error:", response.status, errorBody)
      return { success: false, error: `API request failed with status ${response.status}: ${errorBody}` }
    }

    const result = await response.json()
    console.log("[v0] createContactPoint - Response:", JSON.stringify(result, null, 2))

    return {
      success: true,
      data: {
        id: result.id,
        name: result.name,
        message: result.message,
      },
    }
  } catch (error) {
    console.error("Error creating contact point:", error)
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" }
  }
}

/**
 * Update a contact point (fax number, verification info)
 */
export async function updateContactPoint(
  contactPointId: number,
  faxNumber: string,
  verifiedDate: string,
  verifiedNote: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const baseUrl = await getOneHealthBaseUrl()
    const url = `${baseUrl}/api/graphql`

    // Format fax number to E.164 format (e.g., +15551234567)
    const digits = faxNumber.replace(/\D/g, "")
    const formattedFax =
      digits.length === 10
        ? `+1${digits}`
        : digits.length === 11 && digits.startsWith("1")
          ? `+${digits}`
          : `+${digits}`

    const { response } = await authFetch(url, {
      method: "POST",
      body: JSON.stringify({
        query: `mutation ($rsql: String!, $maxRecordsToUpdate: Long!, $record: GraphQLUpdateContactPointInput) { 
          UpdateContactPointRecords (rsql: $rsql, maxRecordsToUpdate: $maxRecordsToUpdate, record: $record) { 
            records { id }, 
            recordsCount 
          } 
        }`,
        variables: {
          rsql: `id==${contactPointId}`,
          maxRecordsToUpdate: 1,
          record: {
            type: { replace: "Fax" },
            name: "Primary Fax",
            value: formattedFax,
            phoneNumberRegion: { replace: "us" },
            verifiedDate: verifiedDate,
            verifiedNote: verifiedNote,
          },
        },
      }),
    })

    if (!response.ok) {
      const errorBody = await response.text()
      console.error("[v0] updateContactPoint error:", response.status, errorBody)
      return { success: false, error: `API request failed with status ${response.status}: ${errorBody}` }
    }

    const result = await response.json()

    if (result.errors) {
      return { success: false, error: result.errors.map((e: any) => e.message).join("; ") }
    }

    return { success: true }
  } catch (error) {
    console.error("Error updating contact point:", error)
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" }
  }
}
