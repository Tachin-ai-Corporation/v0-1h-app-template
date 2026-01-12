"use client"

import type React from "react"

import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from "@/components/ui/context-menu"
import { GripVertical, Pin, PinOff, X } from "lucide-react"
import type { Column } from "@/components/data-grid/types"
import { BooleanFilter } from "./boolean-filter"
import { DateRangeFilter } from "./date-range-filter"
import { MultiSelectFilter } from "./multi-select-filter"
import { DateFilter } from "./date-filter"
import { SelectFilter } from "./select-filter"

interface ExtendedColumn extends Column {
  filterOptions?: { label: string; value: string }[]
}

interface DataGridHeaderProps {
  pinnedColumns: ExtendedColumn[]
  unpinnedColumns: ExtendedColumn[]
  isAllSelected: boolean
  isIndeterminate: boolean
  filterInputs: Record<string, string>
  filterOptions?: Record<string, string[]>
  resizingColumn: string | null
  sortColumn: string | null
  sortDirection: "asc" | "desc" | null
  onSelectAll: (checked: boolean) => void
  onSort: (columnId: string) => void
  onFilterChange: (key: string, value: string) => void
  onResizeStart: (e: React.MouseEvent, columnId: string) => void
  onDragStart: (e: React.DragEvent, columnId: string) => void
  onDragEnd: () => void
  onDragOver: (e: React.DragEvent) => void
  onDrop: (e: React.DragEvent, columnId: string) => void
  onTogglePin: (columnId: string, isPinned: boolean) => void
  onHideColumn: (columnId: string) => void
  getSortIcon: (columnId: string) => React.ReactNode
  onFilterOpen?: (columnKey: string) => void
}

