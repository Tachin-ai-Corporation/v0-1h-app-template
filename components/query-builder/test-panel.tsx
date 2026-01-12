"use client"

import { useState } from "react"
import { Copy, Check, Play, Loader2, AlertCircle, CheckCircle2, ChevronDown, ChevronUp } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import type { QueryRequestBody } from "@/lib/types/query-builder"
import { generateQueryCurl, formatQueryJson } from "@/lib/utils/query-generator"
import { ResponseDataViewer } from "./response-data-viewer"

interface TestPanelProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  request: QueryRequestBody | null
  onExecute: () => void
  isExecuting: boolean
  results: any | null
  error: string | null
  baseUrl?: string
}

export function TestPanel({
  open,
  onOpenChange,
  request,
  onExecute,
  isExecuting,
  results,
  error,
  baseUrl = "https://app.1health.io",
}: TestPanelProps) {
  const [copied, setCopied] = useState<"curl" | "json" | null>(null)
  const [responseTab, setResponseTab] = useState<"data" | "raw">("data")
  const [requestPreviewOpen, setRequestPreviewOpen] = useState(true)

  const handleCopy = async (type: "curl" | "json") => {
    if (!request) return

    const text = type === "curl" ? generateQueryCurl(request, baseUrl) : formatQueryJson(request)

    await navigator.clipboard.writeText(text)
    setCopied(type)
    setTimeout(() => setCopied(null), 2000)
  }

  const totalElements = results?.totalElements ?? results?.total ?? "?"
  const dataCount = Array.isArray(results?.data) ? results.data.length : 0

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="!w-[75vw] !max-w-[75vw] min-w-[400px] p-0 flex flex-col h-screen overflow-hidden sm:max-w-[75vw]">
        {/* Header with Run button */}
        <SheetHeader className="px-6 py-4 border-b bg-muted/30 flex-shrink-0">
          <div className="flex items-center justify-between pr-10">
            <div>
              <SheetTitle className="text-lg">Test Query</SheetTitle>
              <SheetDescription className="mt-1">Preview and execute your query</SheetDescription>
            </div>
            <Button onClick={onExecute} disabled={isExecuting || !request} size="default" className="gap-2">
              {isExecuting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Running...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4" />
                  Run Query
                </>
              )}
            </Button>
          </div>
        </SheetHeader>

        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
          <ScrollArea className="flex-1">
            <div className="p-6 space-y-4">
              <Collapsible open={requestPreviewOpen} onOpenChange={setRequestPreviewOpen}>
                <div className="flex items-center justify-between">
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="sm" className="gap-2 -ml-2 font-medium">
                      {requestPreviewOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
                      Request Preview
                    </Button>
                  </CollapsibleTrigger>
                  {!requestPreviewOpen && request && (
                    <Badge variant="secondary" className="text-xs">
                      {request.key}
                    </Badge>
                  )}
                </div>

                <CollapsibleContent className="mt-3">
                  {!request ? (
                    <div className="bg-muted/50 rounded-lg p-6 text-center">
                      <p className="text-sm text-muted-foreground">
                        Select a type and configure your query to see the preview.
                      </p>
                    </div>
                  ) : (
                    <Tabs defaultValue="curl" className="w-full">
                      <TabsList className="mb-3">
                        <TabsTrigger value="curl" className="text-xs">
                          cURL
                        </TabsTrigger>
                        <TabsTrigger value="json" className="text-xs">
                          JSON
                        </TabsTrigger>
                      </TabsList>

                      <TabsContent value="curl" className="mt-0">
                        <div className="rounded-lg border bg-muted overflow-hidden">
                          <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/50 gap-2">
                            <span className="text-xs text-muted-foreground font-medium flex-shrink-0">
                              cURL Command
                            </span>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 gap-1.5 text-xs flex-shrink-0"
                              onClick={() => handleCopy("curl")}
                            >
                              {copied === "curl" ? (
                                <>
                                  <Check className="h-3.5 w-3.5 text-green-500" />
                                  Copied
                                </>
                              ) : (
                                <>
                                  <Copy className="h-3.5 w-3.5" />
                                  Copy
                                </>
                              )}
                            </Button>
                          </div>
                          <pre className="p-4 overflow-x-auto text-xs font-mono whitespace-pre-wrap max-h-[200px] overflow-y-auto">
                            {generateQueryCurl(request, baseUrl)}
                          </pre>
                        </div>
                      </TabsContent>

                      <TabsContent value="json" className="mt-0">
                        <div className="rounded-lg border bg-muted overflow-hidden">
                          <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/50 gap-2">
                            <span className="text-xs text-muted-foreground font-medium flex-shrink-0">JSON Body</span>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 gap-1.5 text-xs flex-shrink-0"
                              onClick={() => handleCopy("json")}
                            >
                              {copied === "json" ? (
                                <>
                                  <Check className="h-3.5 w-3.5 text-green-500" />
                                  Copied
                                </>
                              ) : (
                                <>
                                  <Copy className="h-3.5 w-3.5" />
                                  Copy
                                </>
                              )}
                            </Button>
                          </div>
                          <pre className="p-4 overflow-x-auto text-xs font-mono max-h-[200px] overflow-y-auto">
                            {formatQueryJson(request)}
                          </pre>
                        </div>
                      </TabsContent>
                    </Tabs>
                  )}
                </CollapsibleContent>
              </Collapsible>

              <Separator />

              {/* Results Section */}
              <section>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-medium flex items-center gap-2">
                    {error ? (
                      <>
                        <AlertCircle className="h-4 w-4 text-destructive" />
                        <span className="text-destructive">Error</span>
                      </>
                    ) : results ? (
                      <>
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                        <span>Response</span>
                      </>
                    ) : (
                      "Response"
                    )}
                  </h3>
                  {results && (
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="font-mono text-xs">
                        {dataCount} returned
                      </Badge>
                      <Badge variant="outline" className="font-mono text-xs">
                        {totalElements} total
                      </Badge>
                    </div>
                  )}
                </div>

                {isExecuting ? (
                  <div className="bg-muted/50 rounded-lg p-8 flex flex-col items-center justify-center gap-3 border">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Executing query...</p>
                  </div>
                ) : error ? (
                  <div className="rounded-lg border border-destructive/20 bg-destructive/10 overflow-hidden">
                    <pre className="p-4 overflow-x-auto text-sm font-mono whitespace-pre-wrap text-destructive max-h-[400px] overflow-y-auto">
                      {error}
                    </pre>
                  </div>
                ) : results ? (
                  <Tabs
                    value={responseTab}
                    onValueChange={(v) => setResponseTab(v as "data" | "raw")}
                    className="w-full"
                  >
                    <TabsList className="mb-3">
                      <TabsTrigger value="data" className="text-xs">
                        Data View
                      </TabsTrigger>
                      <TabsTrigger value="raw" className="text-xs">
                        Raw JSON
                      </TabsTrigger>
                    </TabsList>

                    <TabsContent value="data" className="mt-0">
                      <div className="rounded-lg border bg-card p-4 max-h-[calc(100vh-400px)] overflow-y-auto">
                        <ResponseDataViewer data={results} />
                      </div>
                    </TabsContent>

                    <TabsContent value="raw" className="mt-0">
                      <div className="rounded-lg border bg-muted overflow-hidden">
                        <pre className="p-4 overflow-x-auto text-xs font-mono max-h-[calc(100vh-400px)] overflow-y-auto">
                          {JSON.stringify(results, null, 2)}
                        </pre>
                      </div>
                    </TabsContent>
                  </Tabs>
                ) : (
                  <div className="bg-muted/50 rounded-lg p-6 text-center border">
                    <p className="text-sm text-muted-foreground">Run a query to see the response here.</p>
                  </div>
                )}
              </section>
            </div>
          </ScrollArea>
        </div>
      </SheetContent>
    </Sheet>
  )
}
