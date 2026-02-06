/**
 * =============================================================================
 * 1HEALTH API CONFIGURATION
 * =============================================================================
 *
 * The 1health platform exposes multiple API versions. The version must be
 * included as part of the request path when building URLs:
 *
 *   /api/v1/...   - Legacy endpoints
 *   /api/v2/...   - Current stable endpoints (user, query, etc.)
 *   /api/v3/...   - Latest endpoints
 *   /api/graphql  - GraphQL endpoint (no version prefix)
 *
 * Example usage with authFetch:
 *
 *   const baseUrl = getOneHealthBaseUrl()
 *   const response = await authFetch(`${baseUrl}/api/v2/user/myself`)
 *
 * =============================================================================
 */

// Default headers for JSON API requests
export const DEFAULT_HEADERS = {
  Accept: "application/json, text/plain, */*",
  "Content-Type": "application/json",
} as const
