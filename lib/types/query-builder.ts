/**
 * Query Builder Types
 *
 * Type definitions for the visual query builder component state and configuration.
 */

// Filter operators supported by the /query action
export type FilterOperator = "==" | "=in=" | "=lt=" | "=le=" | "=gt=" | "=ge=" | "range"

// Single filter configuration
export interface QueryFilter {
  id: string // Unique ID for React keys
  attributeKey: string
  operator: FilterOperator
  value: string // For ==, single value; for =in=, comma-separated
  enabled: boolean
}

// Attribute selection state
export interface AttributeSelection {
  key: string
  label: string
  type: string // STRING, INTEGER, BOOLEAN, DATE, VALUE_LIST, etc.
  selected: boolean // Include in response
  filterEnabled: boolean
  filterOperator: FilterOperator
  filterValue: string
  filterValueEnd?: string // For range filtering (end date)
  valueOptions?: string[] // For VALUE_LIST types
}

// Relationship configuration with nested selections
export interface RelationshipSelection {
  id: string // Unique ID for React keys
  relationshipKey: string // e.g., "Person.PersonHasAddress.Address"
  relationshipName: string // Display name
  targetType: string // The related type key (no spaces, used for API calls)
  targetTypeLabel?: string // Human-readable type name (may have spaces)
  direction: "FORWARD" | "BACKWARDS" // Added direction field for forward/backward relationships
  enabled: boolean
  limit: number
  attributes: AttributeSelection[]
  nestedRelationships: RelationshipSelection[]
}

// Main query builder state
export interface QueryBuilderState {
  // Root type selection
  rootType: string | null
  rootTypeLabel: string | null

  // Attributes for root type
  attributes: AttributeSelection[]

  // Relationships from root type
  relationships: RelationshipSelection[]

  // Backward relationships to root type (we are the "to" side)
  backwardRelationships?: RelationshipSelection[]

  // Pagination
  limit: number
  offset: number

  // UI state
  isLoading: boolean
  error: string | null
}

// Query request body structure (matches /v2/query API)
export interface QueryRequestBody {
  key: string
  attributes?: string[]
  filter?: string
  relationships?: QueryRelationshipRequest[]
  limit?: number
  offset?: number
}

export interface QueryRelationshipRequest {
  key: string
  attributes?: string[]
  filter?: string
  limit?: number
  relationships?: QueryRelationshipRequest[]
}

// These are hardcoded system attributes available on every entity
export const BASELINE_ATTRIBUTES = [
  { key: "id", label: "ID", type: "STRING" },
  { key: "created", label: "Created", type: "TIMESTAMP" },
  { key: "updated", label: "Updated", type: "TIMESTAMP" },
] as const

// Helper to get baseline attributes as AttributeSelection[]
export function getBaselineAttributeSelections(): AttributeSelection[] {
  return BASELINE_ATTRIBUTES.map((attr) => ({
    key: attr.key,
    label: attr.label,
    type: attr.type,
    selected: attr.key === "id", // id is selected by default
    filterEnabled: false,
    filterOperator: "==",
    filterValue: "",
    valueOptions: undefined,
  }))
}

export function getOperatorsForType(type: string): { value: FilterOperator; label: string }[] {
  if (type === "TIMESTAMP" || type === "DATE" || type === "DATETIME") {
    return [
      { value: "==", label: "== (equals)" },
      { value: "=gt=", label: "> (after)" },
      { value: "=ge=", label: ">= (on or after)" },
      { value: "=lt=", label: "< (before)" },
      { value: "=le=", label: "<= (on or before)" },
      { value: "range", label: "Range (between)" },
    ]
  }

  if (type === "INTEGER" || type === "DECIMAL" || type === "NUMBER") {
    return [
      { value: "==", label: "== (equals)" },
      { value: "=gt=", label: "> (greater than)" },
      { value: "=ge=", label: ">= (greater or equal)" },
      { value: "=lt=", label: "< (less than)" },
      { value: "=le=", label: "<= (less or equal)" },
      { value: "=in=", label: "=in= (in list)" },
    ]
  }

  // Default for STRING, VALUE_LIST, BOOLEAN, etc.
  return [
    { value: "==", label: "== (equals)" },
    { value: "=in=", label: "=in= (in list)" },
  ]
}

// Initial state factory
export function createInitialQueryBuilderState(): QueryBuilderState {
  return {
    rootType: null,
    rootTypeLabel: null,
    attributes: [],
    relationships: [],
    limit: 10,
    offset: 0,
    isLoading: false,
    error: null,
  }
}

// Helper to create a new filter
export function createFilter(attributeKey = ""): QueryFilter {
  return {
    id: crypto.randomUUID(),
    attributeKey,
    operator: "==",
    value: "",
    enabled: true,
  }
}

// Helper to create attribute selection from type metadata
export function createAttributeSelection(
  key: string,
  label: string,
  type: string,
  valueOptions?: string[],
): AttributeSelection {
  return {
    key,
    label,
    type,
    selected: false,
    filterEnabled: false,
    filterOperator: "==",
    filterValue: "",
    filterValueEnd: undefined,
    valueOptions,
  }
}
