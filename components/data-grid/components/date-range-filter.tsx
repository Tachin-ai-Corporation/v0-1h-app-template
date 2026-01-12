"use client"

import { useState, useRef, useEffect } from "react"
import { Input } from "@/components/ui/input"
import { Calendar } from "lucide-react"

interface DateRangeFilterProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
}

export function DateRangeFilter({ value, onChange, placeholder = "Filter..." }: DateRangeFilterProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Parse current value
  useEffect(() => {
    if (value) {
      const [start, end] = value.split(",")
      setStartDate(start || "")
      setEndDate(end || "")
    } else {
      setStartDate("")
      setEndDate("")
    }
  }, [value])

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

  const handleApply = () => {
    if (startDate || endDate) {
      onChange(`${startDate},${endDate}`)
    } else {
      onChange("")
    }
    setIsOpen(false)
  }

  const handleClear = () => {
    setStartDate("")
    setEndDate("")
    onChange("")
    setIsOpen(false)
  }

  const getDisplayText = () => {
    if (!value) return ""
    const [start, end] = value.split(",")
    if (start && end) return `${start} - ${end}`
    if (start) return `From ${start}`
    if (end) return `To ${end}`
    return ""
  }

  return (
    <div className="relative w-full" ref={dropdownRef}>
      <div className="relative">
        <Input
          placeholder={placeholder}
          className="h-6 text-xs px-2 py-1 pr-6 border-border bg-background text-foreground w-full font-normal cursor-pointer"
          value={getDisplayText()}
          onClick={() => setIsOpen(!isOpen)}
          readOnly
        />
        <Calendar className="absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground pointer-events-none" />
      </div>

      {isOpen && (
        <div
          className="absolute top-full left-0 mt-1 w-64 rounded shadow-lg z-50 p-3"
          style={{
            backgroundColor: "var(--card)",
            borderColor: "var(--border)",
            borderWidth: "1px",
            borderStyle: "solid",
          }}
        >
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium block mb-1" style={{ color: "var(--foreground)" }}>
                Start Date
              </label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="h-7 text-xs w-full"
                style={{
                  backgroundColor: "var(--background)",
                  borderColor: "var(--border)",
                  color: "var(--foreground)",
                }}
              />
            </div>

            <div>
              <label className="text-xs font-medium block mb-1" style={{ color: "var(--foreground)" }}>
                End Date
              </label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="h-7 text-xs w-full"
                style={{
                  backgroundColor: "var(--background)",
                  borderColor: "var(--border)",
                  color: "var(--foreground)",
                }}
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleClear}
                className="flex-1 px-3 py-1 text-xs rounded transition-colors hover:opacity-80"
                style={{
                  backgroundColor: "var(--muted)",
                  borderColor: "var(--border)",
                  borderWidth: "1px",
                  borderStyle: "solid",
                  color: "var(--foreground)",
                }}
              >
                Clear
              </button>
              <button
                onClick={handleApply}
                className="flex-1 px-3 py-1 text-xs rounded transition-colors hover:opacity-90"
                style={{
                  backgroundColor: "var(--primary)",
                  color: "var(--primary-foreground)",
                }}
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
