"use client"

import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface DataGridPaginationProps {
  currentPage: number
  pageSize: number
  totalPages: number
  paginatedDataLength: number
  filteredDataLength: number
  totalDataLength: number
  selectedRowsCount: number
  onPageChange: (page: number) => void
  onPageSizeChange: (size: number) => void
}

export function DataGridPagination({
  currentPage,
  pageSize,
  totalPages,
  paginatedDataLength,
  filteredDataLength,
  totalDataLength,
  selectedRowsCount,
  onPageChange,
  onPageSizeChange,
}: DataGridPaginationProps) {
  const startIndex = (currentPage - 1) * pageSize + 1
  const endIndex = Math.min(currentPage * pageSize, filteredDataLength)

  return (
    <div className="flex items-center justify-between px-4 py-2 border border-border rounded-lg bg-card">
      {/* Left side - Results info */}
      <div className="flex items-center gap-3 text-sm text-card-foreground">
        {selectedRowsCount > 0 && <span className="font-medium">{selectedRowsCount} selected</span>}
        <span>
          Showing {filteredDataLength > 0 ? startIndex : 0} to {endIndex} of {filteredDataLength} results
        </span>
      </div>

      {/* Right side - Controls */}
      <div className="flex items-center gap-4">
        {/* Rows per page */}
        <div className="flex items-center gap-2 text-sm text-card-foreground">
          <span>Rows per page:</span>
          <Select value={String(pageSize)} onValueChange={(value) => onPageSizeChange(Number(value))}>
            <SelectTrigger className="w-[70px] h-8 text-sm border-0 bg-muted hover:bg-muted/80 focus:ring-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="25">25</SelectItem>
              <SelectItem value="50">50</SelectItem>
              <SelectItem value="100">100</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Page info */}
        <span className="text-sm text-card-foreground">
          Page {currentPage} of {totalPages || 1}
        </span>

        {/* Page navigation */}
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => onPageChange(1)}
            disabled={currentPage === 1}
          >
            <ChevronsLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage === 1}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage >= totalPages}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => onPageChange(totalPages)}
            disabled={currentPage >= totalPages}
          >
            <ChevronsRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
