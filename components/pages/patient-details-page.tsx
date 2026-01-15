"use client"

import type React from "react"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ArrowLeft, Search, Loader2 } from "lucide-react"
import { PatientDemographicsCard } from "@/components/patient/patient-demographics-card"
import { PatientInsuranceCard } from "@/components/patient/patient-insurance-card"
import { PatientExternalIdsCard } from "@/components/patient/patient-external-ids-card"
import { EditPersonDialog } from "@/components/edit-person-dialog"
import { getPatientInfo, type PatientInfo } from "@/lib/api/person"
import { getPatientInsurances, type Insurance } from "@/lib/api/insurance"
import { getExternalSystemIds, type ExternalSystemId } from "@/lib/api/query-person"

interface PatientDetailsPageProps {
  personId?: string
  onBack?: () => void
}

export function PatientDetailsPage({ personId: initialPersonId, onBack }: PatientDetailsPageProps) {
  const [personIdInput, setPersonIdInput] = useState(initialPersonId || "")
  const [activePersonId, setActivePersonId] = useState<string | null>(initialPersonId || null)

  const [patient, setPatient] = useState<PatientInfo | null>(null)
  const [insurances, setInsurances] = useState<Insurance[]>([])
  const [externalIds, setExternalIds] = useState<ExternalSystemId[]>([])

  const [isLoadingPatient, setIsLoadingPatient] = useState(false)
  const [isLoadingInsurance, setIsLoadingInsurance] = useState(false)
  const [isLoadingExternalIds, setIsLoadingExternalIds] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)

  const loadPatientData = useCallback(async (personId: string) => {
    setError(null)
    setIsLoadingPatient(true)
    setIsLoadingInsurance(true)
    setIsLoadingExternalIds(true)

    const patientResult = await getPatientInfo(personId)
    setPatient(patientResult)
    setIsLoadingPatient(false)

    if (!patientResult) {
      setError("Patient not found")
      setIsLoadingInsurance(false)
      setIsLoadingExternalIds(false)
      return
    }

    const [insuranceResult, externalIdsResult] = await Promise.all([
      getPatientInsurances(personId),
      getExternalSystemIds(patientResult.id),
    ])

    setInsurances(insuranceResult)
    setIsLoadingInsurance(false)

    if (externalIdsResult.success && externalIdsResult.data) {
      setExternalIds(externalIdsResult.data)
    }
    setIsLoadingExternalIds(false)
  }, [])

  useEffect(() => {
    if (activePersonId) {
      loadPatientData(activePersonId)
    }
  }, [activePersonId, loadPatientData])

  const handleSearch = () => {
    if (personIdInput.trim()) {
      setActivePersonId(personIdInput.trim())
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch()
    }
  }

  const handleEditSuccess = (updatedInfo: PatientInfo) => {
    setPatient(updatedInfo)
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-4 p-4 border-b bg-background">
        {onBack && (
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
        )}
        <h1 className="text-xl font-semibold">Patient Details</h1>
      </div>

      {!initialPersonId && (
        <div className="p-4 border-b bg-muted/30">
          <div className="flex gap-2 max-w-md">
            <Input
              placeholder="Enter Person ID..."
              value={personIdInput}
              onChange={(e) => setPersonIdInput(e.target.value)}
              onKeyDown={handleKeyDown}
            />
            <Button onClick={handleSearch} disabled={!personIdInput.trim() || isLoadingPatient}>
              {isLoadingPatient ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-auto p-4">
        {error && (
          <div className="bg-destructive/10 text-destructive border border-destructive/20 rounded-lg p-4 mb-4">
            {error}
          </div>
        )}

        {!activePersonId && !error && (
          <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
            <Search className="h-12 w-12 mb-4 opacity-50" />
            <p>Enter a Person ID to view patient details</p>
          </div>
        )}

        {activePersonId && (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <PatientDemographicsCard
              patient={patient}
              isLoading={isLoadingPatient}
              onEdit={() => setIsEditDialogOpen(true)}
            />
            <PatientInsuranceCard insurances={insurances} isLoading={isLoadingInsurance} />
            <PatientExternalIdsCard externalIds={externalIds} isLoading={isLoadingExternalIds} />
          </div>
        )}
      </div>

      {patient && (
        <EditPersonDialog
          open={isEditDialogOpen}
          onOpenChange={setIsEditDialogOpen}
          patientInfo={patient}
          externalSystemIds={externalIds}
          onSuccess={handleEditSuccess}
        />
      )}
    </div>
  )
}
