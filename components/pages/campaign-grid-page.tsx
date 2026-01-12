"use client"

import { useState, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { DataGrid } from "@/components/data-grid"
import type { Column } from "@/components/data-grid/types"
import { fetchJourneyGrid } from "@/app/actions/journey-grid-actions"
import { Grid3X3, Search, X } from "lucide-react"

interface CampaignGridPageProps {
  initialCampaignId?: string
  title?: string
  onJourneyClick?: (journey: Record<string, any>) => void
  /** Optional column overrides to customize auto-generated columns */
  columnOverrides?: Record<string, Partial<Column>>
}

/**
 * Campaign Grid Page Component
 *
 * Displays a data grid for journey records filtered by campaign ID.
 * Columns are auto-generated from the API response data.
 *
 * @example
 * // Basic usage
 * <CampaignGridPage />
 *
 * @example
 * // With pre-set campaign and column overrides
 * <CampaignGridPage
 *   initialCampaignId="12345"
 *   columnOverrides={{
 *     memberFirstName: { visible: true, pinned: true },
 *     journeyId: { visible: false }
 *   }}
 * />
 */
export function CampaignGridPage({ initialCampaignId, title, onJourneyClick, columnOverrides }: CampaignGridPageProps) {
  const [campaignIdInput, setCampaignIdInput] = useState(initialCampaignId || "")
  const [activeCampaignId, setActiveCampaignId] = useState(initialCampaignId || "")
  const [isGridVisible, setIsGridVisible] = useState(!!initialCampaignId)

  const handleLoadGrid = useCallback(() => {
    if (campaignIdInput.trim()) {
      setActiveCampaignId(campaignIdInput.trim())
      setIsGridVisible(true)
    }
  }, [campaignIdInput])

  const handleClearGrid = useCallback(() => {
    setActiveCampaignId("")
    setIsGridVisible(false)
  }, [])

  const fetchData = useCallback(
    async (params: {
      page: number
      pageSize: number
      filters: Record<string, string>
      sortColumn: string | null
      sortDirection: "asc" | "desc"
    }) => {
      const result = await fetchJourneyGrid({
        campaignId: activeCampaignId,
        page: params.page,
        pageSize: params.pageSize,
        filters: params.filters,
        sortColumn: params.sortColumn,
        sortDirection: params.sortDirection,
      })
      return {
        data: result.data,
        totalElements: result.totalElements,
      }
    },
    [activeCampaignId],
  )

  if (!isGridVisible) {
    return (
      <div className="h-full overflow-auto p-6">
        <div className="max-w-md mx-auto mt-12">
          <Card className="bg-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Grid3X3 className="h-5 w-5" />
                Campaign Grid
              </CardTitle>
              <CardDescription>Enter a campaign ID to view journey data</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="campaignId">Campaign ID</Label>
                <Input
                  id="campaignId"
                  type="text"
                  placeholder="Enter campaign ID..."
                  value={campaignIdInput}
                  onChange={(e) => setCampaignIdInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleLoadGrid()
                    }
                  }}
                />
              </div>
              <Button onClick={handleLoadGrid} disabled={!campaignIdInput.trim()} className="w-full">
                <Search className="h-4 w-4 mr-2" />
                Load Campaign Grid
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      <div className="px-4 py-2 bg-muted/50 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>Campaign ID:</span>
          <code className="px-2 py-0.5 bg-background rounded border border-border font-mono">{activeCampaignId}</code>
        </div>
        <Button variant="ghost" size="sm" onClick={handleClearGrid}>
          <X className="h-4 w-4 mr-1" />
          Change Campaign
        </Button>
      </div>

      <div className="flex-1 overflow-hidden">
        <DataGrid
          campaignId={activeCampaignId}
          title={title || `Campaign ${activeCampaignId}`}
          fetchData={fetchData}
          onJourneyClick={onJourneyClick}
          gridIdentifier={`campaign-${activeCampaignId}`}
          columnOverrides={columnOverrides}
        />
      </div>
    </div>
  )
}
