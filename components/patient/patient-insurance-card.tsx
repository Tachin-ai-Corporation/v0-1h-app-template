"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { Shield } from "lucide-react"
import type { Insurance } from "@/app/actions/insurance-actions"

interface PatientInsuranceCardProps {
  insurances: Insurance[]
  isLoading?: boolean
}

function formatDate(dateStr: string | undefined): string {
  if (!dateStr) return "N/A"
  try {
    const date = new Date(dateStr)
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    })
  } catch {
    return dateStr
  }
}

export function PatientInsuranceCard({ insurances, isLoading }: PatientInsuranceCardProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Insurance</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    )
  }

  if (insurances.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Insurance</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">No insurance records found</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-semibold">Insurance</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {insurances.map((insurance) => (
          <div key={insurance.id} className="border rounded-lg p-3 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium text-sm">
                  {insurance.insuranceOrganizationDTO?.insuranceCompanyName || "Unknown Insurer"}
                </span>
              </div>
              <Badge variant="secondary" className="text-xs">
                {insurance.insurancePrecedence}
              </Badge>
            </div>

            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-muted-foreground">
              <div>
                <span className="font-medium text-foreground">Member ID:</span> {insurance.memberIdNumber}
              </div>
              <div>
                <span className="font-medium text-foreground">Type:</span> {insurance.insuranceType}
              </div>
              {insurance.insuranceGroupId && (
                <div>
                  <span className="font-medium text-foreground">Group:</span> {insurance.insuranceGroupId}
                </div>
              )}
              <div>
                <span className="font-medium text-foreground">Effective:</span>{" "}
                {formatDate(insurance.planEffectiveDate)}
              </div>
              {insurance.expirationDate && (
                <div>
                  <span className="font-medium text-foreground">Expires:</span> {formatDate(insurance.expirationDate)}
                </div>
              )}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
