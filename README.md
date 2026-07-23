# 1health App Starter

A greenfield starter template for building front-end applications on top of the 1health platform using Next.js and v0.

## What's Included

- **Authentication** -- LPL-based SSO with environment selection (Demo/Prod) and automatic token refresh
- **API Layer** -- `authFetch()` wrapper for all authenticated 1health API calls
- **1health API Patterns** -- Generic, typed modules for the platform's core engines: runtime schema discovery, `/query`, custom data, workflows (campaigns, journeys, steps), and self-bootstrap provisioning (an app can install its own workflow template + campaign on any tenant) -- plus a data-driven step-form renderer. See `docs/api/`
- **Session Context** -- `useSession()` provides cached user + tenant data to all components (fetched once on mount)
- **Settings Page** -- Displays organization info, user account, and token management
- **Design System** -- 1health design tokens (color, type, spacing, motion) with a brandable three-tier structure and light/dark themes
- **Documentation** -- Architecture docs for auth, API patterns, debugging, and the design system

## Project Structure

```
app/
  api/token/         # Server-side LPL decryption and token exchange
  auth/              # Authentication page with environment selector
  page.tsx           # Auth guard, redirects to auth or renders app
  layout.tsx         # Root layout with providers

components/
  home-page-client.tsx  # Main client entry point (add pages here)
  settings-page.tsx     # User account info + token management (current home page)
  auth-exit-dialog.tsx  # Dialog for returning to 1health portal
  workflow/             # Reusable workflow UI (dynamic-step-form.tsx)
  ui/                   # shadcn/ui components

contexts/
  session-context.tsx     # SessionProvider / useSession() - cached user + tenant data
  navigation-context.tsx  # Auth exit dialog state

lib/
  auth-client.ts     # Client-side auth: authFetch(), refreshToken(), cookies
  api/               # 1health API layer (import from "@/lib/api")
    client.ts        # callApi / callApiRaw / ApiResponse envelope
    types.ts         # Shared wire & domain types
    config.ts        # Endpoint paths + RECORD_TYPES / ATTRIBUTES (fill per app)
    schema.ts        # Runtime type/attribute/relationship discovery (+ cache)
    query.ts         # /api/v2/query + RSQL builders + response extractors
    grid.ts          # Grid/list endpoints + fetch-all pagination
    custom-data.ts   # Read/write instance customData
    workflow-template.ts  # Campaign->template resolution + field-by-label
    journey.ts       # Journeys (workflow instances): create/fetch/list/status
    journey-step.ts  # Steps: fetch + the 3 submit recipes + metadata builder
    attachments.ts   # Journey files: documents, upload, download, delete
    comments.ts      # Journey comments
    campaign.ts      # Campaign lifecycle: create/activate/share/list/find
    workflow-provisioning.ts  # Self-bootstrap templates + campaigns (ensureWorkflow)
    step-config.ts   # Edit step config: email notifications + webhooks
    partnerships.ts  # List partner orgs (resolve share targets)
    index.ts         # Barrel export
    user.ts          # Current user info (fetchMyself, isSystemAdmin)
    tenant.ts        # Tenant/org config (fetchTenantConfig)

hooks/
  use-session-expired.ts    # Session expiry detection

docs/
  DESIGN-SYSTEM.md       # Design tokens, rebranding, and UI guidelines
  AUTH-ARCHITECTURE.md   # Authentication flow documentation
  ACTION-PATTERNS.md     # API call patterns and examples
  README-DEBUGGER.md     # API debug logging documentation
  api/                   # 1health platform API guide (start at api/README.md)
    README.md            # Index + mental model
    DATA-MODEL.md        # Object types, instances, attributes, customData
    SCHEMA-DISCOVERY.md  # Runtime type/attribute/relationship introspection
    QUERY.md             # /api/v2/query + grid endpoints
    CUSTOM-DATA.md       # Reading/writing customData
    WORKFLOWS.md         # Campaigns, journeys, steps, submission recipes
    PROVISIONING.md      # Self-bootstrap workflow templates + campaigns by name
    DYNAMIC-STEPS.md     # Building step UIs generically
    CONVENTIONS.md       # How to add a new API module
    GOTCHAS.md           # Platform quirks to code around
```

## Environment Variables

| Variable | Description |
|---|---|
| `ONEHEALTH_SECRET_KEY_DEMO` | Server-side LPL decryption key for demo environment |
| `ONEHEALTH_SECRET_KEY_PROD` | Server-side LPL decryption key for production environment |
| `APP_ID_DEMO` | Application ID for demo environment |
| `APP_ID_PROD` | Application ID for production environment |
| `NEXT_PUBLIC_DEFAULT_LAUNCH_REDIRECT_ROUTE` | Post-authentication redirect route (default: `/`) |

Base URLs are hardcoded: `https://demo.1health.io` (demo) and `https://app.1health.io` (prod).

## Quick Start

### 1. Add API Functions

Most reads and writes are already covered by the generic 1health engines in
`lib/api/` -- query the object graph, patch custom data, and drive workflows
without writing endpoint code:

```typescript
import { runQuery, eq, appendCustomData, createJourney } from "@/lib/api"

// Read an entity + its attributes via /api/v2/query
const res = await runQuery({ key: "Person", attributes: ["id", "customData"], filter: eq("id", personId), limit: 1 })

// Patch an instance's customData (deep-merge)
await appendCustomData(orgId, { lastSyncedAt: new Date().toISOString() })

// Start a workflow instance
const journey = await createJourney(campaignId)
```

For a new endpoint, add a module using the `callApi` helper (see
`docs/api/CONVENTIONS.md`):

```typescript
// lib/api/my-feature.ts
import { callApi, type ApiResponse } from "@/lib/api/client"

export async function fetchMyData(id: number): Promise<ApiResponse<MyData>> {
  return callApi<MyData>("myFeature/fetchMyData", `/api/v2/my-endpoint/${id}`)
}
```

**New to the platform? Read `docs/api/README.md` first** -- it explains the data
model, the two query engines, custom data, and workflows.

### 2. Build Your Pages

Create components and wire them into `home-page-client.tsx`. The current single-page setup renders `SettingsPage` as the home page -- expand from there by adding routing logic (navigation context or Next.js routes).

## Design System

The UI follows the **1health design system** (healthcare command-center: calm,
trustworthy, clinically precise). All tokens live in `app/globals.css` in a
three-tier structure so a single edit rebrands the app without changing its
structure, spacing, motion, or feel:

- **Rebrand** by repointing four `--brand-*` variables (see the `TIER 2` block).
- **Status colors, spacing, type scale, radius, motion** stay fixed to preserve
  the shared 1health experience across apps.
- A full **dark theme** ships and is class-based (off by default).

Read `docs/DESIGN-SYSTEM.md` before building UI. The canonical spec is
[1health_design_system.md](https://tachin-website.web.app/public/1health_design_system.md),
referenced at the top of `app/globals.css`.

## Documentation

- **`docs/api/`** -- **1health platform API guide** (start at `docs/api/README.md`): the
  data model, runtime schema discovery, `/query` + grid engines, custom data,
  workflows/journeys/steps, dynamic step UIs, module conventions, and platform gotchas
- `docs/DESIGN-SYSTEM.md` -- Design tokens, rebranding, typography, motion, and component guidelines
- `docs/AUTH-ARCHITECTURE.md` -- Authentication flow, environment selection, and token management
- `docs/ACTION-PATTERNS.md` -- API call patterns, `authFetch()` usage, and SWR integration
- `docs/README-DEBUGGER.md` -- API debug logging and console output
