# Client-Side API Patterns

This document describes patterns for making 1health API calls from the client side.

## Architecture Overview

All 1health API calls are made directly from the browser using `authFetch()` from `lib/auth-client.ts`. The only server-side operation is the initial LPL decryption and token exchange.

```
┌─────────────────────────────────────────────────────────────────┐
│                      SERVER-SIDE (Minimal)                      │
├─────────────────────────────────────────────────────────────────┤
│  /api/token (POST)                                              │
│    - Decrypts LPL using ONEHEALTH_SECRET_KEY                    │
│    - Exchanges one-time code for OAuth tokens                   │
│    - Sets cookies (access_token, refresh_token)                 │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                      CLIENT-SIDE (All API calls)                │
├─────────────────────────────────────────────────────────────────┤
│  lib/auth-client.ts                                             │
│    - authFetch() - Authenticated fetch wrapper                  │
│    - refreshToken() - Direct token refresh with 1health         │
│    - Cookie utilities                                           │
│                                                                 │
│  lib/api/*.ts                                                   │
│    - patient-search.ts - Patient search API                     │
│    - person.ts - Person CRUD operations                         │
│    - insurance.ts - Insurance operations                        │
│    - type-metadata.ts - Type definitions and metadata           │
│    - query.ts - Generic query API                               │
│    - query-person.ts - Person-specific queries                  │
│    - journey-grid.ts - Journey grid data                        │
│    - user.ts - Current user info                                │
└─────────────────────────────────────────────────────────────────┘
```

## Using authFetch

```typescript
import { authFetch, getOneHealthBaseUrl } from "@/lib/auth-client"

async function fetchData() {
  const baseUrl = getOneHealthBaseUrl()
  const response = await authFetch(`${baseUrl}/api/v2/some-endpoint`, {
    method: "POST",
    body: JSON.stringify({ key: "value" }),
  })
  
  if (!response.ok) {
    throw new Error(`API error: ${response.status}`)
  }
  
  return response.json()
}
```

## API Modules

### Patient Search (`lib/api/patient-search.ts`)

```typescript
import { searchPatients } from "@/lib/api/patient-search"

const results = await searchPatients({
  firstName: "John",
  lastName: "Doe",
  dateOfBirth: "1990-01-01",
})
```

### Type Metadata (`lib/api/type-metadata.ts`)

```typescript
import { fetchAllTypes, fetchTypeDetails } from "@/lib/api/type-metadata"

const types = await fetchAllTypes()
const personType = await fetchTypeDetails("Person")
```

### Generic Query (`lib/api/query.ts`)

```typescript
import { executeQuery } from "@/lib/api/query"

const result = await executeQuery({
  key: "Person",
  attributes: ["id", "firstName", "lastName"],
  filter: "firstName==John",
  limit: 10,
})
```

## Query Relationship Key Format

When building queries with relationships, the relationship key must follow this format:

```
{FromType}.{relKey}.{ToType}
```

**IMPORTANT:** Use the `relKey` from the API response, not a constructed name.

Example:
```
WorkflowTemplate.WorkflowTemplateStepIsRootOfWorkflowTemplate.WorkflowTemplateStep
```

## Token Refresh

Token refresh happens automatically:
1. When `authFetch()` receives a 401 response
2. When manually triggered via `refreshToken()`

```typescript
import { refreshToken } from "@/lib/auth-client"

const success = await refreshToken()
if (!success) {
  // Redirect to login
  window.location.href = "/auth"
}
```

## Error Handling

```typescript
import { authFetch } from "@/lib/auth-client"

try {
  const response = await authFetch(url)
  // Handle response
} catch (error) {
  if (error instanceof Error && error.message === "SESSION_EXPIRED") {
    // Token refresh failed, redirect to login
    window.location.href = "/auth"
  }
  throw error
}
