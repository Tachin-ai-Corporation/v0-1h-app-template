// API Version and Endpoints Configuration
export const API_CONFIG = {
  version: "v3",
  endpoints: {
    journeyGrid: "/api/v3/health/grid/journey",
    exportJourney: "/api/v3/health/grid/journey/export",
    graphql: "/api/graphql",
    users: "/api/v2/user/all",
    assignUsers: "/api/v2/journey/assign-users",
    unassignUsers: "/api/v2/journey/unassign-users",
    updateStatus: "/api/v2/journey/status/bulk",
  },
} as const

// Default Request Configuration
export const DEFAULT_REQUEST_CONFIG = {
  headers: {
    Accept: "application/json, text/plain, */*",
    "Content-Type": "application/json",
  },
  defaultPageSize: 25,
  defaultPage: 0,
} as const
