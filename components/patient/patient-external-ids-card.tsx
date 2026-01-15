"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { ExternalIdSelector } from "@/components/external-id-selector"
import type { ExternalSystemId } from "@/lib/api/query-person"

interface PatientExternalIdsCardProps {
  externalIds: ExternalSystemId[]
  isLoading?: boolean
}

export function PatientExternalIdsCard({ externalIds, isLoading }: PatientExternalIdsCardProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold">External IDs</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-6 w-48" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-semibold">External IDs</CardTitle>
      </CardHeader>
      <CardContent>
        <ExternalIdSelector externalIds={externalIds} isLoading={isLoading} />
      </CardContent>
    </Card>
  )
}
