"use client"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"

interface ExportProgress {
  processed: number
  total: number
  fileId?: string
  fileName?: string
}

interface ExportProgressDialogProps {
  isOpen: boolean
  onClose: () => void
  isExporting: boolean
  exportError: string | null
  exportProgress: ExportProgress | null
  isDownloading: boolean
  onDownload: () => void
}

export function ExportProgressDialog({
  isOpen,
  onClose,
  isExporting,
  exportError,
  exportProgress,
  isDownloading,
  onDownload,
}: ExportProgressDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Export Progress</DialogTitle>
          <DialogDescription>
            {isExporting ? "Exporting..." : exportError ? "Export Failed" : "Export Complete"}
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          {isExporting ? (
            exportProgress ? (
              <div className="space-y-2">
                <Progress
                  value={exportProgress.total > 0 ? (exportProgress.processed / exportProgress.total) * 100 : 0}
                />
                <div className="text-sm text-muted-foreground">
                  {exportProgress.processed} / {exportProgress.total} records processed
                </div>
              </div>
            ) : (
              <div>Initializing export...</div>
            )
          ) : exportError ? (
            <div className="text-red-600">{exportError}</div>
          ) : exportProgress?.fileId ? (
            <div className="space-y-2">
              <div className="text-green-600">Export finished successfully!</div>
              {exportProgress.fileName && (
                <div className="text-sm text-muted-foreground">File: {exportProgress.fileName}</div>
              )}
            </div>
          ) : (
            <div>Export finished successfully.</div>
          )}
        </div>
        <DialogFooter>
          {isExporting ? (
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
          ) : (
            <>
              <Button variant="outline" onClick={onClose}>
                Close
              </Button>
              {exportProgress?.fileId && (
                <Button onClick={onDownload} disabled={isDownloading}>
                  {isDownloading ? "Downloading..." : "Download File"}
                </Button>
              )}
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
