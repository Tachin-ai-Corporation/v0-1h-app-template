"use client"
import { useState, useEffect, useCallback, useMemo } from "react"
import type React from "react"

import { useFetch } from "@/lib/hooks/use-fetch"
import { DataGridToolbar } from "./components/data-grid-toolbar"
import { DataGridHeader } from "./components/data-grid-header"
import { DataGridRow } from "./components/data-grid-row"
import { DataGridPagination } from "./components/data-grid-pagination"
import { ColumnManagerDialog } from "./components/column-manager-dialog"
import { SaveViewDialog } from "./components/save-view-dialog"
import { ManageViewsDialog } from "./components/manage-views-dialog"
import { ExportProgressDialog } from "./components/export-progress-dialog"
import { generateColumnsFromData, mergeColumnOverrides } from "@/lib/utils/column-generator"
import { useSavedViews } from "./hooks/use-saved-views"
import { useExport } from "./hooks/use-export"
import { useToast } from "@/hooks/use-toast"
import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react"
import type { DataGridProps, Column } from "./types"

/**
 * Generic DataGrid component for displaying campaign journey data
 *
 * This component provides:
 * - Dynamic column generation from API response data
 * - Paginated data display with server-side fetching
 * - Column customization and saved views
 * - Row selection for bulk operations
 * - Export functionality
 * - Sorting and filtering
 *
 * Columns are auto-generated from the first page of data if not provided.
 * You can override specific columns while keeping auto-generated defaults.
 */
