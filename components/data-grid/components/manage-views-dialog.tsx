"use client"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Edit2, Trash2, ChevronLeft, ChevronRight } from "lucide-react"
import type { SavedView } from "../types"

interface ManageViewsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  savedViews: SavedView[]
  filteredViews: SavedView[]
  currentViewName: string | null
  isLoading: boolean
  searchTerm: string
  onSearchChange: (term: string) => void
  onApplyView: (view: SavedView) => void
  onEditView: (view: SavedView) => void
  onDeleteView: (viewId: string) => void
  currentPage?: number
  totalPages?: number
  totalElements?: number
  firstPage?: boolean
  lastPage?: boolean
  onNextPage?: () => void
  onPreviousPage?: () => void
}

export function ManageViewsDialog({
  open,
  onOpenChange,
  savedViews,
  filteredViews,
  currentViewName,
  isLoading,
  searchTerm,
  onSearchChange,
  onApplyView,
  onEditView,
  onDeleteView,
  currentPage = 0,
  totalPages = 1,
  totalElements = 0,
  firstPage = true,
  lastPage = true,
  onNextPage,
  onPreviousPage,
}: ManageViewsDialogProps) {
  const views = filteredViews || []
  const allViews = savedViews || []
  const search = searchTerm || ""

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[80vh] p-0 flex flex-col">
        <DialogHeader className="p-6 pb-4">
          <DialogTitle className="text-xl font-semibold text-[#292929]">Please select a custom grid view</DialogTitle>
          <DialogDescription>Choose, edit, or delete your saved grid views.</DialogDescription>
        </DialogHeader>

        <div className="px-6 pb-2">
          <Input
            placeholder="Search views..."
            className="w-full"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>

        <div className="px-6 pb-4 flex-1 overflow-y-auto">
          <div className="space-y-1">
            {isLoading && <div className="text-sm text-gray-500 p-2 text-center">Loading saved views...</div>}
            {!isLoading &&
              views.map((view) => (
                <div
                  key={view.id}
                  className={`p-3 hover:bg-[#f8f8f8] cursor-pointer rounded text-sm border-b border-[#eaeaea] last:border-b-0 flex items-center justify-between group ${
                    currentViewName === view.name ? "bg-[#e4f0f8] text-[#2d7abe]" : "text-[#292929]"
                  }`}
                >
                  <span
                    className="flex-1"
                    onClick={() => {
                      onApplyView(view)
                      onOpenChange(false)
                    }}
                  >
                    {view.name}
                  </span>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 hover:bg-[#e8e8e8]"
                      onClick={(e) => {
                        e.stopPropagation()
                        onEditView(view)
                      }}
                    >
                      <Edit2 className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 hover:bg-[#e8e8e8] hover:text-red-600"
                      onClick={(e) => {
                        e.stopPropagation()
                        onDeleteView(view.id)
                      }}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            {views.length === 0 && search && !isLoading && (
              <div className="p-3 text-sm text-[#747474] text-center">No views match your search.</div>
            )}
            {totalElements === 0 && !isLoading && !search && (
              <div className="p-3 text-xs text-[#747474] text-center whitespace-nowrap">
                No saved views yet. Create one by customizing columns and saving a view.
              </div>
            )}
          </div>
        </div>

        {totalPages > 1 && (
          <div className="px-6 py-3 border-t flex items-center justify-between">
            <Button variant="outline" size="sm" disabled={firstPage || isLoading} onClick={onPreviousPage}>
              <ChevronLeft className="h-4 w-4 mr-1" />
              Previous
            </Button>
            <div className="text-sm text-[#747474]">
              Page {currentPage + 1} of {totalPages} ({totalElements} total)
            </div>
            <Button variant="outline" size="sm" disabled={lastPage || isLoading} onClick={onNextPage}>
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        )}

        <DialogFooter className="p-6 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
