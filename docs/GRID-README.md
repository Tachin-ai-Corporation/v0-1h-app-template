# Data Grid Component

A dynamic, configurable data grid component that generates columns automatically from API response data.

## Architecture

The Data Grid system consists of:

- **`components/data-grid/index.tsx`** - Main DataGrid component
- **`components/data-grid/types.ts`** - TypeScript interfaces
- **`components/data-grid/components/`** - Sub-components (header, row, pagination, toolbar, dialogs)
- **`components/data-grid/hooks/`** - Custom hooks (saved views, export)
- **`lib/utils/column-generator.ts`** - Dynamic column generation from API data

## Dynamic Column Generation

Columns are automatically generated from the first row of API response data. The `generateColumnsFromData()` function:

1. Inspects the data structure
2. Infers column types (string, number, date, boolean, array)
3. Creates sortable/filterable columns
4. Applies sensible defaults for width and visibility

### Column Override System

Use `columnOverrides` to customize auto-generated columns:

```typescript
const overrides: ColumnOverride[] = [
  { key: "id", visible: false },
  { key: "status", label: "Current Status", width: 150 },
  { key: "createdAt", type: "date", sortable: true },
]
```

## Usage

```tsx
import { DataGrid } from "@/components/data-grid"

<DataGrid
  title="My Grid"
  fetchData={async (page, pageSize, filters, sort) => {
    const result = await myApiAction(page, pageSize, filters, sort)
    return result
  }}
  columnOverrides={[
    { key: "id", visible: false },
  ]}
/>
```

## Props

| Prop | Type | Description |
|------|------|-------------|
| `title` | `string` | Grid title displayed in toolbar |
| `fetchData` | `(page, pageSize, filters, sort) => Promise<GridData>` | Data fetching function |
| `columnOverrides` | `ColumnOverride[]` | Optional column customizations |
| `pageSize` | `number` | Items per page (default: 25) |
| `gridIdentifier` | `string` | Unique ID for saved views |

## Troubleshooting

### Columns not appearing
- Ensure `fetchData` returns data with consistent property names
- Check that the first row has representative data for column generation

### Filters not working
- The API only supports `==` (equals) and `=in=` (in list) operators
- Partial matching (`=like=`) is NOT supported

### Performance
- Use server-side pagination for large datasets
- Avoid fetching all data client-side
- Use `columnOverrides` to hide unnecessary columns