export function DataGridHeader({
  pinnedColumns,
  unpinnedColumns,
  isAllSelected,
  isIndeterminate,
  filterInputs,
  filterOptions = {},
  resizingColumn,
  onSelectAll,
  onSort,
  onFilterChange,
  onResizeStart,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
  onTogglePin,
  onHideColumn,
  getSortIcon,
  onFilterOpen,
}: DataGridHeaderProps) {
  console.log(
    "[v0] DataGridHeader - Pinned columns:",
    pinnedColumns.map((c) => c.id),
  )
  console.log(
    "[v0] DataGridHeader - Unpinned columns:",
    unpinnedColumns.map((c) => c.id),
  )

  const renderFilter = (column: ExtendedColumn) => {
    if (!column.filterable) {
      return <div className="px-2 pb-2 h-[32px]" />
    }

    const filterType = column.filterType || "text"

    if (filterType === "boolean") {
      return (
        <div className="px-2 pb-2 flex items-center">
          <BooleanFilter
            value={filterInputs[column.key] || ""}
            onChange={(value) => onFilterChange(column.key, value)}
            placeholder="Filter..."
          />
        </div>
      )
    }

    if (filterType === "select") {
      const dynamicOptions = filterOptions[column.key] || []
      const staticOptions = column.filterOptions || []
      const options =
        dynamicOptions.length > 0 ? dynamicOptions.map((opt) => ({ label: opt, value: opt })) : staticOptions

      return (
        <div className="px-2 pb-2 flex items-center">
          <SelectFilter
            value={filterInputs[column.key] || ""}
            onChange={(value) => onFilterChange(column.key, value)}
            options={options}
            placeholder="All"
          />
        </div>
      )
    }

    if (filterType === "date") {
      return (
        <div className="px-2 pb-2 flex items-center">
          <DateFilter value={filterInputs[column.key] || ""} onChange={(value) => onFilterChange(column.key, value)} />
        </div>
      )
    }

    if (filterType === "dateRange") {
      return (
        <div className="px-2 pb-2 flex items-center">
          <DateRangeFilter
            value={filterInputs[column.key] || ""}
            onChange={(value) => onFilterChange(column.key, value)}
            placeholder="Filter..."
          />
        </div>
      )
    }

    if (filterType === "multiSelect") {
      const options = filterOptions[column.key] || []
      return (
        <div className="px-2 pb-2 flex items-center">
          <MultiSelectFilter
            value={filterInputs[column.key] || ""}
            onChange={(value) => onFilterChange(column.key, value)}
            options={options}
            placeholder="Filter..."
            onOpen={onFilterOpen ? () => onFilterOpen(column.key) : undefined}
          />
        </div>
      )
    }

    // Default text filter
    return (
      <div className="px-2 pb-2 flex items-center">
        <Input
          placeholder={`Filter...`}
          className="h-6 text-xs px-2 py-1 border-border bg-background w-full font-normal"
          value={filterInputs[column.key] || ""}
          onChange={(e) => onFilterChange(column.key, e.target.value)}
        />
      </div>
    )
  }

  return (
    <thead className="sticky top-0 bg-muted z-20">
      <tr>
        {/* Checkbox column */}
        <th
          className="sticky left-0 bg-muted z-30"
          style={{
            width: 48,
            minWidth: 48,
            maxWidth: 48,
            boxShadow: pinnedColumns.length === 0 ? "2px 0 3px rgba(0,0,0,0.1)" : "none",
          }}
        >
          <div className="flex items-center justify-center">
            <Checkbox
              checked={isAllSelected}
              onCheckedChange={onSelectAll}
              className="h-5 w-5 border border-muted-foreground data-[state=checked]:bg-primary data-[state=checked]:border-primary"
              ref={(el) => el && (el.indeterminate = isIndeterminate)}
            />
          </div>
        </th>

        {/* Pinned columns */}
        {pinnedColumns.map((column, index) => {
          const cumulativeLeft = 48 + pinnedColumns.slice(0, index).reduce((acc, col) => acc + col.width, 0)
          return (
            <ContextMenu key={column.id}>
              <ContextMenuTrigger asChild>
                <th
                  className="bg-muted sticky left-0 top-0 z-30 relative"
                  style={{
                    left: cumulativeLeft,
                    width: column.width,
                    minWidth: column.width,
                    maxWidth: column.width,
                  }}
                  draggable
                  onDragStart={(e) => onDragStart(e, column.id)}
                  onDragEnd={onDragEnd}
                  onDragOver={onDragOver}
                  onDrop={(e) => onDrop(e, column.id)}
                >
                  <div
                    className="p-2 text-left text-sm font-medium text-muted-foreground flex items-center gap-2 h-10 overflow-hidden"
                    title={column.label}
                  >
                    <GripVertical className="h-3 w-3 text-muted-foreground/60 cursor-move flex-shrink-0" />
                    <span className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap min-w-0">
                      {column.label}
                    </span>
                    {column.sortable && (
                      <button
                        onClick={() => onSort(column.id)}
                        className="hover:bg-accent p-1 rounded transition-colors flex-shrink-0"
                        title={`Sort by ${column.label}`}
                      >
                        {getSortIcon(column.id)}
                      </button>
                    )}
                  </div>
                  {renderFilter(column)}
                  <div
                    className="absolute right-0 top-0 w-1 h-full cursor-col-resize hover:bg-primary transition-colors z-40"
                    onMouseDown={(e) => onResizeStart(e, column.id)}
                    style={{
                      backgroundColor: resizingColumn === column.id ? "hsl(var(--primary))" : "transparent",
                    }}
                  />
                  {index === pinnedColumns.length - 1 && pinnedColumns.length > 0 && (
                    <div className="absolute right-0 top-0 w-[3px] h-full bg-primary z-30" />
                  )}
                </th>
              </ContextMenuTrigger>
              <ContextMenuContent>
                <ContextMenuItem onClick={() => onTogglePin(column.id, false)}>
                  <PinOff className="mr-2 h-4 w-4" />
                  Unpin Column
                </ContextMenuItem>
                <ContextMenuItem onClick={() => onHideColumn(column.id)}>
                  <X className="mr-2 h-4 w-4" />
                  Hide Column
                </ContextMenuItem>
              </ContextMenuContent>
            </ContextMenu>
          )
        })}

        {/* Unpinned columns */}
        {unpinnedColumns.map((column) => (
          <ContextMenu key={column.id}>
            <ContextMenuTrigger asChild>
              <th
                className="bg-background relative"
                style={{ width: column.width, minWidth: column.width, maxWidth: column.width }}
                draggable
                onDragStart={(e) => onDragStart(e, column.id)}
                onDragEnd={onDragEnd}
                onDragOver={onDragOver}
                onDrop={(e) => onDrop(e, column.id)}
              >
                <div
                  className="p-2 text-left text-sm font-medium text-muted-foreground flex items-center gap-2 h-10 overflow-hidden"
                  title={column.label}
                >
                  <GripVertical className="h-3 w-3 text-muted-foreground/60 cursor-move flex-shrink-0" />
                  <span className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap min-w-0">{column.label}</span>
                  {column.sortable && (
                    <button
                      onClick={() => onSort(column.id)}
                      className="hover:bg-accent p-1 rounded transition-colors flex-shrink-0"
                      title={`Sort by ${column.label}`}
                    >
                      {getSortIcon(column.id)}
                    </button>
                  )}
                </div>
                {renderFilter(column)}
                <div
                  className="absolute right-0 top-0 w-1 h-full cursor-col-resize hover:bg-primary transition-colors z-40"
                  onMouseDown={(e) => onResizeStart(e, column.id)}
                  style={{
                    backgroundColor: resizingColumn === column.id ? "hsl(var(--primary))" : "transparent",
                  }}
                />
              </th>
            </ContextMenuTrigger>
            <ContextMenuContent>
              <ContextMenuItem onClick={() => onTogglePin(column.id, true)}>
                <Pin className="mr-2 h-4 w-4" />
                Pin Column
              </ContextMenuItem>
              <ContextMenuItem onClick={() => onHideColumn(column.id)}>
                <X className="mr-2 h-4 w-4" />
                Hide Column
              </ContextMenuItem>
            </ContextMenuContent>
          </ContextMenu>
        ))}
      </tr>
    </thead>
  )
}
