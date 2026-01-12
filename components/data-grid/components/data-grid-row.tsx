"use client"

import { Checkbox } from "@/components/ui/checkbox"
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from "@/components/ui/context-menu"
import { Copy } from "lucide-react"

interface Column {
  id: string
  label: string
  key: string
  width: number
  visible: boolean
  pinned: boolean
  filterable: boolean
  sortable?: boolean
}

interface DataGridRowProps {
  row: Record<string, any>
  rowId: string
  columns: Column[]
  pinnedColumns: Column[]
  unpinnedColumns: Column[]
  selectedRows: Set<string>
  onRowSelect: (rowId: string, checked: boolean) => void
  onJourneyClick?: (row: Record<string, any>) => void
  handleCopyCell: (value: any) => void
}

export function DataGridRow({
  row,
  rowId,
  columns,
  pinnedColumns,
  unpinnedColumns,
  selectedRows,
  onRowSelect,
  onJourneyClick,
  handleCopyCell,
}: DataGridRowProps) {
  const isSelected = selectedRows.has(String(rowId))

  const isTagsColumn = (key: string) => {
    return key === "tags" || key === "partnerTags" || key === "partnersTags"
  }

  const renderCellContent = (column: Column, value: any) => {
    const displayValue = value === null || value === undefined ? "" : String(value)

    if (column.key === "id" && onJourneyClick) {
      return (
        <div
          className="py-3 px-2 text-sm text-link truncate cursor-pointer hover:underline"
          onClick={() => onJourneyClick(row)}
        >
          {displayValue}
        </div>
      )
    }

    if (isTagsColumn(column.key)) {
      return (
        <div
          className="py-3 px-2 overflow-x-auto overflow-y-hidden scrollbar-thin scrollbar-thumb-transparent hover:scrollbar-thumb-gray-300 scrollbar-track-transparent"
          style={{
            scrollbarWidth: "thin",
            scrollbarColor: "transparent transparent",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.scrollbarColor = "#d1d5db transparent"
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.scrollbarColor = "transparent transparent"
          }}
        >
          <div className="text-sm whitespace-nowrap" style={{ color: "var(--foreground)" }}>
            {displayValue}
          </div>
        </div>
      )
    }

    return (
      <div className="py-3 px-2 text-sm truncate" style={{ color: "var(--foreground)" }}>
        {displayValue}
      </div>
    )
  }

  return (
    <tr className="hover:bg-muted/50" style={{ backgroundColor: "var(--background)" }}>
      {/* Checkbox column */}
      <td
        className="sticky left-0 p-2 bg-background z-10"
        style={{
          width: 48,
          minWidth: 48,
          maxWidth: 48,
          boxShadow: pinnedColumns.length === 0 ? "2px 0 3px rgba(0,0,0,0.1)" : "none",
          backgroundColor: "var(--background)",
        }}
      >
        <div className="flex items-center justify-center">
          <Checkbox
            checked={isSelected}
            onCheckedChange={(checked) => onRowSelect(String(rowId), checked as boolean)}
            className="h-5 w-5 border border-muted-foreground data-[state=checked]:bg-primary data-[state=checked]:border-primary"
          />
        </div>
      </td>

      {/* Pinned columns */}
      {pinnedColumns.map((column, index) => {
        const cumulativeLeft = 48 + pinnedColumns.slice(0, index).reduce((acc, col) => acc + col.width, 0)
        return (
          <ContextMenu key={column.id}>
            <ContextMenuTrigger asChild>
              <td
                className="sticky bg-background z-5 border-b border-border relative"
                style={{
                  width: column.width,
                  left: cumulativeLeft,
                  backgroundColor: "var(--background)",
                }}
              >
                {renderCellContent(column, row[column.key])}
                {index === pinnedColumns.length - 1 && pinnedColumns.length > 0 && (
                  <div className="absolute right-0 top-0 w-[3px] h-full bg-primary" />
                )}
              </td>
            </ContextMenuTrigger>
            <ContextMenuContent>
              <ContextMenuItem onClick={() => handleCopyCell(row[column.key])}>
                <Copy className="mr-2 h-4 w-4" />
                Copy Cell Value
              </ContextMenuItem>
            </ContextMenuContent>
          </ContextMenu>
        )
      })}

      {/* Unpinned columns */}
      {unpinnedColumns.map((column) => (
        <ContextMenu key={column.id}>
          <ContextMenuTrigger asChild>
            <td
              className="border-b border-border"
              style={{ width: column.width, minWidth: column.width, backgroundColor: "var(--background)" }}
            >
              {renderCellContent(column, row[column.key])}
            </td>
          </ContextMenuTrigger>
          <ContextMenuContent>
            <ContextMenuItem onClick={() => handleCopyCell(row[column.key])}>
              <Copy className="mr-2 h-4 w-4" />
              Copy Cell Value
            </ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>
      ))}
    </tr>
  )
}
