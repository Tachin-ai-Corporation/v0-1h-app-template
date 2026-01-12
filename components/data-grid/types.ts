export interface Column {
  id: string
  label: string
  key: string
  width: number
  visible: boolean
  pinned: boolean
  filterable: boolean
  sortable: boolean
  type?: "string" | "number" | "date" | "boolean" | "array" | "object"
  filterType?: "text" | "boolean" | "dateRange"
}

export interface SavedView {
  id: string
  name: string
  columns: Column[]
  createdAt?: string
  updatedAt?: string
}

export interface PaginationState {
  currentPage: number
  pageSize: number
  totalPages: number
  paginatedDataLength: number
  filteredDataLength: number
  totalDataLength: number
  selectedRowsCount: number
  setCurrentPage: (page: number) => void
  setPageSize: (size: number) => void
}

export interface DataGridProps {
  /** Initial data (for static/client-side data) */
  data?: Record<string, any>[]
  /** Column configuration - if not provided, columns are auto-generated from data */
  columns?: Column[]
  /**
   * Column overrides - partial column configs to merge with auto-generated columns
   * Example: { memberFirstName: { visible: true, pinned: true }, journeyId: { visible: false } }
   */
  columnOverrides?: Record<string, Partial<Column>>
  /** Grid title displayed in toolbar */
  title?: string
  /** Campaign ID for data fetching */
  campaignId?: string
  /** Unique identifier for saving views */
  gridIdentifier?: string
  /** Server-side data fetch function */
  fetchData?: (params: {
    page: number
    pageSize: number
    filters: Record<string, string>
    sortColumn: string | null
    sortDirection: "asc" | "desc"
  }) => Promise<{ data: Record<string, any>[]; totalElements: number }>
  /** Callback when data changes (for client-side data) */
  onDataChange?: (updatedData: Record<string, any>[]) => void
  /** Show pagination controls */
  showPagination?: boolean
  /** Callback for pagination state changes */
  onPaginationStateChange?: (state: PaginationState) => void
  /** Callback when a row is clicked */
  onJourneyClick?: (rowData: Record<string, any>) => void
}

export interface Tag {
  id: number
  name: string
}

export type ExportStatus = "idle" | "exporting" | "polling" | "ready" | "error" | "completed" | "pending" | "success"
