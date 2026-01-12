# 1health App Template

A generic template for building front-end applications on top of the 1health platform using Next.js and v0.

## Overview

This template provides the foundational infrastructure for connecting to 1health APIs, including:

- **Authentication**: SSO integration with LPL token exchange
- **Patient Management**: Search, view demographics, insurance, and external IDs
- **Campaign Grids**: Connect to any campaign to view journey data in a configurable grid
- **Reusable Components**: Data grids, patient cards, and UI components

## Project Structure

```
├── app/
│   ├── actions/           # Server actions for 1health API calls
│   │   ├── person-actions.ts        # Patient CRUD operations
│   │   ├── insurance-actions.ts     # Insurance data fetching
│   │   ├── journey-grid-actions.ts  # Campaign journey grid data
│   │   ├── patient-search-actions.ts # Patient search functionality
│   │   ├── query/                   # Generic query builder actions
│   │   └── ...
│   ├── api/
│   │   └── token/         # Token exchange and refresh endpoints
│   └── auth/              # Authentication page
├── components/
│   ├── app-shell.tsx      # Main application shell with sidebar
│   ├── header.tsx         # Configurable app header
│   ├── home-page-client.tsx # Main client-side routing component
│   ├── data-grid/         # Reusable data grid components
│   ├── patient/           # Patient-related components
│   │   ├── patient-demographics-card.tsx
│   │   ├── patient-insurance-card.tsx
│   │   └── patient-external-ids-card.tsx
│   ├── pages/             # Page components
│   │   ├── home-page.tsx
│   │   ├── patient-search-page.tsx
│   │   ├── patient-details-page.tsx
│   │   └── campaign-grid-page.tsx
│   └── ui/                # shadcn/ui components
├── contexts/
│   └── navigation-context.tsx  # Client-side navigation state
├── lib/
│   ├── auth-server.ts     # Server-side auth utilities (authFetch)
│   ├── api/
│   │   ├── config.ts      # API endpoint configuration
│   │   └── types.ts       # TypeScript types for API responses
│   └── utils/             # Utility functions
└── docs/
    └── ACTION-PATTERNS.md # Guide for creating new API actions
```

## Getting Started

### 1. Environment Variables

The following environment variables are required:

```env
NEXT_PUBLIC_ONE_HEALTH_BASE_URL=https://api.1health.io
```

### 2. Authentication Flow

The app uses LPL (Launch Point Link) token exchange for SSO:

1. User is redirected to `/auth?token=<LPL_TOKEN>`
2. The token is exchanged for a 1health session via `/api/token`
3. Session is stored in cookies and used for subsequent API calls

### 3. Adding New Pages

1. Create your page component in `components/pages/`
2. Add a navigation item in `components/home-page-client.tsx`:

```tsx
const navItems: NavItem[] = [
  { name: "Home", key: "home", icon: Home },
  { name: "Patient Search", key: "patient-search", icon: Search },
  { name: "Your New Page", key: "your-page", icon: YourIcon },
]
```

3. Add the page to the render logic:

```tsx
const renderContent = () => {
  switch (currentView) {
    case "your-page":
      return <YourNewPage />
    // ... existing cases
  }
}
```

### 4. Creating New API Actions

See `docs/ACTION-PATTERNS.md` for detailed patterns. Basic example:

```typescript
"use server"

import { authFetch } from "@/lib/auth-server"
import { API_ENDPOINTS } from "@/lib/api/config"

export async function fetchSomeData(id: string) {
  const response = await authFetch(`${API_ENDPOINTS.base}/your-endpoint/${id}`)
  
  if (!response.ok) {
    throw new Error(`Failed to fetch data: ${response.statusText}`)
  }
  
  return response.json()
}
```

### 5. Using the Campaign Grid

Connect to any campaign by providing its ID:

```tsx
import { CampaignGridPage } from "@/components/pages/campaign-grid-page"

// With a preset campaign ID
<CampaignGridPage initialCampaignId="your-campaign-id" />

// Or let users enter the campaign ID
<CampaignGridPage />
```

### 6. Patient Details

Open patient details from anywhere using the navigation context:

```tsx
import { useNavigation } from "@/contexts/navigation-context"

function YourComponent() {
  const { setSelectedPersonId } = useNavigation()
  
  const handlePatientClick = (personId: string) => {
    setSelectedPersonId(personId)  // Opens patient overlay
  }
}
```

## Key Components

### AppShell

The main application wrapper providing header, sidebar, and content area:

```tsx
<AppShell
  title="Your App Name"
  navItems={yourNavItems}
  headerSlot={<YourHeaderControls />}
>
  {children}
</AppShell>
```

### DataGrid

A flexible data grid with pagination, column customization, and export:

```tsx
<DataGrid
  data={rows}
  columns={columns}
  totalCount={totalCount}
  pageSize={pageSize}
  currentPage={currentPage}
  onPageChange={setCurrentPage}
  onRowClick={handleRowClick}
/>
```

## Extending the Template

This template is designed to be extended for specific use cases:

1. **Add domain-specific pages** in `components/pages/`
2. **Create new server actions** in `app/actions/` for your API needs
3. **Extend patient details** by adding cards to `PatientDetailsPage`
4. **Customize the data grid** columns for your campaign data
5. **Add new navigation items** to the sidebar

## Documentation

- `docs/ACTION-PATTERNS.md` - Patterns for creating 1health API actions
- `user_read_only_context/project_sources/QUERY-ACTIONS-README.md` - Query API documentation
