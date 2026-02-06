// API Version and Endpoints Configuration
export const API_CONFIG = {
  version: "v3",
  endpoints: {
    graphql: "/api/graphql",
    users: "/api/v2/user/all",
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