export function DataGrid({
  data: initialData,
  columns: initialColumns,
  columnOverrides,
  title = "Campaign Grid",
  campaignId,
  fetchData,
  onDataChange,
  showPagination = true,
  onPaginationStateChange,
  onJourneyClick,
  gridIdentifier,
}: DataGridProps) {
  const { toast } = useToast()

  const [columnsGenerated, setColumnsGenerated] = useState(false)

  // Column state - start empty if no initialColumns, will be generated from data
  const [columns, setColumns] = useState<Column[]>(initialColumns || [])

  // Filter and sort state
  const [filterInputs, setFilterInputs] = useState<Record<string, string>>({})
  const [filters, setFilters] = useState<Record<string, string>>({})
  const [sortColumn, setSortColumn] = useState<string | null>(null)
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc")

  // Pagination state
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set())
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  // Data state
  const [data, setData] = useState<Record<string, any>[]>(initialData || [])
  const [totalRecords, setTotalRecords] = useState<number>(initialData?.length || 0)

  // Dialog state
  const [showColumnManager, setShowColumnManager] = useState(false)
  const [showSaveViewDialog, setShowSaveViewDialog] = useState(false)
  const [showManageViewsDialog, setShowManageViewsDialog] = useState(false)

  // Toolbar dropdown state
  const [manageRecordsOpen, setManageRecordsOpen] = useState(false)
  const [manageGridViewOpen, setManageGridViewOpen] = useState(false)

  // Auto-resize state
  const [isAutoResized, setIsAutoResized] = useState(false)

  // Resize state
  const [resizingColumn, setResizingColumn] = useState<string | null>(null)

  // Drag state
  const [draggedColumn, setDraggedColumn] = useState<string | null>(null)

  // Saved views hook
  const savedViews = useSavedViews(gridIdentifier || campaignId || "default")

  // Export hook
  const exportHook = useExport()

  // Debounce filter inputs
  useEffect(() => {
    const timer = setTimeout(() => {
      setFilters(filterInputs)
      setCurrentPage(1)
    }, 1500)
    return () => clearTimeout(timer)
  }, [filterInputs])

  const swrKey = fetchData
    ? JSON.stringify({ campaignId, currentPage, pageSize, filters, sortColumn, sortDirection })
    : null

  const {
    data: apiResponse,
    error,
    isLoading,
    mutate: refreshData,
  } = useFetch(
    swrKey,
    async () => {
      if (!fetchData) return null
      const result = await fetchData({
        page: currentPage - 1,
        pageSize,
        filters,
        sortColumn,
        sortDirection,
      })
      return result
    },
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      keepPreviousData: true,
      dedupingInterval: 500,
    },
  )

  const currentData = useMemo(() => {
    if (fetchData) {
      return apiResponse?.data || []
    }
    return data || []
  }, [fetchData, apiResponse?.data, data])

  const currentTotalElements = useMemo(() => {
    if (fetchData) {
      return apiResponse?.totalElements || 0
    }
    return totalRecords || 0
  }, [fetchData, apiResponse?.totalElements, totalRecords])

  useEffect(() => {
    if (currentData.length > 0 && !columnsGenerated && columns.length === 0) {
      const generatedColumns = generateColumnsFromData(currentData)
      const finalColumns = columnOverrides ? mergeColumnOverrides(generatedColumns, columnOverrides) : generatedColumns
      setColumns(finalColumns)
      setColumnsGenerated(true)
    }
  }, [currentData, columnsGenerated, columns.length, columnOverrides])

  useEffect(() => {
    if (initialData && initialData.length > 0 && !initialColumns && columns.length === 0) {
      const generatedColumns = generateColumnsFromData(initialData)
      const finalColumns = columnOverrides ? mergeColumnOverrides(generatedColumns, columnOverrides) : generatedColumns
      setColumns(finalColumns)
      setColumnsGenerated(true)
    }
  }, [initialData, initialColumns, columns.length, columnOverrides])

  const totalPages = Math.ceil(currentTotalElements / pageSize) || 1

  const visibleColumns = useMemo(() => {
    if (!Array.isArray(columns)) return []
    return columns.filter((col) => col.visible)
  }, [columns])

  const pinnedColumns = useMemo(() => {
    return visibleColumns.filter((col) => col.pinned)
  }, [visibleColumns])

  const unpinnedColumns = useMemo(() => {
    return visibleColumns.filter((col) => !col.pinned)
  }, [visibleColumns])

  // Handle refresh
  const handleRefresh = useCallback(() => {
    if (swrKey) {
      refreshData()
    }
  }, [swrKey, refreshData])

  // Handle auto-resize
  const handleAutoResize = useCallback(() => {
    setIsAutoResized(!isAutoResized)
  }, [isAutoResized])

  // Handle view application
  const handleApplyView = useCallback(
    (view: any) => {
      if (view.columns) {
        setColumns(view.columns)
      }
      savedViews.setCurrentView(view)
    },
    [savedViews],
  )

  const handleCloseView = useCallback(() => {
    if (initialColumns) {
      setColumns(initialColumns)
    } else if (currentData.length > 0) {
      const generatedColumns = generateColumnsFromData(currentData)
      const finalColumns = columnOverrides ? mergeColumnOverrides(generatedColumns, columnOverrides) : generatedColumns
      setColumns(finalColumns)
    }
    savedViews.setCurrentView(null)
  }, [initialColumns, currentData, columnOverrides, savedViews])

  // Handle quick save
  const handleQuickSave = useCallback(async () => {
    if (savedViews.currentView) {
      await savedViews.updateView(savedViews.currentView.id, {
        columns,
      })
    }
  }, [savedViews, columns])

  // Sort handler
  const handleSort = useCallback((columnId: string) => {
    setSortColumn((prev) => {
      if (prev === columnId) {
        setSortDirection((dir) => (dir === "asc" ? "desc" : "asc"))
        return columnId
      }
      setSortDirection("asc")
      return columnId
    })
  }, [])

  // Get sort icon
  const getSortIcon = useCallback(
    (columnId: string) => {
      if (sortColumn !== columnId) {
        return <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
      }
      return sortDirection === "asc" ? (
        <ArrowUp className="h-4 w-4 text-primary" />
      ) : (
        <ArrowDown className="h-4 w-4 text-primary" />
      )
    },
    [sortColumn, sortDirection],
  )

  // Column drag handlers
  const handleDragStart = useCallback((e: React.DragEvent, columnId: string) => {
    setDraggedColumn(columnId)
    e.dataTransfer.effectAllowed = "move"
  }, [])

  const handleDragEnd = useCallback(() => {
    setDraggedColumn(null)
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent, targetColumnId: string) => {
      e.preventDefault()
      if (!draggedColumn || draggedColumn === targetColumnId) return

      setColumns((prev) => {
        const newColumns = [...prev]
        const draggedIndex = newColumns.findIndex((c) => c.id === draggedColumn)
        const targetIndex = newColumns.findIndex((c) => c.id === targetColumnId)
        const [removed] = newColumns.splice(draggedIndex, 1)
        newColumns.splice(targetIndex, 0, removed)
        return newColumns
      })
      setDraggedColumn(null)
    },
    [draggedColumn],
  )

  // Column resize handler
  const handleResizeStart = useCallback((e: React.MouseEvent, columnId: string) => {
    e.preventDefault()
    setResizingColumn(columnId)
  }, [])

  // Toggle pin
  const handleTogglePin = useCallback((columnId: string, isPinned: boolean) => {
    setColumns((prev) => prev.map((col) => (col.id === columnId ? { ...col, pinned: isPinned } : col)))
  }, [])

  // Hide column
  const handleHideColumn = useCallback((columnId: string) => {
    setColumns((prev) => prev.map((col) => (col.id === columnId ? { ...col, visible: false } : col)))
  }, [])

  // Row selection
  const handleRowSelect = useCallback((rowId: string, checked: boolean) => {
    setSelectedRows((prev) => {
      const next = new Set(prev)
      if (checked) {
        next.add(rowId)
      } else {
        next.delete(rowId)
      }
      return next
    })
  }, [])

  const handleSelectAll = useCallback(
    (checked: boolean) => {
      if (checked) {
        const allIds = currentData.map((row: any) => String(row.journeyId || row.id))
        setSelectedRows(new Set(allIds))
      } else {
        setSelectedRows(new Set())
      }
    },
    [currentData],
  )

  const isIndeterminate = selectedRows.size > 0 && selectedRows.size < currentData.length
  const isAllSelected = selectedRows.size === currentData.length && currentData.length > 0

  // Copy cell handler
  const handleCopyCell = useCallback(
    (value: any) => {
      navigator.clipboard.writeText(String(value || ""))
      toast({ title: "Copied to clipboard" })
    },
    [toast],
  )

  // Placeholder handlers for bulk operations (can be extended)
  const handleExportSelected = useCallback(() => {
    if (campaignId) {
      exportHook.startExport({
        campaignId,
        selectedRows: Array.from(selectedRows),
        filters,
        sortColumn,
        sortDirection,
      })
    }
  }, [campaignId, selectedRows, filters, sortColumn, sortDirection, exportHook])

  const handleExportAll = useCallback(() => {
    if (campaignId) {
      exportHook.startExport({
        campaignId,
        filters,
        sortColumn,
        sortDirection,
      })
    }
  }, [campaignId, filters, sortColumn, sortDirection, exportHook])

  const handleAddRemoveTags = useCallback(() => {
    toast({ title: "Tags", description: "Tag management requires implementation for your use case." })
  }, [toast])

  const handleAssignJourneys = useCallback(() => {
    toast({ title: "Assign", description: "Assignment requires implementation for your use case." })
  }, [toast])

  const handleChangeStatus = useCallback(() => {
    toast({ title: "Status", description: "Status change requires implementation for your use case." })
  }, [toast])

  if (isLoading && fetchData && !apiResponse) {
    return (
      <div className="flex flex-col h-full">
        <div className="relative z-50 bg-background p-4 border-b border-border flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-foreground pl-2">{title}</h1>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-muted-foreground">Loading...</div>
        </div>
      </div>
    )
  }

  if (error && fetchData) {
    return (
      <div className="flex flex-col h-full">
        <div className="relative z-50 bg-background p-4 border-b border-border flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-foreground pl-2">{title}</h1>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-destructive">Error loading data: {error.message}</div>
        </div>
      </div>
    )
  }

  if (columns.length === 0 && currentData.length === 0) {
    return (
      <div className="flex flex-col h-full">
        <div className="relative z-50 bg-background p-4 border-b border-border flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-foreground pl-2">{title}</h1>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-muted-foreground">No data available. Enter a Campaign ID to load data.</div>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="flex flex-col h-full">
        <DataGridToolbar
          title={title}
          isAutoResized={isAutoResized}
          onAutoResize={handleAutoResize}
          manageRecordsOpen={manageRecordsOpen}
          setManageRecordsOpen={setManageRecordsOpen}
          selectedRowsCount={selectedRows.size}
          totalRecords={currentTotalElements}
          onAddRemoveTags={handleAddRemoveTags}
          onAssignJourneys={handleAssignJourneys}
          onChangeStatus={handleChangeStatus}
          onExportSelected={handleExportSelected}
          onExportAll={handleExportAll}
          currentViewName={savedViews.currentView?.name || null}
          isQuickSaving={savedViews.isLoading}
          onQuickSave={handleQuickSave}
          onCloseView={handleCloseView}
          manageGridViewOpen={manageGridViewOpen}
          setManageGridViewOpen={setManageGridViewOpen}
          onCustomizeColumns={() => setShowColumnManager(true)}
          onSaveView={() => setShowSaveViewDialog(true)}
          onManageViews={() => setShowManageViewsDialog(true)}
          onRefresh={handleRefresh}
          isRefreshing={isLoading}
        />

        {/* Table container */}
        <div className="flex-1 overflow-auto">
          <table className="w-full border-collapse">
            <DataGridHeader
              pinnedColumns={pinnedColumns}
              unpinnedColumns={unpinnedColumns}
              isAllSelected={isAllSelected}
              isIndeterminate={isIndeterminate}
              filterInputs={filterInputs}
              resizingColumn={resizingColumn}
              sortColumn={sortColumn}
              sortDirection={sortDirection}
              onSelectAll={handleSelectAll}
              onSort={handleSort}
              onFilterChange={(key, value) => setFilterInputs((prev) => ({ ...prev, [key]: value }))}
              onResizeStart={handleResizeStart}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              onTogglePin={handleTogglePin}
              onHideColumn={handleHideColumn}
              getSortIcon={getSortIcon}
            />
            <tbody>
              {currentData.map((row: any) => {
                const rowId = String(row.journeyId || row.id)
                return (
                  <DataGridRow
                    key={rowId}
                    row={row}
                    rowId={rowId}
                    columns={visibleColumns}
                    pinnedColumns={pinnedColumns}
                    unpinnedColumns={unpinnedColumns}
                    selectedRows={selectedRows}
                    onRowSelect={handleRowSelect}
                    onJourneyClick={onJourneyClick}
                    handleCopyCell={handleCopyCell}
                  />
                )
              })}
              {currentData.length === 0 && (
                <tr>
                  <td colSpan={visibleColumns.length + 1} className="text-center py-8 text-muted-foreground">
                    No data available
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {showPagination && (
          <DataGridPagination
            currentPage={currentPage}
            totalPages={totalPages}
            pageSize={pageSize}
            totalRecords={currentTotalElements}
            selectedCount={selectedRows.size}
            onPageChange={setCurrentPage}
            onPageSizeChange={(size) => {
              setPageSize(size)
              setCurrentPage(1)
            }}
          />
        )}
      </div>

      <ColumnManagerDialog
        open={showColumnManager}
        onOpenChange={setShowColumnManager}
        columns={columns}
        onColumnsChange={setColumns}
      />

      <SaveViewDialog
        open={showSaveViewDialog}
        onOpenChange={setShowSaveViewDialog}
        onSave={async (name) => {
          await savedViews.saveView(name, columns)
          setShowSaveViewDialog(false)
        }}
        isLoading={savedViews.isLoading}
      />

      <ManageViewsDialog
        open={showManageViewsDialog}
        onOpenChange={setShowManageViewsDialog}
        views={savedViews.views}
        currentViewId={savedViews.currentView?.id}
        onApplyView={handleApplyView}
        onDeleteView={savedViews.deleteView}
        isLoading={savedViews.isLoading}
      />

      <ExportProgressDialog
        open={exportHook.status !== "idle" && exportHook.status !== "completed"}
        status={exportHook.status}
        progress={exportHook.progress}
        onClose={exportHook.reset}
        onDownload={exportHook.downloadFile}
        downloadUrl={exportHook.downloadUrl}
      />
    </>
  )
}

export { DataGridPagination } from "./components/data-grid-pagination"
export { generateColumnsFromData, mergeColumnOverrides } from "@/lib/utils/column-generator"
export type { Column, DataGridProps } from "./types"
