"use client"

import { useState, useMemo } from "react"
import { Check, ChevronsUpDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Label } from "@/components/ui/label"
import { Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

interface TypeInfo {
  boKey: string
  name: string
}

interface TypeSelectorProps {
  types: TypeInfo[]
  selectedType: string | null
  onTypeChange: (typeKey: string) => void
  isLoading?: boolean
  disabled?: boolean
}

export function TypeSelector({
  types,
  selectedType,
  onTypeChange,
  isLoading = false,
  disabled = false,
}: TypeSelectorProps) {
  const [open, setOpen] = useState(false)

  const selectedTypeInfo = useMemo(() => {
    return types.find((t) => t.boKey === selectedType)
  }, [types, selectedType])

  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">Root Type</Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled || isLoading}
            className="w-full justify-between bg-transparent"
          >
            {isLoading ? (
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Loading types...</span>
              </div>
            ) : selectedTypeInfo ? (
              <span>
                {selectedTypeInfo.name} ({selectedTypeInfo.boKey})
              </span>
            ) : (
              <span className="text-muted-foreground">Search and select a type...</span>
            )}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[400px] p-0" align="start">
          <Command>
            <CommandInput placeholder="Search types..." />
            <CommandList>
              <CommandEmpty>No types found.</CommandEmpty>
              <CommandGroup className="max-h-[300px] overflow-y-auto">
                {types.map((type) => (
                  <CommandItem
                    key={type.boKey}
                    value={`${type.name} ${type.boKey}`}
                    onSelect={() => {
                      onTypeChange(type.boKey)
                      setOpen(false)
                    }}
                  >
                    <Check className={cn("mr-2 h-4 w-4", selectedType === type.boKey ? "opacity-100" : "opacity-0")} />
                    <span className="font-medium">{type.name}</span>
                    <span className="ml-2 text-muted-foreground text-sm">({type.boKey})</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  )
}
