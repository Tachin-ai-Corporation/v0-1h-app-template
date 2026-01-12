/**
 * Column Generator Utility
 *
 * Dynamically generates DataGrid columns from API response data.
 * No hard-coded column definitions - derives everything from the data itself.
 *
 * NOTE: This file intentionally does NOT have "use server" directive
 * because these are utility functions used by client components.
 */

import type { Column } from "@/components/data-grid/types"

// Fields that should be visible by default (common/important fields)
const DEFAULT_VISIBLE_FIELDS = new Set([
  "status",
  "memberFirstName",
  "memberLastName",
  "memberDOB",
  "workflowStepInProgressName",
  "nextWorkflowStepName",
  "created",
  "updated",
])

// Fields that should always be hidden (internal/technical fields)
const ALWAYS_HIDDEN_FIELDS = new Set(["id", "isUat", "version", "createdBy", "updatedBy", "deletedBy", "deletedAt"])

// Fields that are IDs and should be hidden by default
const ID_FIELD_PATTERN = /Id$|Ids$|^id$/i

// Field type inference based on value
type InferredType = "string" | "number" | "date" | "boolean" | "array" | "object"

function inferFieldType(value: unknown): InferredType {
  if (value === null || value === undefined) {
    return "string" // Default to string for null/undefined
  }

  if (Array.isArray(value)) {
    return "array"
  }

  if (typeof value === "boolean") {
    return "boolean"
  }

  if (typeof value === "number") {
    return "number"
  }

  if (typeof value === "object") {
    return "object"
  }

  // Check if string is a date
  if (typeof value === "string") {
    // ISO date pattern or common date formats
    if (/^\d{4}-\d{2}-\d{2}/.test(value) || /^\d{2}\/\d{2}\/\d{4}/.test(value)) {
      const parsed = Date.parse(value)
      if (!isNaN(parsed)) {
        return "date"
      }
    }
  }

  return "string"
}

// Convert camelCase to human-readable label
function camelCaseToLabel(key: string): string {
  // Handle common prefixes
  const prefixMap: Record<string, string> = {
    member: "Member",
    workflow: "Workflow",
    templateOwner: "Template Owner",
    orderOrdering: "Ordering",
    brandedTemplateOwner: "Branded Template",
    next: "Next",
  }

  // Check for known prefixes and handle them
  for (const [prefix, label] of Object.entries(prefixMap)) {
    if (key.startsWith(prefix) && key.length > prefix.length) {
      const rest = key.slice(prefix.length)
      const restLabel = rest
        .replace(/([A-Z])/g, " $1")
        .replace(/^./, (str) => str.toUpperCase())
        .trim()
      return `${label} ${restLabel}`
    }
  }

  // Standard camelCase to Title Case
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (str) => str.toUpperCase())
    .trim()
}

// Determine if a field should be visible by default
function shouldBeVisible(key: string): boolean {
  // Explicitly visible fields
  if (DEFAULT_VISIBLE_FIELDS.has(key)) {
    return true
  }

  // Explicitly hidden fields
  if (ALWAYS_HIDDEN_FIELDS.has(key)) {
    return false
  }

  // Hide ID fields by default
  if (ID_FIELD_PATTERN.test(key)) {
    return false
  }

  // Hide fields ending with common internal suffixes
  if (key.endsWith("Version") || key.endsWith("Hash")) {
    return false
  }

  // Default: hide to keep grid clean, users can enable
  return false
}

// Determine column width based on field type and name
function getColumnWidth(key: string, type: InferredType): number {
  // Name fields
  if (key.toLowerCase().includes("name")) {
    return 150
  }

  // Date fields
  if (type === "date" || key.toLowerCase().includes("date") || key.toLowerCase().includes("time")) {
    return 120
  }

  // Status fields
  if (key.toLowerCase().includes("status")) {
    return 100
  }

  // ID fields
  if (ID_FIELD_PATTERN.test(key)) {
    return 80
  }

  // Boolean fields
  if (type === "boolean") {
    return 80
  }

  // Array fields need more space
  if (type === "array") {
    return 200
  }

  // Default
  return 120
}

