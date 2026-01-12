"use client"

import { useState, useRef, useEffect } from "react"
import { ChevronDown } from "lucide-react"

interface SelectFilterProps {
  value: string
  onChange: (value: string) => void
  options: { label: string; value: string }[]
  placeholder?: string
}

export function SelectFilter({ value, onChange, options, placeholder = "All" }: SelectFilterProps) {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  console.log(
    "[v0] SelectFilter - options:",
    options.map((o) => o.value),
  )

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const selectedOption = options.find((opt) => opt.value === value)
  const displayValue = selectedOption?.label || placeholder

  const handleSelect = (optionValue: string) => {
    console.log("[v0] SelectFilter handleSelect - optionValue:", optionValue)
    onChange(optionValue)
    setIsOpen(false)
  }

  return (
    <div className="relative w-full" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full h-6 px-2 text-xs border border-border rounded bg-background flex items-center justify-between gap-1 hover:border-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
      >
        <span className={`truncate ${!selectedOption ? "text-muted-foreground" : "text-foreground"}`}>
          {displayValue}
        </span>
        <ChevronDown className="h-3 w-3 text-muted-foreground flex-shrink-0" />
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-1 w-full min-w-[120px] bg-popover border border-border rounded shadow-lg max-h-48 overflow-y-auto">
          {/* Clear option */}
          <button
            type="button"
            onClick={() => handleSelect("")}
            className={`w-full px-2 py-1.5 text-xs text-left hover:bg-accent ${
              !value ? "bg-primary/10 text-primary" : "text-muted-foreground"
            }`}
          >
            {placeholder}
          </button>

          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => handleSelect(option.value)}
              className={`w-full px-2 py-1.5 text-xs text-left hover:bg-accent whitespace-nowrap ${
                value === option.value ? "bg-primary/10 text-primary" : "text-foreground"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
