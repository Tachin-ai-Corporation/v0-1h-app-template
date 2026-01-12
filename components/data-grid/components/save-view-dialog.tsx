"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

interface SaveViewDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (viewName: string) => void
}

export function SaveViewDialog({ open, onOpenChange, onSave }: SaveViewDialogProps) {
  const [viewName, setViewName] = useState("")

  const handleSave = () => {
    onSave(viewName)
    setViewName("")
  }

  const handleCancel = () => {
    onOpenChange(false)
    setViewName("")
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-lg font-medium text-[#292929]">Save New View</DialogTitle>
          <DialogDescription>Enter a name to save your current grid view configuration.</DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <Input
            placeholder="e.g., My Custom View"
            value={viewName}
            onChange={(e) => setViewName(e.target.value)}
            className="w-full"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                handleSave()
              }
            }}
          />
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!viewName.trim()}>
            Confirm
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