/**
 * Generate columns from API response data
 *
 * @param data - Array of data objects from API response
 * @param options - Optional configuration
 * @returns Array of Column definitions
 */
export function generateColumnsFromData(
  data: Record<string, unknown>[],
  options: {
    /** Fields to always show regardless of default visibility */
    forceVisible?: string[]
    /** Fields to always hide regardless of default visibility */
    forceHidden?: string[]
    /** Custom labels for specific fields */
    customLabels?: Record<string, string>
    /** Fields to exclude entirely from column generation */
    exclude?: string[]
  } = {},
): Column[] {
  if (!data || data.length === 0) {
    return []
  }

  const { forceVisible = [], forceHidden = [], customLabels = {}, exclude = [] } = options
  const forceVisibleSet = new Set(forceVisible)
  const forceHiddenSet = new Set(forceHidden)
  const excludeSet = new Set(exclude)

  // Collect all unique keys from all data rows (first 10 rows for efficiency)
  const sampleData = data.slice(0, 10)
  const allKeys = new Set<string>()
  const typeMap = new Map<string, InferredType>()

  for (const row of sampleData) {
    for (const [key, value] of Object.entries(row)) {
      if (!excludeSet.has(key)) {
        allKeys.add(key)
        // Only set type if not already set (first non-null value wins)
        if (!typeMap.has(key) || (value !== null && value !== undefined)) {
          typeMap.set(key, inferFieldType(value))
        }
      }
    }
  }

  // Generate columns
  const columns: Column[] = []

  for (const key of allKeys) {
    const type = typeMap.get(key) || "string"

    // Determine visibility
    let visible = shouldBeVisible(key)
    if (forceVisibleSet.has(key)) visible = true
    if (forceHiddenSet.has(key)) visible = false

    // Get label
    const label = customLabels[key] || camelCaseToLabel(key)

    columns.push({
      id: key,
      key: key, // Key is used by DataGridRow to access row[column.key]
      label,
      visible,
      width: getColumnWidth(key, type),
      sortable: type !== "array" && type !== "object",
      filterable: type === "string" || type === "boolean",
      pinned: false,
      type, // Also include the inferred type for cell formatting
    })
  }

  // Sort columns: visible first, then alphabetically
  columns.sort((a, b) => {
    if (a.visible && !b.visible) return -1
    if (!a.visible && b.visible) return 1
    return a.label.localeCompare(b.label)
  })

  return columns
}

/**
 * Merge generated columns with custom column overrides
 *
 * @param generatedColumns - Columns generated from data
 * @param overrides - Custom column configurations to merge
 * @returns Merged column array
 */
export function mergeColumnOverrides(generatedColumns: Column[], overrides: Partial<Column>[]): Column[] {
  const overrideMap = new Map(overrides.map((o) => [o.id, o]))

  return generatedColumns.map((col) => {
    const override = overrideMap.get(col.id)
    if (override) {
      return { ...col, ...override }
    }
    return col
  })
}

/**
 * Get a formatted cell value for display
 * Handles arrays, dates, booleans, etc.
 */
export function formatCellValue(value: unknown, key: string): string {
  if (value === null || value === undefined) {
    return "—"
  }

  if (Array.isArray(value)) {
    if (value.length === 0) return "—"
    // If array of objects with name property, extract names
    if (typeof value[0] === "object" && value[0] !== null && "name" in value[0]) {
      return value.map((v: { name?: string }) => v.name).join(", ")
    }
    return value.join(", ")
  }

  if (typeof value === "boolean") {
    return value ? "Yes" : "No"
  }

  if (typeof value === "object") {
    // If object has a name property, use that
    if ("name" in value && value.name) {
      return String(value.name)
    }
    return "[Object]"
  }

  // Format dates
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    try {
      const date = new Date(value)
      if (!isNaN(date.getTime())) {
        // Check if it's just a date or includes time
        if (value.length === 10) {
          return date.toLocaleDateString()
        }
        return date.toLocaleString()
      }
    } catch {
      // Fall through to return raw value
    }
  }

  return String(value)
}
