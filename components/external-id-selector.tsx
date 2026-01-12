"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { ChevronDown, Copy, Check, ExternalLink, Loader2 } from "lucide-react"
import type { ExternalSystemId } from "@/app/actions/query"

interface ExternalIdSelectorProps {
  externalIds: ExternalSystemId[]
  isLoading?: boolean
}

export function ExternalIdSelector({ externalIds, isLoading }: ExternalIdSelectorProps) {
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [copied, setCopied] = useState(false)
  const [isHovered, setIsHovered] = useState(false)

  const handleCopy = async () => {
    if (externalIds.length === 0) return
    const idToCopy = externalIds[selectedIndex].externalId
    await navigator.clipboard.writeText(idToCopy)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <ExternalLink className="h-4 w-4 flex-shrink-0" />
        <Loader2 className="h-3 w-3 animate-spin" />
        <span>Loading IDs...</span>
      </div>
    )
  }

  if (externalIds.length === 0) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <ExternalLink className="h-4 w-4 flex-shrink-0" />
        <span>No external IDs</span>
      </div>
    )
  }

  const selectedId = externalIds[selectedIndex]

  // Single ID - no dropdown needed
  if (externalIds.length === 1) {
    return (
      <div
        className="flex items-center gap-2 text-sm group"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <ExternalLink className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
        <span className="truncate">
          <span className="text-muted-foreground">{selectedId.systemName}: </span>
          <span className="text-primary font-medium">{selectedId.externalId}</span>
        </span>
        <Button
          variant="ghost"
          size="icon"
          className={`h-5 w-5 flex-shrink-0 transition-opacity duration-200 ease-in-out ${isHovered ? "opacity-100" : "opacity-0"}`}
          onClick={handleCopy}
        >
          {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
        </Button>
      </div>
    )
  }

  // Multiple IDs - show dropdown
  return (
    <div
      className="flex items-center gap-2 text-sm"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <ExternalLink className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-6 px-2 py-0 font-normal hover:text-foreground">
            <span className="truncate max-w-[180px]">
              <span className="text-muted-foreground">{selectedId.systemName}: </span>
              <span className="text-primary font-medium">{selectedId.externalId}</span>
            </span>
            <ChevronDown className="h-3 w-3 ml-1 flex-shrink-0 text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          {externalIds.map((id, index) => (
            <DropdownMenuItem
              key={`${id.systemName}-${id.externalId}`}
              onClick={() => setSelectedIndex(index)}
              className={index === selectedIndex ? "bg-accent" : ""}
            >
              <span className="text-muted-foreground">{id.systemName}: </span>
              <span className="text-primary font-medium">{id.externalId}</span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      <Button
        variant="ghost"
        size="icon"
        className={`h-5 w-5 flex-shrink-0 transition-opacity duration-200 ease-in-out ${isHovered ? "opacity-100" : "opacity-0"}`}
        onClick={handleCopy}
      >
        {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
      </Button>
    </div>
  )
}
