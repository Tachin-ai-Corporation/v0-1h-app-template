"use client"

import type React from "react"

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Search } from "lucide-react"

interface Column {
  id: string
  key: string
  label: string
  visible: boolean
  pinned?: boolean
}

interface ColumnManagerDialogProps {
  isOpen: boolean
  onClose: () => void
  columns: Column[]
  setColumns: React.Dispatch<React.SetStateAction<Column[]>>
  columnSearchTerm: string
  setColumnSearchTerm: (value: string) => void
  selectAllColumns: boolean
  setSelectAllColumns: (value: boolean) => void
  columnValidationError: string
  setColumnValidationError: (value: string) => void
  handleColumnVisibilityChange: (columnId: string, visible: boolean) => void
  handleResetColumns: () => void
  handleSaveColumns: () => void
}

export function ColumnManagerDialog({
  isOpen,
  onClose,
  columns,
  setColumns,
  columnSearchTerm,
  setColumnSearchTerm,
  selectAllColumns,
  setSelectAllColumns,
  columnValidationError,
  setColumnValidationError,
  handleColumnVisibilityChange,
  handleResetColumns,
  handleSaveColumns,
}: ColumnManagerDialogProps) {
  const searchTerm = columnSearchTerm || ""
  const filteredColumns = searchTerm.trim()
    ? columns.filter(
        (col) =>
          col.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
          col.key.toLowerCase().includes(searchTerm.toLowerCase()),
      )
    : columns

  const isAllSelected = columns.length > 0 && columns.every((col) => col.visible)

  const handleSelectAll = (checked: boolean) => {
    setSelectAllColumns(checked)
    setColumns((prev) => prev.map((col) => ({ ...col, visible: checked })))
    if (columnValidationError) {
      setColumnValidationError("")
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Customize Columns</DialogTitle>
          <DialogDescription>Select which columns to display in your grid</DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col space-y-4">
          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search columns..."
              value={searchTerm}
              onChange={(e) => setColumnSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Select All Checkbox */}
          <div className="flex items-center space-x-2 pb-2 border-b">
            <Checkbox id="select-all-columns" checked={isAllSelected} onCheckedChange={handleSelectAll} />
            <label htmlFor="select-all-columns" className="text-sm font-medium leading-none cursor-pointer">
              Select All
            </label>
          </div>

          {/* Validation Error */}
          {columnValidationError && <div className="text-sm text-destructive">{columnValidationError}</div>}

          {/* Column List */}
          <div className="flex-1 overflow-y-auto">
            <div className="grid grid-cols-2 gap-3">
              {filteredColumns.map((column) => (
                <div key={column.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={`column-${column.id}`}
                    checked={column.visible}
                    onCheckedChange={(checked) => handleColumnVisibilityChange(column.id, checked as boolean)}
                  />
                  <label
                    htmlFor={`column-${column.id}`}
                    className="text-sm font-medium leading-none cursor-pointer select-none"
                  >
                    {column.label}
                  </label>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex justify-between pt-4 border-t">
          <Button variant="outline" onClick={handleResetColumns}>
            Reset to Default
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleSaveColumns}>Save</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
