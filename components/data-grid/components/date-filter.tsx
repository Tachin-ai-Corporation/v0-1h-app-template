"use client"

import * as React from "react"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { CalendarIcon, ChevronDown, Filter, X } from "lucide-react"

type DateOperator = "equals" | "before" | "after" | "between"

interface DateFilterProps {
  value: string
  onChange: (value: string) => void
}

function formatDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  const year = date.getFullYear()
  return `${month}/${day}/${year}`
}

function formatDateISO(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

export function DateFilter({ value, onChange }: DateFilterProps) {
  const [isOpen, setIsOpen] = React.useState(false)
  const [operator, setOperator] = React.useState<DateOperator>(() => {
    if (!value) return "equals"
    const [op] = value.split(":")
    return (op as DateOperator) || "equals"
  })

  const [startDate, setStartDate] = React.useState<Date | undefined>(() => {
    if (!value) return undefined
    const [, dates] = value.split(":")
    if (!dates) return undefined
    const [dateStr] = dates.split(",")
    return dateStr ? new Date(dateStr) : undefined
  })

  const [endDate, setEndDate] = React.useState<Date | undefined>(() => {
    if (!value) return undefined
    const [, dates] = value.split(":")
    if (!dates) return undefined
    const parts = dates.split(",")
    return parts[1] ? new Date(parts[1]) : undefined
  })

  const dropdownRef = React.useRef<HTMLDivElement>(null)
  const prevValueRef = React.useRef<string>("")

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node

      // Check if click is inside dropdown
      if (dropdownRef.current?.contains(target)) {
        return
      }

      // Check if click is inside a popover content (calendar) - these are portaled to body
      const popoverContent = document.querySelector("[data-radix-popper-content-wrapper]")
      if (popoverContent?.contains(target)) {
        return
      }

      // Check if click is on any calendar element
      const calendarElement = (target as Element).closest?.(
        '[data-radix-popper-content-wrapper], [role="dialog"], .rdp',
      )
      if (calendarElement) {
        return
      }

      setIsOpen(false)
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside)
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [isOpen])

  React.useEffect(() => {
    let newValue = ""

    if (!startDate) {
      newValue = ""
    } else {
      try {
        const startStr = formatDateISO(startDate)

        if (operator === "between" && endDate) {
          const endStr = formatDateISO(endDate)
          newValue = `${operator}:${startStr},${endStr}`
        } else if (operator !== "between") {
          newValue = `${operator}:${startStr}`
        }
      } catch (error) {
        newValue = ""
      }
    }

    if (newValue !== prevValueRef.current) {
      prevValueRef.current = newValue
      onChange(newValue)
    }
  }, [operator, startDate, endDate, onChange])

  const handleClear = () => {
    setStartDate(undefined)
    setEndDate(undefined)
    setOperator("equals")
    prevValueRef.current = ""
    onChange("")
  }

  const getDisplayText = () => {
    if (!startDate) return ""
    const opLabel = operator.charAt(0).toUpperCase() + operator.slice(1)
    if (operator === "between" && endDate) {
      return `${opLabel}: ${formatDate(startDate)} - ${formatDate(endDate)}`
    }
    return `${opLabel}: ${formatDate(startDate)}`
  }

  return (
    <div className="relative w-full" ref={dropdownRef}>
      <div className="relative flex items-center">
        <Input
          placeholder="Filter..."
          className="h-6 text-xs px-2 py-1 pr-10 border-border bg-background text-foreground w-full font-normal cursor-pointer"
          value={getDisplayText()}
          onClick={() => setIsOpen(!isOpen)}
          readOnly
        />
        {startDate && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              handleClear()
            }}
            className="absolute right-6 top-1/2 -translate-y-1/2 h-4 w-4 rounded-full hover:bg-muted flex items-center justify-center"
            title="Clear filter"
          >
            <X className="h-3 w-3 text-muted-foreground" />
          </button>
        )}
        <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground pointer-events-none" />
      </div>

      {isOpen && (
        <div
          className="absolute top-full left-0 mt-1 rounded shadow-lg z-50 p-3 min-w-[280px]"
          style={{
            backgroundColor: "var(--card)",
            borderColor: "var(--border)",
            borderWidth: "1px",
            borderStyle: "solid",
          }}
        >
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs font-medium" style={{ color: "var(--foreground)" }}>
              Date Filter
            </span>
            <Button
              size="sm"
              variant="ghost"
              className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
              onClick={handleClear}
            >
              <X className="h-3 w-3 mr-1" />
              Clear
            </Button>
          </div>

          <div className="flex gap-1 mb-3">
            <Button
              size="sm"
              variant={operator === "equals" ? "default" : "outline"}
              className="flex-1 h-7 text-xs"
              onClick={() => setOperator("equals")}
            >
              <Filter className="h-3 w-3 mr-1" />
              Equals
            </Button>
            <Button
              size="sm"
              variant={operator === "before" ? "default" : "outline"}
              className="flex-1 h-7 text-xs"
              onClick={() => setOperator("before")}
            >
              Before
            </Button>
            <Button
              size="sm"
              variant={operator === "after" ? "default" : "outline"}
              className="flex-1 h-7 text-xs"
              onClick={() => setOperator("after")}
            >
              After
            </Button>
            <Button
              size="sm"
              variant={operator === "between" ? "default" : "outline"}
              className="flex-1 h-7 text-xs"
              onClick={() => setOperator("between")}
            >
              Between
            </Button>
          </div>

          <div className="space-y-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start text-left font-normal h-7 text-xs bg-transparent"
                  style={{
                    backgroundColor: "var(--muted)",
                    borderColor: "var(--border)",
                    color: "var(--foreground)",
                  }}
                >
                  <CalendarIcon className="mr-2 h-3 w-3" />
                  {startDate ? formatDate(startDate) : "Pick a date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={startDate}
                  onSelect={setStartDate}
                  initialFocus
                  captionLayout="dropdown"
                  fromYear={1920}
                  toYear={2030}
                  defaultMonth={startDate}
                />
              </PopoverContent>
            </Popover>

            {operator === "between" && (
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full justify-start text-left font-normal h-7 text-xs bg-transparent"
                    style={{
                      backgroundColor: "var(--muted)",
                      borderColor: "var(--border)",
                      color: "var(--foreground)",
                    }}
                  >
                    <CalendarIcon className="mr-2 h-3 w-3" />
                    {endDate ? formatDate(endDate) : "Pick end date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={endDate}
                    onSelect={setEndDate}
                    initialFocus
                    captionLayout="dropdown"
                    fromYear={1920}
                    toYear={2030}
                    disabled={(date) => (startDate ? date < startDate : false)}
                    defaultMonth={endDate || startDate}
                  />
                </PopoverContent>
              </Popover>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
