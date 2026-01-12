"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { AlertCircle, CheckCircle2 } from "lucide-react"

interface QueryResultsProps {
  results: any | null
  error: string | null
  isLoading?: boolean
}

export function QueryResults({ results, error, isLoading = false }: QueryResultsProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Results</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-pulse text-muted-foreground">Executing query...</div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className="border-destructive">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-destructive" />
            Error
          </CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="bg-destructive/10 text-destructive p-4 rounded-md overflow-x-auto text-sm font-mono whitespace-pre-wrap">
            {error}
          </pre>
        </CardContent>
      </Card>
    )
  }

  if (!results) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Results</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Run a query to see results here.</p>
        </CardContent>
      </Card>
    )
  }

  const totalElements = results.totalElements ?? results.total ?? "?"
  const dataCount = Array.isArray(results.data) ? results.data.length : 0

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-green-500" />
          Results
        </CardTitle>
        <div className="flex items-center gap-2">
          <Badge variant="secondary">{dataCount} returned</Badge>
          <Badge variant="outline">{totalElements} total</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <pre className="bg-muted p-4 rounded-md overflow-x-auto text-xs font-mono max-h-[400px] overflow-y-auto">
          {JSON.stringify(results, null, 2)}
        </pre>
      </CardContent>
    </Card>
  )
}
