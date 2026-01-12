"use client"

import type React from "react"

import { useState, useRef, useEffect, useMemo, useCallback } from "react"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { ChevronDown } from "lucide-react"

interface MultiSelectFilterProps {
  value: string
  onChange: (value: string) => void
  options: string[]
  placeholder?: string
  onOpen?: () => void
}

export function MultiSelectFilter({
  value,
  onChange,
  options,
  placeholder = "Filter...",
  onOpen,
}: MultiSelectFilterProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const dropdownRef = useRef<HTMLDivElement>(null)

  const selectedValues = useMemo(() => {
    if (value === "__NONE__") return []
    if (!value || value === "__ALL__" || value.trim() === "") {
      return [...options]
    }
    return value
      .split(",")
      .map((v) => v.trim())
      .filter((v) => v.length > 0 && options.includes(v))
  }, [value, options])

  const isSelectAll = options.length > 0 && selectedValues.length === options.length

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

  const handleSelectAll = useCallback(() => {
    if (isSelectAll) {
      onChange("__NONE__")
    } else {
      onChange("__ALL__")
    }
    setSearchTerm("")
  }, [isSelectAll, onChange])

  const handleToggleOption = useCallback(
    (option: string) => {
      const isSelected = selectedValues.includes(option)
      let newSelected: string[]

      if (isSelected) {
        newSelected = selectedValues.filter((v) => v !== option)
      } else {
        newSelected = [...selectedValues, option]
      }

      let finalValue: string
      if (newSelected.length === 0) {
        finalValue = "__NONE__"
      } else if (newSelected.length === options.length) {
        finalValue = "__ALL__"
      } else {
        finalValue = newSelected.join(",")
      }

      onChange(finalValue)
    },
    [selectedValues, options, onChange],
  )

  const getDisplayText = () => {
    if (value === "__NONE__") return "None selected"
    if (!value || value === "__ALL__" || value.trim() === "") return ""
    if (selectedValues.length === options.length) return ""
    if (selectedValues.length === 1) return selectedValues[0]
    if (selectedValues.length > 1) return `${selectedValues.length} selected`
    return ""
  }

  const filteredOptions = useMemo(() => {
    return options.filter((option) => option.toLowerCase().includes(searchTerm.toLowerCase()))
  }, [options, searchTerm])

  const createOptionClickHandler = useCallback(
    (option: string) => {
      return (e: React.MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()
        handleToggleOption(option)
      }
    },
    [handleToggleOption],
  )

  const handleOpen = useCallback(() => {
    const newIsOpen = !isOpen
    setIsOpen(newIsOpen)
    if (newIsOpen && onOpen && options.length === 0) {
      onOpen()
    }
  }, [isOpen, onOpen, options.length])

  return (
    <div className="relative w-full" ref={dropdownRef}>
      <div className="relative">
        <Input
          placeholder={placeholder}
          className="h-6 text-xs px-2 py-1 pr-6 border-border bg-background w-full font-normal cursor-pointer"
          value={getDisplayText()}
          onClick={handleOpen}
          readOnly
        />
        <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground pointer-events-none" />
      </div>

      {isOpen && (
        <div
          className="absolute top-full left-0 mt-1 w-full min-w-[200px] rounded shadow-lg z-50 max-h-[300px] flex flex-col"
          style={{
            backgroundColor: "var(--card)",
            borderColor: "var(--border)",
            borderWidth: "1px",
            borderStyle: "solid",
          }}
        >
          <div className="p-2">
            <Input
              placeholder="Search..."
              className="h-6 text-xs px-2 py-1 w-full"
              style={{
                backgroundColor: "var(--background)",
                borderColor: "var(--border)",
                color: "var(--foreground)",
              }}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onClick={(e) => e.stopPropagation()}
            />
          </div>

          <div className="overflow-y-auto flex-1" style={{ backgroundColor: "var(--card)" }}>
            <div className="p-2 space-y-2">
              <div
                className="flex items-center gap-2 hover:bg-accent p-1 rounded cursor-pointer whitespace-nowrap"
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  handleSelectAll()
                }}
              >
                <Checkbox
                  checked={isSelectAll}
                  onCheckedChange={() => {
                    handleSelectAll()
                  }}
                  className="h-4 w-4 border border-muted-foreground data-[state=checked]:bg-primary data-[state=checked]:border-primary flex-shrink-0"
                />
                <span className="text-xs" style={{ color: "var(--foreground)" }}>
                  (Select All)
                </span>
              </div>

              {filteredOptions.length > 0 ? (
                filteredOptions.map((option) => {
                  const isSelected = selectedValues.includes(option)
                  return (
                    <div
                      key={option}
                      className="flex items-center gap-2 hover:bg-accent p-1 rounded cursor-pointer whitespace-nowrap overflow-x-auto"
                      onClick={createOptionClickHandler(option)}
                    >
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => {
                          handleToggleOption(option)
                        }}
                        className="h-4 w-4 border border-muted-foreground data-[state=checked]:bg-primary data-[state=checked]:border-primary flex-shrink-0"
                      />
                      <span className="text-xs whitespace-nowrap" style={{ color: "var(--foreground)" }}>
                        {option}
                      </span>
                    </div>
                  )
                })
              ) : (
                <div className="text-xs p-1" style={{ color: "var(--muted-foreground)" }}>
                  No options found
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
