"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Edit3, Save, X } from "lucide-react"

interface PatientDetailsProps {
  patientData?: {
    phone: string
    email: string
    address: string
  }
}

export function PatientDetailsCard({ patientData }: PatientDetailsProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [formData, setFormData] = useState({
    phone: patientData?.phone || "(212) 456-7890",
    email: patientData?.email || "maria.perez@email.com",
    address: patientData?.address || "1 Presidential Way, San Francisco, CA 94129",
  })
  const [originalData, setOriginalData] = useState(formData)

  const handleEdit = () => {
    setOriginalData(formData)
    setIsEditing(true)
  }

  const handleSave = () => {
    setIsEditing(false)
  }

  const handleDiscard = () => {
    setFormData(originalData)
    setIsEditing(false)
  }

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  return (
    <div className="w-full bg-white rounded-lg shadow-sm border border-[#d9d9d9] p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-[#0026ff]">CONTACT INFO</h2>
        {!isEditing ? (
          <Button
            variant="ghost"
            size="icon"
            onClick={handleEdit}
            className="h-8 w-8 text-[#464b52] hover:text-[#0026ff]"
          >
            <Edit3 className="h-4 w-4" />
          </Button>
        ) : (
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleSave}
              className="h-8 w-8 text-green-600 hover:text-green-700"
            >
              <Save className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleDiscard}
              className="h-8 w-8 text-red-600 hover:text-red-700"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="space-y-3">
        {isEditing ? (
          <>
            <div>
              <Label htmlFor="phone" className="text-sm font-medium text-[#464b52]">
                Phone
              </Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => handleInputChange("phone", e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="email" className="text-sm font-medium text-[#464b52]">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => handleInputChange("email", e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="address" className="text-sm font-medium text-[#464b52]">
                Address
              </Label>
              <Textarea
                id="address"
                value={formData.address}
                onChange={(e) => handleInputChange("address", e.target.value)}
                className="mt-1 min-h-[60px]"
              />
            </div>
          </>
        ) : (
          <>
            <div className="text-[#535357] text-sm">{formData.phone}</div>
            <div className="text-[#535357] text-sm">{formData.email}</div>
            <div className="text-[#535357] text-sm">{formData.address}</div>
          </>
        )}
      </div>
    </div>
  )
}
