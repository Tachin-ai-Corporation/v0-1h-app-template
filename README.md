# 1health App Starter

A greenfield starter template for building front-end applications on top of the 1health platform using Next.js and v0.

## What's Included

- **Authentication** -- LPL-based SSO with automatic token refresh and session management
- **API Layer** -- `authFetch()` wrapper for all authenticated 1health API calls
- **Navigation** -- SPA-style client-side routing with browser history support
- **App Shell** -- Configurable layout with sidebar navigation, header, and theme toggle
- **Settings Page** -- Displays user account info and token management
- **Documentation** -- Architecture docs for auth, API patterns, and debugging

## Project Structure

```
app/
  api/token/         # Server-side LPL decryption and token exchange
  auth/              # Authentication page (LPL entry point)
  page.tsx           # Auth guard, redirects to auth or renders app
  layout.tsx         # Root layout with providers

components/
  app-shell.tsx      # Main layout shell with sidebar + header
  header.tsx         # Configurable app header
  home-page-client.tsx  # Main client-side routing (register pages here)
  settings-page.tsx  # User account info + token management
  pages/
    home-page.tsx    # Starter home page (replace with your own)
  ui/                # shadcn/ui components

contexts/
  navigation-context.tsx  # Client-side navigation state

lib/
  auth-client.ts     # Client-side auth: authFetch(), refreshToken(), cookies
  auth-server.ts     # Server-side auth: LPL decryption
  api/
    config.ts        # API version and endpoint configuration
    index.ts         # Barrel exports
    query.ts         # Generic query API
    types.ts         # Shared TypeScript types
    user.ts          # Current user info (fetchMyself, isSystemAdmin)
  hooks/
    use-fetch.ts     # SWR-based data fetching hook

hooks/
  use-session-expired.ts  # Session expiry detection
  use-modal-back-button.ts  # Modal back-button handling

docs/
  AUTH-ARCHITECTURE.md   # Authentication flow documentation
  ACTION-PATTERNS.md     # API call patterns and examples
  README-DEBUGGER.md     # API debug logging documentation
```

## Environment Variables

| Variable | Description |
|---|---|
| `APP_ID_DEMO` / `APP_ID_PROD` | Application ID for demo/production environments |
| `NEXT_PUBLIC_1H_URL_DEMO` / `NEXT_PUBLIC_1H_URL_PROD` | 1health platform base URL |
| `NEXT_PUBLIC_DEFAULT_LAUNCH_REDIRECT_ROUTE` | Post-authentication redirect target |
| `NEXT_PUBLIC_ENABLE_DEBUG_STREAM` | Enable API debug logging |
| `ONEHEALTH_SECRET_KEY_DEMO` / `ONEHEALTH_SECRET_KEY_PROD` | Server-side LPL decryption key |

## Quick Start

### 1. Add a New Page

Create a component in `components/pages/`:

```tsx
// components/pages/my-page.tsx
"use client"

export function MyPage() {
  return <div className="p-6">My new page</div>
}
```

### 2. Register the Page

In `components/home-page-client.tsx`, add a nav item and a case in the view switch:

```tsx
import { FileText } from "lucide-react"
import { MyPage } from "@/components/pages/my-page"

const navItems: NavItem[] = [
  { name: "Home", key: "home", icon: Home },
  { name: "My Page", key: "my-page", icon: FileText },  // Add this
  { name: "Settings", key: "settings", icon: Settings },
]

const renderCurrentPage = () => {
  switch (currentView) {
    case "my-page":
      return <MyPage />  // Add this
    case "settings":
      return <SettingsPage />
    case "home":
    default:
      return <StarterHomePage />
  }
}
```

### 3. Add API Functions

Create API modules in `lib/api/` using `authFetch()`:

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

## Documentation

- `docs/AUTH-ARCHITECTURE.md` -- Authentication flow and token management
- `docs/ACTION-PATTERNS.md` -- API call patterns, `authFetch()` usage, and SWR integration
- `docs/README-DEBUGGER.md` -- API debug logging and console output
