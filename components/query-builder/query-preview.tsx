"use client"

import { useState } from "react"
import { Copy, Check, Play, Loader2 } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { QueryRequestBody } from "@/lib/types/query-builder"
import { generateQueryCurl, formatQueryJson } from "@/lib/utils/query-generator"

interface QueryPreviewProps {
  request: QueryRequestBody | null
  onExecute: () => void
  isExecuting?: boolean
  baseUrl?: string
}

export function QueryPreview({
  request,
  onExecute,
  isExecuting = false,
  baseUrl = "https://app.1health.io",
}: QueryPreviewProps) {
  const [copied, setCopied] = useState<"curl" | "json" | null>(null)

  const handleCopy = async (type: "curl" | "json") => {
    if (!request) return

    const text = type === "curl" ? generateQueryCurl(request, baseUrl) : formatQueryJson(request)

    await navigator.clipboard.writeText(text)
    setCopied(type)
    setTimeout(() => setCopied(null), 2000)
  }

  if (!request) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Query Preview</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Select a type and configure your query to see the preview.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-lg">Query Preview</CardTitle>
        <Button onClick={onExecute} disabled={isExecuting} size="sm">
          {isExecuting ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Running...
            </>
          ) : (
            <>
              <Play className="h-4 w-4 mr-2" />
              Run Query
            </>
          )}
        </Button>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="curl">
          <TabsList className="mb-2">
            <TabsTrigger value="curl">cURL</TabsTrigger>
            <TabsTrigger value="json">JSON Body</TabsTrigger>
          </TabsList>

          <TabsContent value="curl" className="relative">
            <Button variant="ghost" size="sm" className="absolute top-2 right-2" onClick={() => handleCopy("curl")}>
              {copied === "curl" ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
            </Button>
            <pre className="bg-muted p-4 rounded-md overflow-x-auto text-xs font-mono whitespace-pre-wrap">
              {generateQueryCurl(request, baseUrl)}
            </pre>
          </TabsContent>

          <TabsContent value="json" className="relative">
            <Button variant="ghost" size="sm" className="absolute top-2 right-2" onClick={() => handleCopy("json")}>
              {copied === "json" ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
            </Button>
            <pre className="bg-muted p-4 rounded-md overflow-x-auto text-xs font-mono">{formatQueryJson(request)}</pre>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}
