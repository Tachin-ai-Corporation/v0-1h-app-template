# Client-Side API Patterns

This document describes patterns for making 1health API calls from the client side.

## Architecture Overview

All 1health API calls are made directly from the browser using `authFetch()` from `lib/auth-client.ts`. The only server-side operation is the initial LPL decryption and token exchange.

```
┌─────────────────────────────────────────────────────────────────┐
│                      SERVER-SIDE (Minimal)                      │
├─────────────────────────────────────────────────────────────────┤
│  /api/token (POST)                                              │
│    - Decrypts LPL using ONEHEALTH_SECRET_KEY_DEMO or _PROD      │
│    - Environment selected by user on /auth page                 │
│    - Exchanges one-time code for OAuth tokens                   │
│    - Sets cookies (access_token, refresh_token, environment)    │
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
│    - user.ts - Current user info (fetchMyself)                  │
│    - tenant.ts - Tenant/org config (fetchTenantConfig)          │
│                                                                 │
│  contexts/session-context.tsx                                    │
│    - SessionProvider / useSession() - Cached user + tenant data │
└─────────────────────────────────────────────────────────────────┘
```

## Using authFetch

`authFetch()` is the core utility for all authenticated API calls. It automatically attaches the Bearer token, handles 401 responses with transparent token refresh, and throws `SessionExpiredError` when refresh fails.

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

## Creating New API Modules

When adding new API functionality, create a new file in `lib/api/`. Follow the pattern established in `lib/api/user.ts`:

```typescript
// lib/api/my-feature.ts
import { authFetch, getOneHealthBaseUrl } from "@/lib/auth-client"

export interface MyData {
  id: number
  name: string
}

export interface MyDataResult {
  success: boolean
  data?: MyData[]
  error?: string
}

export async function fetchMyData(): Promise<MyDataResult> {
  try {
    const baseUrl = getOneHealthBaseUrl()
    const url = `${baseUrl}/api/v3/my-endpoint`

    const response = await authFetch(url, { method: "GET" })

    if (!response.ok) {
      const errorText = await response.text()
      return { success: false, error: `Failed: ${response.status}` }
    }

    const data = await response.json()
    return { success: true, data }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" }
  }
}
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
```

## Session Context (User + Tenant Data)

The `SessionProvider` in `contexts/session-context.tsx` fetches user and tenant data once on mount
and makes it available to all descendant components via `useSession()`. This avoids repeated API calls.

```typescript
import { useSession } from "@/contexts/session-context"

function MyComponent() {
  const { user, tenant, isLoading, error, refresh } = useSession()

  if (isLoading) return <div>Loading...</div>
  if (!user) return null

  return (
    <div>
      <p>Hello, {user.firstName}!</p>
      <p>Org: {tenant?.tenantName}</p>
    </div>
  )
}
```

The `SessionProvider` wraps the app in `home-page-client.tsx`. Available data:
- `user` -- `UserInfo` from `/api/v2/user/myself` (name, email, roles, tenant context, etc.)
- `tenant` -- `TenantConfig` from `/api/v2/tenant/sys-config` (org name, logo, brand colors, contacts, address, etc.)
- `refresh()` -- Re-fetches both user and tenant data

## Data Fetching in Components

For data fetching in components, use the `swr` package (included in dependencies) with `authFetch`:

```typescript
import useSWR from "swr"
import { authFetch, getOneHealthBaseUrl } from "@/lib/auth-client"

function MyComponent() {
  const { data, error, isLoading } = useSWR("my-data-key", async () => {
    const baseUrl = getOneHealthBaseUrl()
    const response = await authFetch(`${baseUrl}/api/v2/some-endpoint`)
    if (!response.ok) throw new Error(`API error: ${response.status}`)
    return response.json()
  })

  if (isLoading) return <div>Loading...</div>
  if (error) return <div>Error: {error.message}</div>

  return <div>{JSON.stringify(data)}</div>
}
```
