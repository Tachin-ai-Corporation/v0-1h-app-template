# 1health App Starter

A greenfield starter template for building front-end applications on top of the 1health platform using Next.js and v0.

## What's Included

- **Authentication** -- LPL-based SSO with environment selection (Demo/Prod) and automatic token refresh
- **API Layer** -- `authFetch()` wrapper for all authenticated 1health API calls
- **Session Context** -- `useSession()` provides cached user + tenant data to all components (fetched once on mount)
- **Settings Page** -- Displays organization info, user account, and token management
- **Documentation** -- Architecture docs for auth, API patterns, and debugging

## Project Structure

```
app/
  api/token/         # Server-side LPL decryption and token exchange
  auth/              # Authentication page with environment selector
  page.tsx           # Auth guard, redirects to auth or renders app
  layout.tsx         # Root layout with providers (dark mode only)

components/
  home-page-client.tsx  # Main client entry point (add pages here)
  settings-page.tsx     # User account info + token management (current home page)
  auth-exit-dialog.tsx  # Dialog for returning to 1health portal
  ui/                   # shadcn/ui components

contexts/
  session-context.tsx     # SessionProvider / useSession() - cached user + tenant data
  navigation-context.tsx  # Client-side navigation state and modal management

lib/
  auth-client.ts     # Client-side auth: authFetch(), refreshToken(), cookies
  auth-server.ts     # Server-side auth helpers
  api/
    config.ts        # API version docs and default headers
    query.ts         # Generic query API
    user.ts          # Current user info (fetchMyself, isSystemAdmin)
    tenant.ts        # Tenant/org config (fetchTenantConfig)

hooks/
  use-session-expired.ts    # Session expiry detection

docs/
  AUTH-ARCHITECTURE.md   # Authentication flow documentation
  ACTION-PATTERNS.md     # API call patterns and examples
  README-DEBUGGER.md     # API debug logging documentation
```

## Environment Variables

| Variable | Description |
|---|---|
| `APP_ID_DEMO` / `APP_ID_PROD` | Application ID for demo/production environments |
| `NEXT_PUBLIC_1H_URL_DEMO` / `NEXT_PUBLIC_1H_URL_PROD` | 1health platform base URL per environment |
| `NEXT_PUBLIC_DEFAULT_LAUNCH_REDIRECT_ROUTE` | Post-authentication redirect target |
| `NEXT_PUBLIC_ENABLE_DEBUG_STREAM` | Enable API debug logging |
| `ONEHEALTH_SECRET_KEY_DEMO` / `ONEHEALTH_SECRET_KEY_PROD` | Server-side LPL decryption key per environment |

## Quick Start

### 1. Add API Functions

Create API modules in `lib/api/` using `authFetch()` (see `lib/api/user.ts` as an example):

```typescript
// lib/api/my-feature.ts
import { authFetch, getOneHealthBaseUrl } from "@/lib/auth-client"

export async function fetchMyData() {
  const baseUrl = getOneHealthBaseUrl()
  const response = await authFetch(`${baseUrl}/api/v3/my-endpoint`)
  if (!response.ok) throw new Error(`API error: ${response.status}`)
  return response.json()
}
```

### 2. Build Your Pages

Create components and wire them into `home-page-client.tsx`. The current single-page setup renders `SettingsPage` as the home page -- expand from there by adding routing logic (navigation context or Next.js routes).

## Documentation

- `docs/AUTH-ARCHITECTURE.md` -- Authentication flow, environment selection, and token management
- `docs/ACTION-PATTERNS.md` -- API call patterns, `authFetch()` usage, and SWR integration
- `docs/README-DEBUGGER.md` -- API debug logging and console output
