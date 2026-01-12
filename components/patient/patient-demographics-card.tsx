"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { User, Calendar, Phone, Mail, MapPin, Edit } from "lucide-react"
import type { PatientInfo } from "@/app/actions/person-actions"

interface PatientDemographicsCardProps {
  patient: PatientInfo | null
  isLoading?: boolean
  onEdit?: () => void
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

function formatPhone(phone: string | undefined): string {
  if (!phone) return "N/A"
  const digits = phone.replace(/\D/g, "")
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
  }
  return phone
}

export function PatientDemographicsCard({ patient, isLoading, onEdit }: PatientDemographicsCardProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-lg font-semibold">Demographics</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-4 w-56" />
        </CardContent>
      </Card>
    )
  }

  if (!patient) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Demographics</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">No patient data available</p>
        </CardContent>
      </Card>
    )
  }

  const fullName = [patient.firstName, patient.middleName, patient.lastName].filter(Boolean).join(" ")

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-lg font-semibold">Demographics</CardTitle>
        {onEdit && (
          <Button variant="ghost" size="icon" onClick={onEdit} className="h-8 w-8">
            <Edit className="h-4 w-4" />
            <span className="sr-only">Edit patient</span>
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2">
          <User className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          <span className="font-medium">{fullName}</span>
        </div>

        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          <span className="text-sm">
            DOB: {formatDate(patient.dateOfBirth)}
            {patient.gender && <span className="text-muted-foreground"> | {patient.gender}</span>}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Phone className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          <span className="text-sm">{formatPhone(patient.phone)}</span>
        </div>

        <div className="flex items-center gap-2">
          <Mail className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          <span className="text-sm">{patient.email || "N/A"}</span>
        </div>

        <div className="flex items-start gap-2">
          <MapPin className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
          <span className="text-sm">{patient.address?.fullAddress || "N/A"}</span>
        </div>
      </CardContent>
    </Card>
  )
}
