"use client"

/**
 * =============================================================================
 * DynamicStepForm — data-driven renderer for a workflow step's custom fields
 * =============================================================================
 *
 * Give it a step's live `StepInfo` (from `fetchStepInfo`) and it renders one
 * input per dynamic field based on `field.type`, tracks values, and submits via
 * the correct recipe (fields-only vs. fields+file). This is the generic building
 * block for step UIs — you do NOT hand-build a form per step.
 *
 * Fields are matched/keyed by their per-environment `fieldIdentifier` GUID,
 * which is read straight off the fetched step (never hardcoded).
 *
 * To support a new field `type`, add a case to `renderField`.
 *
 * See docs/api/DYNAMIC-STEPS.md.
 * =============================================================================
 */

import { useMemo, useState, type FormEvent } from "react"
import {
  getDynamicFields,
  submitStepFields,
  submitStepWithFile,
  type DynamicField,
  type DynamicFieldOption,
  type StepInfo,
} from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

interface DynamicStepFormProps {
  journeyId: number
  stepId: number
  stepInfo: StepInfo
  /** Called after a successful submit (advance the journey / refetch). */
  onSubmitted?: () => void
  submitLabel?: string
  className?: string
}

type FieldValue = string | string[] | undefined

function normalizeOption(option: DynamicFieldOption): { label: string; value: string } {
  if (typeof option === "string") return { label: option, value: option }
  return { label: option.label, value: String(option.value) }
}

const inputClass =
  "flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm outline-none " +
  "transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] " +
  "disabled:cursor-not-allowed disabled:opacity-50"

export function DynamicStepForm({
  journeyId,
  stepId,
  stepInfo,
  onSubmitted,
  submitLabel = "Submit",
  className,
}: DynamicStepFormProps) {
  const fields = useMemo(
    () => getDynamicFields(stepInfo.configuration).slice().sort((a, b) => (a.uiOrder ?? 0) - (b.uiOrder ?? 0)),
    [stepInfo],
  )

  // Initialize values from each field's current value.
  const [values, setValues] = useState<Record<string, FieldValue>>(() => {
    const initial: Record<string, FieldValue> = {}
    for (const field of fields) {
      if (Array.isArray(field.value)) initial[field.fieldIdentifier] = field.value.map(String)
      else if (field.value != null) initial[field.fieldIdentifier] = String(field.value)
    }
    return initial
  })
  const [file, setFile] = useState<{ fieldId: string; file: File } | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const setValue = (fieldId: string, value: FieldValue) =>
    setValues((prev) => ({ ...prev, [fieldId]: value }))

  const missingRequired = fields.some((f) => {
    if (!f.requiredToComplete) return false
    const isFileField = f.type === "fileUpload" || f.type === "customField.fileUpload"
    if (isFileField) return file?.fieldId !== f.fieldIdentifier && !f.value
    const v = values[f.fieldIdentifier]
    return v == null || v === "" || (Array.isArray(v) && v.length === 0)
  })

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)

    // Only non-file fields go in `changes`; the file rides in its own part.
    const changes: Record<string, unknown> = {}
    for (const field of fields) {
      const isFileField = field.type === "fileUpload" || field.type === "customField.fileUpload"
      if (isFileField) continue
      if (field.fieldIdentifier in values) changes[field.fieldIdentifier] = values[field.fieldIdentifier]
    }

    const result = file
      ? await submitStepWithFile(journeyId, stepId, fields, file.fieldId, file.file, changes)
      : await submitStepFields(journeyId, stepId, fields, changes)

    setSubmitting(false)
    if (result.success) {
      onSubmitted?.()
    } else {
      setError(result.error ?? "Submission failed")
    }
  }

  function renderField(field: DynamicField) {
    const id = field.fieldIdentifier
    const value = values[id]

    switch (field.type) {
      case "customText":
        return <p className="text-sm text-muted-foreground">{field.description || field.label}</p>

      case "customField.date":
        return (
          <input
            id={id}
            type="date"
            className={inputClass}
            value={typeof value === "string" ? value : ""}
            onChange={(e) => setValue(id, e.target.value)}
          />
        )

      case "customField.select.dropdown":
        return (
          <select
            id={id}
            className={inputClass}
            value={typeof value === "string" ? value : ""}
            onChange={(e) => setValue(id, e.target.value)}
          >
            <option value="">Select…</option>
            {(field.options ?? []).map((opt) => {
              const o = normalizeOption(opt)
              return (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              )
            })}
          </select>
        )

      case "customField.select.checkboxes": {
        const selected = Array.isArray(value) ? value : []
        return (
          <div className="flex flex-col gap-2">
            {(field.options ?? []).map((opt) => {
              const o = normalizeOption(opt)
              const checked = selected.includes(o.value)
              return (
                <label key={o.value} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="size-4 rounded border-input accent-primary"
                    checked={checked}
                    onChange={(e) =>
                      setValue(
                        id,
                        e.target.checked ? [...selected, o.value] : selected.filter((v) => v !== o.value),
                      )
                    }
                  />
                  {o.label}
                </label>
              )
            })}
          </div>
        )
      }

      case "fileUpload":
      case "customField.fileUpload":
        return (
          <input
            id={id}
            type="file"
            className={cn(inputClass, "file:mr-3 file:border-0 file:bg-transparent file:text-sm file:font-medium")}
            onChange={(e) => {
              const f = e.target.files?.[0]
              setFile(f ? { fieldId: id, file: f } : null)
            }}
          />
        )

      case "customField.textEntry":
      default:
        return (
          <input
            id={id}
            type="text"
            className={inputClass}
            value={typeof value === "string" ? value : ""}
            onChange={(e) => setValue(id, e.target.value)}
          />
        )
    }
  }

  if (fields.length === 0) {
    return <p className="text-sm text-muted-foreground">This step has no custom fields to fill in.</p>
  }

  return (
    <form onSubmit={handleSubmit} className={cn("flex flex-col gap-5", className)}>
      {fields.map((field) => (
        <div key={field.fieldIdentifier} className="flex flex-col gap-2">
          {field.type !== "customText" && (
            <Label htmlFor={field.fieldIdentifier}>
              {field.label}
              {field.requiredToComplete && <span className="text-destructive"> *</span>}
            </Label>
          )}
          {renderField(field)}
          {field.description && field.type !== "customText" && (
            <p className="text-caption text-muted-foreground">{field.description}</p>
          )}
        </div>
      ))}

      {error && (
        <div className="rounded-md border border-destructive/25 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      <Button type="submit" disabled={submitting || missingRequired}>
        {submitting ? "Submitting…" : submitLabel}
      </Button>
    </form>
  )
}
