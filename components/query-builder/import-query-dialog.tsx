"use client"

import type React from "react"

import { useState } from "react"
import { Upload, FileJson, AlertCircle } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"

interface ImportQueryDialogProps {
  onImport: (payload: string) => Promise<void>
  disabled?: boolean
}

export function ImportQueryDialog({ onImport, disabled }: ImportQueryDialogProps) {
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isImporting, setIsImporting] = useState(false)

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const pastedText = e.clipboardData.getData("text")

    // Try to parse and format JSON
    try {
      // Check if it's a cURL command with JSON
      const curlMatch = pastedText.match(/-d\s*'([^']+)'/) || pastedText.match(/-d\s*"([^"]+)"/)
      const jsonStr = curlMatch ? curlMatch[1] : pastedText

      const parsed = JSON.parse(jsonStr)
      const formatted = JSON.stringify(parsed, null, 2)

      e.preventDefault()
      setInput(curlMatch ? pastedText : formatted)
    } catch {
      // Not valid JSON, let default paste happen
    }
  }

  const handleImport = async () => {
    if (!input.trim()) {
      setError("Please paste a query payload or cURL command")
      return
    }

    setIsImporting(true)
    setError(null)

    try {
      await onImport(input)
      setOpen(false)
      setInput("")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to import query")
    } finally {
      setIsImporting(false)
    }
  }

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen)
    if (!newOpen) {
      setInput("")
      setError(null)
    }
  }

  const lineCount = input.split("\n").length
  const charCount = input.length

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" disabled={disabled}>
          <Upload className="h-4 w-4 mr-2" />
          Import Query
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[700px] h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <FileJson className="h-5 w-5" />
            Import Query
          </DialogTitle>
          <DialogDescription>
            Paste a previous query payload (JSON) or cURL command to reconstruct the query in the builder.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 py-4 flex flex-col">
          <div className="flex-1 min-h-0 flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <Label htmlFor="query-input">Query Payload or cURL</Label>
              {input && (
                <span className="text-xs text-muted-foreground">
                  {lineCount} lines, {charCount.toLocaleString()} chars
                </span>
              )}
            </div>
            <div className="flex-1 min-h-0 border rounded-md overflow-hidden">
              <textarea
                id="query-input"
                placeholder={`Paste JSON payload:\n{\n  "key": "WorkflowTemplate",\n  "attributes": ["status", "name"],\n  "relationships": [...]\n}\n\nOr paste a cURL command:\ncurl -X POST 'https://...' -d '{...}'`}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onPaste={handlePaste}
                className="w-full h-full p-3 font-mono text-sm resize-none bg-background focus:outline-none overflow-auto"
              />
            </div>
          </div>
        </div>

        {error && (
          <Alert variant="destructive" className="flex-shrink-0">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <DialogFooter className="flex-shrink-0">
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleImport} disabled={isImporting || !input.trim()}>
            {isImporting ? "Importing..." : "Import"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
