"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { PatientInfo } from "@/app/actions/person-actions"
import { upsertPerson, type UpsertPersonPayload } from "@/app/actions/person-actions"
import type { ExternalSystemId } from "@/app/actions/query"
import { useToast } from "@/hooks/use-toast"
import { Loader2, Plus, Trash2 } from "lucide-react"

interface EditPersonDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  patientInfo: PatientInfo
  externalSystemIds?: ExternalSystemId[]
  onSuccess: (updatedInfo: PatientInfo) => void
}

// Format phone number as user types: (XXX) XXX-XXXX
function formatPhoneNumber(value: string): string {
  // Remove all non-digit characters
  let digits = value.replace(/\D/g, "")

  // If it starts with country code "1" and has 11 digits, strip the leading "1"
  if (digits.length === 11 && digits.startsWith("1")) {
    digits = digits.slice(1)
  }

  // Take only the first 10 digits
  digits = digits.slice(0, 10)

  if (digits.length === 0) return ""
  if (digits.length <= 3) return `(${digits}`
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
}

// Parse phone to digits only
function parsePhoneDigits(phone: string): string {
  return phone.replace(/\D/g, "")
}

// Format date for display in input: YYYY-MM-DD
function formatDateForInput(dateStr: string | undefined): string {
  if (!dateStr) return ""
  try {
    const date = new Date(dateStr)
    if (isNaN(date.getTime())) return ""
    return date.toISOString().split("T")[0]
  } catch {
    return ""
  }
}

// Validate date is not in future and is reasonable
function isValidDate(dateStr: string): boolean {
  if (!dateStr) return true // Optional field
  const date = new Date(dateStr)
  if (isNaN(date.getTime())) return false
  const now = new Date()
  if (date > now) return false
  // Check if date is not more than 150 years ago
  const minDate = new Date()
  minDate.setFullYear(minDate.getFullYear() - 150)
  if (date < minDate) return false
  return true
}

