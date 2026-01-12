"use client"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ChevronDown, UnfoldHorizontal, Save, X, RefreshCw } from "lucide-react"

interface DataGridToolbarProps {
  title?: string
  // Auto-resize
  isAutoResized: boolean
  onAutoResize: () => void
  // Manage Records dropdown
  manageRecordsOpen: boolean
  setManageRecordsOpen: (open: boolean) => void
  selectedRowsCount: number
  totalRecords: number
  onAddRemoveTags: () => void
  onAssignJourneys: () => void
  onChangeStatus: () => void
  onExportSelected: () => void
  onExportAll: () => void
  // Current view
  currentViewName: string | null
  isQuickSaving?: boolean
  onQuickSave?: () => void
  onCloseView?: () => void
  // Manage Grid View dropdown
  manageGridViewOpen: boolean
  setManageGridViewOpen: (open: boolean) => void
  onCustomizeColumns: () => void
  onSaveView: () => void
  onManageViews: () => void
  // Refresh functionality
  onRefresh?: () => void
  isRefreshing?: boolean
}

export function DataGridToolbar({
  title,
  isAutoResized,
  onAutoResize,
  manageRecordsOpen,
  setManageRecordsOpen,
  selectedRowsCount,
  totalRecords,
  onAddRemoveTags,
  onAssignJourneys,
  onChangeStatus,
  onExportSelected,
  onExportAll,
  currentViewName,
  isQuickSaving,
  onQuickSave,
  onCloseView,
  manageGridViewOpen,
  setManageGridViewOpen,
  onCustomizeColumns,
  onSaveView,
  onManageViews,
  onRefresh,
  isRefreshing,
}: DataGridToolbarProps) {
  return (
    <div className="relative z-50 bg-background p-4 border-b border-border flex items-center justify-between">
      <div className="flex items-center gap-2">
        {onRefresh && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onRefresh}
            disabled={isRefreshing}
            className="h-9 w-9"
            title="Refresh data"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
          </Button>
        )}
        <h1 className="text-2xl font-semibold text-foreground pl-2">{title}</h1>
      </div>
      <div className="flex items-center gap-2">
        {/* Auto-resize button */}
        <Button
          variant="outline"
          size="sm"
          onClick={onAutoResize}
          className={`h-9 ${isAutoResized ? "bg-primary/10 border-primary" : ""}`}
          title={isAutoResized ? "Reset to original column widths" : "Auto-resize all columns to fit content"}
        >
          <UnfoldHorizontal className="h-4 w-4" />
        </Button>

        {/* Manage Records dropdown */}
        <DropdownMenu modal={false} open={manageRecordsOpen} onOpenChange={setManageRecordsOpen}>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              Manage Records
              <ChevronDown className="h-4 w-4 ml-2" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48 z-[100]">
            <DropdownMenuItem
              onSelect={(e) => {
                e.preventDefault()
                setManageRecordsOpen(false)
                setTimeout(() => onAddRemoveTags(), 0)
              }}
              disabled={selectedRowsCount === 0}
              className={selectedRowsCount === 0 ? "opacity-50 cursor-not-allowed" : ""}
            >
              Add / Remove Tags
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={(e) => {
                e.preventDefault()
                setManageRecordsOpen(false)
                setTimeout(() => onAssignJourneys(), 0)
              }}
              disabled={selectedRowsCount === 0}
              className={selectedRowsCount === 0 ? "opacity-50 cursor-not-allowed" : ""}
            >
              Assign Journeys
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={(e) => {
                e.preventDefault()
                setManageRecordsOpen(false)
                setTimeout(() => onChangeStatus(), 0)
              }}
              disabled={selectedRowsCount === 0}
              className={selectedRowsCount === 0 ? "opacity-50 cursor-not-allowed" : ""}
            >
              Change Journey Status
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs text-muted-foreground">Export</DropdownMenuLabel>
            <DropdownMenuItem
              onSelect={(e) => {
                e.preventDefault()
                setManageRecordsOpen(false)
                setTimeout(() => onExportSelected(), 0)
              }}
              disabled={selectedRowsCount === 0}
              className={selectedRowsCount === 0 ? "opacity-50 cursor-not-allowed" : ""}
            >
              Export Selected Records ({selectedRowsCount})
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={(e) => {
                e.preventDefault()
                setManageRecordsOpen(false)
                setTimeout(() => onExportAll(), 0)
              }}
            >
              Export All Records ({totalRecords})
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Current view badge with quick save and close */}
        {currentViewName && (
          <div className="flex items-center gap-1 px-3 py-1.5 bg-primary/10 text-primary rounded-md text-sm font-medium border border-primary/30">
            <span>View: {currentViewName}</span>
            <div className="flex items-center gap-0.5">
              {onQuickSave && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onQuickSave()
                  }}
                  disabled={isQuickSaving}
                  className="p-1 rounded hover:bg-primary/20 transition-colors disabled:opacity-50"
                  title="Quick save view"
                >
                  <Save className={`h-3.5 w-3.5 ${isQuickSaving ? "animate-pulse" : ""}`} />
                </button>
              )}
              {onCloseView && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onCloseView()
                  }}
                  className="p-1 rounded hover:bg-primary/20 transition-colors"
                  title="Close view"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Manage Grid View dropdown */}
        <DropdownMenu modal={false} open={manageGridViewOpen} onOpenChange={setManageGridViewOpen}>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              Manage Grid View
              <ChevronDown className="h-4 w-4 ml-2" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48 z-[100]">
            <DropdownMenuItem
              onSelect={(e) => {
                e.preventDefault()
                setManageGridViewOpen(false)
                setTimeout(() => onCustomizeColumns(), 0)
              }}
            >
              Customize Columns
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={(e) => {
                e.preventDefault()
                setManageGridViewOpen(false)
                setTimeout(() => onSaveView(), 0)
              }}
            >
              Save New View
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={(e) => {
                e.preventDefault()
                setManageGridViewOpen(false)
                setTimeout(() => onManageViews(), 0)
              }}
            >
              Manage Saved Views
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}
