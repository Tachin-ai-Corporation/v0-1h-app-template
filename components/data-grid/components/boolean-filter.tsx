"use client"

import { useState, useRef, useEffect } from "react"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { ChevronDown } from "lucide-react"

interface BooleanFilterProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
}

export function BooleanFilter({ value, onChange, placeholder = "Filter..." }: BooleanFilterProps) {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Parse current value
  const selectedValues = value ? value.split(",") : []
  const isSelectAll = selectedValues.length === 0 || selectedValues.length === 2
  const isYesSelected = isSelectAll || selectedValues.includes("true")
  const isNoSelected = isSelectAll || selectedValues.includes("false")

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside)
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [isOpen])

  const handleSelectAll = () => {
    onChange("")
  }

  const handleToggleYes = () => {
    if (isSelectAll) {
      onChange("false")
    } else if (isYesSelected && !isNoSelected) {
      onChange("")
    } else if (isYesSelected && isNoSelected) {
      onChange("false")
    } else {
      onChange("true,false")
    }
  }

  const handleToggleNo = () => {
    if (isSelectAll) {
      onChange("true")
    } else if (isNoSelected && !isYesSelected) {
      onChange("")
    } else if (isNoSelected && isYesSelected) {
      onChange("true")
    } else {
      onChange("true,false")
    }
  }

  const getDisplayText = () => {
    if (isSelectAll) return ""
    if (isYesSelected && !isNoSelected) return "Yes"
    if (isNoSelected && !isYesSelected) return "No"
    return ""
  }

  return (
    <div className="relative w-full" ref={dropdownRef}>
      <div className="relative">
        <Input
          placeholder={placeholder}
          className="h-6 text-xs px-2 py-1 pr-6 border-border bg-background w-full font-normal cursor-pointer"
          value={getDisplayText()}
          onClick={() => setIsOpen(!isOpen)}
          readOnly
        />
        <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground pointer-events-none" />
      </div>

      {isOpen && (
        <div
          className="absolute top-full left-0 mt-1 w-full rounded shadow-lg z-50"
          style={{
            backgroundColor: "var(--card)",
            borderColor: "var(--border)",
            borderWidth: "1px",
            borderStyle: "solid",
          }}
        >
          <div className="p-2 space-y-2">
            <Input
              placeholder="Search..."
              className="h-6 text-xs px-2 py-1 w-full"
              style={{
                backgroundColor: "var(--background)",
                borderColor: "var(--border)",
                color: "var(--foreground)",
              }}
            />

            <div
              className="flex items-center gap-2 hover:bg-accent p-1 rounded cursor-pointer"
              onClick={handleSelectAll}
            >
              <Checkbox
                checked={isSelectAll}
                className="h-4 w-4 border border-muted-foreground data-[state=checked]:bg-primary data-[state=checked]:border-primary"
              />
              <span className="text-xs" style={{ color: "var(--foreground)" }}>
                (Select All)
              </span>
            </div>

            <div
              className="flex items-center gap-2 hover:bg-accent p-1 rounded cursor-pointer"
              onClick={handleToggleNo}
            >
              <Checkbox
                checked={isNoSelected}
                className="h-4 w-4 border border-muted-foreground data-[state=checked]:bg-primary data-[state=checked]:border-primary"
              />
              <span className="text-xs" style={{ color: "var(--foreground)" }}>
                No
              </span>
            </div>

            <div
              className="flex items-center gap-2 hover:bg-accent p-1 rounded cursor-pointer"
              onClick={handleToggleYes}
            >
              <Checkbox
                checked={isYesSelected}
                className="h-4 w-4 border border-muted-foreground data-[state=checked]:bg-primary data-[state=checked]:border-primary"
              />
              <span className="text-xs" style={{ color: "var(--foreground)" }}>
                Yes
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