// Validate email format
function isValidEmail(email: string): boolean {
  if (!email) return true // Optional field
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

// Validate phone has 10 digits
function isValidPhone(phone: string): boolean {
  if (!phone) return true // Optional field
  const digits = parsePhoneDigits(phone)
  return digits.length === 10
}

// US States for dropdown
const US_STATES = [
  { value: "AL", label: "Alabama" },
  { value: "AK", label: "Alaska" },
  { value: "AZ", label: "Arizona" },
  { value: "AR", label: "Arkansas" },
  { value: "CA", label: "California" },
  { value: "CO", label: "Colorado" },
  { value: "CT", label: "Connecticut" },
  { value: "DE", label: "Delaware" },
  { value: "FL", label: "Florida" },
  { value: "GA", label: "Georgia" },
  { value: "HI", label: "Hawaii" },
  { value: "ID", label: "Idaho" },
  { value: "IL", label: "Illinois" },
  { value: "IN", label: "Indiana" },
  { value: "IA", label: "Iowa" },
  { value: "KS", label: "Kansas" },
  { value: "KY", label: "Kentucky" },
  { value: "LA", label: "Louisiana" },
  { value: "ME", label: "Maine" },
  { value: "MD", label: "Maryland" },
  { value: "MA", label: "Massachusetts" },
  { value: "MI", label: "Michigan" },
  { value: "MN", label: "Minnesota" },
  { value: "MS", label: "Mississippi" },
  { value: "MO", label: "Missouri" },
  { value: "MT", label: "Montana" },
  { value: "NE", label: "Nebraska" },
  { value: "NV", label: "Nevada" },
  { value: "NH", label: "New Hampshire" },
  { value: "NJ", label: "New Jersey" },
  { value: "NM", label: "New Mexico" },
  { value: "NY", label: "New York" },
  { value: "NC", label: "North Carolina" },
  { value: "ND", label: "North Dakota" },
  { value: "OH", label: "Ohio" },
  { value: "OK", label: "Oklahoma" },
  { value: "OR", label: "Oregon" },
  { value: "PA", label: "Pennsylvania" },
  { value: "RI", label: "Rhode Island" },
  { value: "SC", label: "South Carolina" },
  { value: "SD", label: "South Dakota" },
  { value: "TN", label: "Tennessee" },
  { value: "TX", label: "Texas" },
  { value: "UT", label: "Utah" },
  { value: "VT", label: "Vermont" },
  { value: "VA", label: "Virginia" },
  { value: "WA", label: "Washington" },
  { value: "WV", label: "West Virginia" },
  { value: "WI", label: "Wisconsin" },
  { value: "WY", label: "Wyoming" },
]

const GENDER_OPTIONS = [
  { value: "Male", label: "Male" },
  { value: "Female", label: "Female" },
  { value: "Asked but not answered", label: "Asked but not answered" },
]

export function EditPersonDialog({
  open,
  onOpenChange,
  patientInfo,
  externalSystemIds = [],
  onSuccess,
}: EditPersonDialogProps) {
  const { toast } = useToast()
  const [saving, setSaving] = useState(false)

  // Form state
  const [firstName, setFirstName] = useState(patientInfo.firstName || "")
  const [lastName, setLastName] = useState(patientInfo.lastName || "")
  const [middleName, setMiddleName] = useState(patientInfo.middleName || "")
  const [dateOfBirth, setDateOfBirth] = useState(formatDateForInput(patientInfo.dateOfBirth))
  const [gender, setGender] = useState(patientInfo.gender || "")
  const [phone, setPhone] = useState(formatPhoneNumber(patientInfo.phone || ""))
  const [email, setEmail] = useState(patientInfo.email || "")
  const [street, setStreet] = useState(patientInfo.address?.street || "")
  const [city, setCity] = useState(patientInfo.address?.city || "")
  const [state, setState] = useState(patientInfo.address?.state || "")
  const [zipCode, setZipCode] = useState(patientInfo.address?.zipCode || "")

  const [editableExternalIds, setEditableExternalIds] = useState<ExternalSystemId[]>(externalSystemIds)
  const [newSystemName, setNewSystemName] = useState("")
  const [newSystemId, setNewSystemId] = useState("")

  // Validation errors
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    setEditableExternalIds(externalSystemIds)
  }, [externalSystemIds])

  useEffect(() => {
    if (open) {
      setFirstName(patientInfo.firstName || "")
      setLastName(patientInfo.lastName || "")
      setMiddleName(patientInfo.middleName || "")
      setDateOfBirth(formatDateForInput(patientInfo.dateOfBirth))
      setGender(patientInfo.gender || "")
      setPhone(formatPhoneNumber(patientInfo.phone || ""))
      setEmail(patientInfo.email || "")
      setStreet(patientInfo.address?.street || "")
      setCity(patientInfo.address?.city || "")
      setState(patientInfo.address?.state || "")
      setZipCode(patientInfo.address?.zipCode || "")
      setEditableExternalIds(externalSystemIds)
      setErrors({})
    }
  }, [open, patientInfo, externalSystemIds])

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (!firstName.trim()) newErrors.firstName = "First name is required"
    if (!lastName.trim()) newErrors.lastName = "Last name is required"
    if (!isValidDate(dateOfBirth)) newErrors.dateOfBirth = "Invalid date of birth"
    if (!isValidEmail(email)) newErrors.email = "Invalid email format"
    if (!isValidPhone(phone)) newErrors.phone = "Phone must be 10 digits"

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleAddExternalId = () => {
    if (!newSystemName.trim() || !newSystemId.trim()) return

    // Check for duplicate system name
    if (editableExternalIds.some((id) => id.systemName === newSystemName.trim())) {
      toast({
        title: "Duplicate System",
        description: "An external ID for this system already exists",
        variant: "destructive",
      })
      return
    }

    setEditableExternalIds([
      ...editableExternalIds,
      { systemName: newSystemName.trim(), externalId: newSystemId.trim() },
    ])
    setNewSystemName("")
    setNewSystemId("")
  }

  const handleRemoveExternalId = (index: number) => {
    setEditableExternalIds(editableExternalIds.filter((_, i) => i !== index))
  }

  const handleUpdateExternalId = (index: number, newValue: string) => {
    const updated = [...editableExternalIds]
    updated[index] = { ...updated[index], externalId: newValue }
    setEditableExternalIds(updated)
  }

  const handleSave = async () => {
    if (!validateForm()) return

    setSaving(true)

    const phoneDigits = parsePhoneDigits(phone)

    let addLocation: UpsertPersonPayload["addLocation"] = undefined
    if (street || city || state || zipCode) {
      addLocation = {
        primary: true,
      }
      if (street.trim()) addLocation.addressLine1 = street.trim()
      if (city.trim()) addLocation.cityName = city.trim()
      if (state) addLocation.stateName = state
      if (zipCode.trim()) addLocation.postalCode = zipCode.trim()
    }

    const payload: UpsertPersonPayload = {
      id: patientInfo.id,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      middleName: middleName.trim() || undefined,
      birthDate: dateOfBirth,
      biologicalGender: gender,
      email: email.trim() || undefined,
      phoneNumber: phoneDigits
        ? {
            region: "us",
            value: `+1${phoneDigits}`,
          }
        : undefined,
      addLocation,
    }

    const result = await upsertPerson(payload, patientInfo)

    // For each new or modified external ID, make a separate upsert call
    for (const extId of editableExternalIds) {
      const originalExtId = externalSystemIds.find((e) => e.systemName === extId.systemName)

      // Only update if new or changed
      if (!originalExtId || originalExtId.externalId !== extId.externalId) {
        const extPayload: UpsertPersonPayload = {
          id: patientInfo.id,
          markWithExternalSystemRecord: {
            name: extId.systemName,
            recordId: extId.externalId,
          },
        }
        await upsertPerson(extPayload)
      }
    }

    setSaving(false)

    if (result.success) {
      toast({
        title: "Success",
        description: "Patient information updated successfully",
        duration: 3000,
      })

      // Build updated patient info
      const updatedInfo: PatientInfo = {
        ...patientInfo,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        middleName: middleName.trim() || undefined,
        dateOfBirth,
        gender,
        phone: phoneDigits ? formatPhoneNumber(phoneDigits) : undefined,
        email: email.trim() || undefined,
        address:
          street || city || state || zipCode
            ? {
                street: street.trim(),
                city: city.trim(),
                state,
                zipCode: zipCode.trim(),
                fullAddress: [street.trim(), city.trim(), state, zipCode.trim()].filter(Boolean).join(", "),
              }
            : undefined,
      }

      onSuccess(updatedInfo)
      onOpenChange(false)
    } else {
      toast({
        title: "Error",
        description: result.error || "Failed to update patient information",
        variant: "destructive",
        duration: 5000,
      })
    }
  }

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhoneNumber(e.target.value)
    setPhone(formatted)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[500px] max-w-[95vw] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Patient Information</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Name Fields */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label htmlFor="firstName">
                First Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="firstName"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className={`w-full ${errors.firstName ? "border-destructive" : ""}`}
              />
              {errors.firstName && <p className="text-xs text-destructive">{errors.firstName}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="middleName">Middle Name</Label>
              <Input
                id="middleName"
                value={middleName}
                onChange={(e) => setMiddleName(e.target.value)}
                className="w-full"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName">
                Last Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="lastName"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className={`w-full ${errors.lastName ? "border-destructive" : ""}`}
              />
              {errors.lastName && <p className="text-xs text-destructive">{errors.lastName}</p>}
            </div>
          </div>

          {/* DOB and Gender */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="dateOfBirth">Date of Birth</Label>
              <Input
                id="dateOfBirth"
                type="date"
                value={dateOfBirth}
                onChange={(e) => setDateOfBirth(e.target.value)}
                className={`w-full ${errors.dateOfBirth ? "border-destructive" : ""}`}
              />
              {errors.dateOfBirth && <p className="text-xs text-destructive">{errors.dateOfBirth}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="gender">Gender</Label>
              <Select value={gender} onValueChange={setGender}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select gender" />
                </SelectTrigger>
                <SelectContent>
                  {GENDER_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Contact Info */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="(555) 555-5555"
                value={phone}
                onChange={handlePhoneChange}
                className={`w-full ${errors.phone ? "border-destructive" : ""}`}
              />
              {errors.phone && <p className="text-xs text-destructive">{errors.phone}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="email@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={`w-full ${errors.email ? "border-destructive" : ""}`}
              />
              {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
            </div>
          </div>

          {/* Address */}
          <div className="space-y-3">
            <Label>Address</Label>
            <Input
              placeholder="Street address"
              value={street}
              onChange={(e) => setStreet(e.target.value)}
              className="w-full"
            />
            <div className="grid grid-cols-3 gap-3">
              <Input placeholder="City" value={city} onChange={(e) => setCity(e.target.value)} className="w-full" />
              <Select value={state} onValueChange={setState}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="State" />
                </SelectTrigger>
                <SelectContent>
                  {US_STATES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                placeholder="ZIP Code"
                value={zipCode}
                onChange={(e) => setZipCode(e.target.value.replace(/\D/g, "").slice(0, 5))}
                className="w-full"
              />
            </div>
          </div>

          <div className="space-y-3">
            <Label>External System IDs</Label>

            {/* Existing external IDs */}
            {editableExternalIds.map((extId, index) => (
              <div key={extId.systemName} className="flex items-center gap-2">
                <div className="flex-1 grid grid-cols-2 gap-2">
                  <Input value={extId.systemName} disabled className="w-full bg-muted" />
                  <Input
                    value={extId.externalId}
                    onChange={(e) => handleUpdateExternalId(index, e.target.value)}
                    placeholder="External ID"
                    className="w-full"
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => handleRemoveExternalId(index)}
                  className="text-destructive hover:text-destructive flex-shrink-0"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}

            {/* Add new external ID */}
            <div className="flex items-center gap-2">
              <div className="flex-1 grid grid-cols-2 gap-2">
                <Input
                  value={newSystemName}
                  onChange={(e) => setNewSystemName(e.target.value)}
                  placeholder="System name"
                  className="w-full"
                />
                <Input
                  value={newSystemId}
                  onChange={(e) => setNewSystemId(e.target.value)}
                  placeholder="External ID"
                  className="w-full"
                />
              </div>
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={handleAddExternalId}
                disabled={!newSystemName.trim() || !newSystemId.trim()}
                className="flex-shrink-0 bg-transparent"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
