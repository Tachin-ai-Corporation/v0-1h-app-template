"use client"

import type React from "react"

import { useState, useMemo, useRef, useEffect } from "react"
import { Search, ChevronDown, ChevronRight } from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { type AttributeSelection, type FilterOperator, getOperatorsForType } from "@/lib/types/query-builder"

interface AttributeListProps {
  attributes: AttributeSelection[]
  onAttributeChange: (key: string, changes: Partial<AttributeSelection>) => void
  title?: string
  idPrefix?: string
  collapsible?: boolean
  defaultExpanded?: boolean
}

export function AttributeList({
  attributes,
  onAttributeChange,
  title,
  idPrefix = "",
  collapsible = false,
  defaultExpanded = true,
}: AttributeListProps) {
  const [searchTerm, setSearchTerm] = useState("")
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)

  const onAttributeChangeRef = useRef(onAttributeChange)
  useEffect(() => {
    onAttributeChangeRef.current = onAttributeChange
  }, [onAttributeChange])

  const filteredAttributes = useMemo(() => {
    if (!searchTerm.trim()) return attributes
    const lower = searchTerm.toLowerCase()
    return attributes.filter(
      (attr) => attr.key.toLowerCase().includes(lower) || attr.label.toLowerCase().includes(lower),
    )
  }, [attributes, searchTerm])

  const selectedCount = useMemo(() => attributes.filter((a) => a.selected).length, [attributes])
  const filterCount = useMemo(() => attributes.filter((a) => a.filterEnabled).length, [attributes])
  const selectedAttributes = useMemo(() => attributes.filter((a) => a.selected || a.filterEnabled), [attributes])

  if (attributes.length === 0) {
    return <div className="text-sm text-muted-foreground py-4 text-center">No attributes available</div>
  }

  const content = (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search attributes..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-9 h-9"
        />
      </div>

      <div className="border rounded-lg overflow-hidden">
        <div className="max-h-[400px] overflow-y-auto">
          <Table>
            <TableHeader className="sticky top-0 bg-muted/90 backdrop-blur-sm z-10">
              <TableRow>
                <TableHead className="w-[400px]">Attribute</TableHead>
                <TableHead className="w-[80px] text-center">Return</TableHead>
                <TableHead className="w-[80px] text-center">Filter</TableHead>
                <TableHead className="w-[120px]">Operator</TableHead>
                <TableHead>Value</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAttributes.map((attr) => (
                <AttributeRow key={attr.key} attr={attr} idPrefix={idPrefix} onChangeRef={onAttributeChangeRef} />
              ))}
              {filteredAttributes.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    No attributes match "{searchTerm}"
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <div className="text-xs text-muted-foreground">
        Showing {filteredAttributes.length} of {attributes.length} attributes
      </div>
    </div>
  )

  if (collapsible) {
    return (
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" className="w-full justify-between px-3 py-2 h-auto">
            <div className="flex items-center gap-2">
              {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              <span className="font-medium text-sm">{title || "Attributes"}</span>
              <Badge variant="secondary" className="text-xs">
                {selectedCount} selected, {filterCount} filtered
              </Badge>
            </div>
          </Button>
        </CollapsibleTrigger>

        {!isExpanded && selectedAttributes.length > 0 && (
          <div className="px-3 py-2 text-xs text-muted-foreground flex flex-wrap gap-1">
            {selectedAttributes.slice(0, 10).map((attr) => (
              <Badge key={attr.key} variant="outline" className="text-xs">
                {attr.label}
                {attr.filterEnabled && ` (${attr.filterOperator} ${attr.filterValue || "?"})`}
              </Badge>
            ))}
            {selectedAttributes.length > 10 && (
              <Badge variant="outline" className="text-xs">
                +{selectedAttributes.length - 10} more
              </Badge>
            )}
          </div>
        )}

        <CollapsibleContent>{content}</CollapsibleContent>
      </Collapsible>
    )
  }

  return (
    <div className="space-y-3">
      {title && <h4 className="text-sm font-medium text-muted-foreground">{title}</h4>}
      {content}
    </div>
  )
}

interface AttributeRowProps {
  attr: AttributeSelection
  idPrefix: string
  onChangeRef: React.RefObject<(key: string, changes: Partial<AttributeSelection>) => void>
}

function getDefaultTimeForOperator(operator: FilterOperator, isEndDate = false): string {
  // For range operator
  if (operator === "range") {
    // Start date: beginning of day (00:00)
    // End date: end of day (23:59)
    return isEndDate ? "T23:59" : "T00:00"
  }

  // =ge= (on or after): start of day to be inclusive
  if (operator === "=ge=") return "T00:00"

  // =gt= (after): end of day so "after Jan 1" means Jan 2 onwards
  if (operator === "=gt=") return "T23:59"

  // =le= (on or before): end of day to be inclusive
  if (operator === "=le=") return "T23:59"

  // =lt= (before): start of day so "before Jan 2" means up to Jan 1 23:59
  if (operator === "=lt=") return "T00:00"

  // Default
  return "T00:00"
}

function applyDefaultTimeToDate(dateValue: string, operator: FilterOperator, isEndDate = false): string {
  // If already has time component, return as-is
  if (dateValue.includes("T") && dateValue.length > 11) {
    return dateValue
  }

  // If it's just a date (YYYY-MM-DD), append default time
  if (dateValue.match(/^\d{4}-\d{2}-\d{2}$/)) {
    return dateValue + getDefaultTimeForOperator(operator, isEndDate)
  }

  return dateValue
}

function AttributeRow({ attr, idPrefix, onChangeRef }: AttributeRowProps) {
  const returnId = `${idPrefix}${attr.key}-return`
  const filterId = `${idPrefix}${attr.key}-filter`
  const operatorId = `${idPrefix}${attr.key}-operator`
  const valueId = `${idPrefix}${attr.key}-value`
  const valueEndId = `${idPrefix}${attr.key}-value-end`

  console.log(`[v0] AttributeRow render: ${attr.key}, selected=${attr.selected}, filterEnabled=${attr.filterEnabled}`)

  const operators = useMemo(() => getOperatorsForType(attr.type), [attr.type])

  const isTimestamp = attr.type === "TIMESTAMP" || attr.type === "DATE" || attr.type === "DATETIME"
  const isRangeOperator = attr.filterOperator === "range"

  const handleSelectedChange = (checked: boolean | "indeterminate") => {
    console.log(`[v0] handleSelectedChange: ${attr.key} -> ${checked}`)
    onChangeRef.current?.(attr.key, { selected: checked === true })
  }

  const handleFilterEnabledChange = (checked: boolean | "indeterminate") => {
    console.log(`[v0] handleFilterEnabledChange: ${attr.key} -> ${checked}`)
    onChangeRef.current?.(attr.key, { filterEnabled: checked === true })
  }

  const handleOperatorChange = (value: string) => {
    console.log(`[v0] handleOperatorChange: ${attr.key} -> ${value}`)
    onChangeRef.current?.(attr.key, { filterOperator: value as FilterOperator })
  }

  const handleValueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let newValue = e.target.value

    // For timestamp fields, apply default time if user just picked a date
    if (isTimestamp && newValue) {
      newValue = applyDefaultTimeToDate(newValue, attr.filterOperator, false)
    }

    console.log(`[v0] handleValueChange: ${attr.key} -> ${newValue}`)
    onChangeRef.current?.(attr.key, { filterValue: newValue })
  }

  const handleValueEndChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let newValue = e.target.value

    // For timestamp fields, apply default time if user just picked a date
    if (isTimestamp && newValue) {
      newValue = applyDefaultTimeToDate(newValue, attr.filterOperator, true)
    }

    console.log(`[v0] handleValueEndChange: ${attr.key} -> ${newValue}`)
    onChangeRef.current?.(attr.key, { filterValueEnd: newValue })
  }

  const handleSelectValueChange = (value: string) => {
    console.log(`[v0] handleSelectValueChange: ${attr.key} -> ${value}`)
    onChangeRef.current?.(attr.key, { filterValue: value })
  }

  const getPlaceholder = () => {
    if (isTimestamp) {
      return "YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss"
    }
    if (attr.filterOperator === "=in=") {
      return "value1, value2, ..."
    }
    return "Enter value..."
  }

  return (
    <TableRow>
      <TableCell className="font-mono text-sm">
        <div className="flex items-center gap-2">
          <span className="truncate max-w-[300px]" title={attr.label}>
            {attr.label}
          </span>
          <Badge variant="outline" className="text-xs shrink-0">
            {attr.type}
          </Badge>
        </div>
      </TableCell>
      <TableCell className="text-center">
        <Checkbox id={returnId} name={returnId} checked={attr.selected} onCheckedChange={handleSelectedChange} />
      </TableCell>
      <TableCell className="text-center">
        <Checkbox
          id={filterId}
          name={filterId}
          checked={attr.filterEnabled}
          onCheckedChange={handleFilterEnabledChange}
        />
      </TableCell>
      <TableCell>
        <Select value={attr.filterOperator} onValueChange={handleOperatorChange} disabled={!attr.filterEnabled}>
          <SelectTrigger id={operatorId} className="h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {operators.map((op) => (
              <SelectItem key={op.value} value={op.value}>
                {op.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell>
        {isRangeOperator && isTimestamp ? (
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <label className="text-xs text-muted-foreground mb-1 block">Start (incl.)</label>
              <Input
                id={valueId}
                name={valueId}
                value={attr.filterValue}
                onChange={handleValueChange}
                disabled={!attr.filterEnabled}
                placeholder="Start date"
                className="h-8 text-xs"
                type="datetime-local"
              />
            </div>
            <div className="flex-1">
              <label className="text-xs text-muted-foreground mb-1 block">End (incl.)</label>
              <Input
                id={valueEndId}
                name={valueEndId}
                value={attr.filterValueEnd || ""}
                onChange={handleValueEndChange}
                disabled={!attr.filterEnabled}
                placeholder="End date"
                className="h-8 text-xs"
                type="datetime-local"
              />
            </div>
          </div>
        ) : attr.valueOptions && attr.valueOptions.length > 0 ? (
          <Select value={attr.filterValue} onValueChange={handleSelectValueChange} disabled={!attr.filterEnabled}>
            <SelectTrigger id={valueId} className="h-8 text-xs">
              <SelectValue placeholder="Select value..." />
            </SelectTrigger>
            <SelectContent>
              {attr.valueOptions.map((opt) => (
                <SelectItem key={opt} value={opt}>
                  {opt}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <Input
            id={valueId}
            name={valueId}
            value={attr.filterValue}
            onChange={handleValueChange}
            disabled={!attr.filterEnabled}
            placeholder={getPlaceholder()}
            className="h-8 text-xs"
            type={isTimestamp && attr.filterOperator !== "=in=" ? "datetime-local" : "text"}
          />
        )}
      </TableCell>
    </TableRow>
  )
}
