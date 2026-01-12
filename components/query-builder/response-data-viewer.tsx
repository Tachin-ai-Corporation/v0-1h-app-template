"use client"

import { useState, useMemo } from "react"
import { ChevronRight, ChevronDown, Search, Database, Link2, Hash, Calendar, FileText, List } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"

interface ResponseDataViewerProps {
  data: any
}

// Extract the short attribute name from the full path
function getShortAttrName(fullKey: string): string {
  const parts = fullKey.split(".")
  return parts[parts.length - 1]
}

// Format a value for display
function formatValue(value: any): string {
  if (value === null || value === undefined) return "—"
  if (typeof value === "boolean") return value ? "Yes" : "No"
  if (Array.isArray(value)) {
    if (value.length === 0) return "[]"
    if (value.length === 1) return String(value[0])
    return value.join(", ")
  }
  if (typeof value === "object") {
    const keys = Object.keys(value)
    if (keys.length === 0) return "{}"
    return `{${keys.length} fields}`
  }
  return String(value)
}

// Get icon for attribute type
function getAttrIcon(name: string, value: any) {
  const lowerName = name.toLowerCase()
  if (lowerName === "id") return <Hash className="h-3 w-3 text-muted-foreground" />
  if (
    lowerName.includes("date") ||
    lowerName.includes("created") ||
    lowerName.includes("updated") ||
    lowerName.includes("completed")
  )
    return <Calendar className="h-3 w-3 text-muted-foreground" />
  if (typeof value === "object" && value !== null) return <FileText className="h-3 w-3 text-muted-foreground" />
  return null
}

// Check if value is expandable (object with content)
function isExpandableValue(value: any): boolean {
  return typeof value === "object" && value !== null && !Array.isArray(value) && Object.keys(value).length > 0
}

// Attribute row component
function AttributeRow({
  name,
  value,
  depth = 0,
  searchTerm = "",
}: {
  name: string
  value: any
  depth?: number
  searchTerm?: string
}) {
  const [expanded, setExpanded] = useState(false)
  const shortName = getShortAttrName(name)
  const isExpandable = isExpandableValue(value)
  const displayValue = formatValue(value)

  // Highlight search matches
  const matchesSearch =
    searchTerm &&
    (shortName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      displayValue.toLowerCase().includes(searchTerm.toLowerCase()))

  return (
    <div>
      <div
        className={cn(
          "flex items-center gap-2 py-1.5 px-2 rounded text-sm hover:bg-muted/50",
          matchesSearch && "bg-yellow-100 dark:bg-yellow-900/30",
          isExpandable && "cursor-pointer",
        )}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onClick={() => isExpandable && setExpanded(!expanded)}
      >
        {isExpandable ? (
          expanded ? (
            <ChevronDown className="h-3 w-3 text-muted-foreground flex-shrink-0" />
          ) : (
            <ChevronRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />
          )
        ) : (
          <span className="w-3 flex-shrink-0" />
        )}
        {getAttrIcon(shortName, value)}
        <span className="font-medium text-muted-foreground min-w-[120px] flex-shrink-0">{shortName}</span>
        <span className="text-foreground truncate">{displayValue}</span>
      </div>
      {isExpandable && expanded && (
        <div className="border-l border-muted ml-4">
          {Object.entries(value).map(([key, val]) => (
            <AttributeRow key={key} name={key} value={val} depth={depth + 1} searchTerm={searchTerm} />
          ))}
        </div>
      )}
    </div>
  )
}

function AttributesSection({
  attributes,
  searchTerm = "",
  depth = 0,
}: {
  attributes: Record<string, any>
  searchTerm?: string
  depth?: number
}) {
  const [expanded, setExpanded] = useState(true)
  const attrCount = Object.keys(attributes).length

  if (attrCount === 0) return null

  return (
    <div>
      <div
        className="flex items-center gap-2 py-1 px-2 cursor-pointer hover:bg-muted/50 rounded text-xs"
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? (
          <ChevronDown className="h-3 w-3 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-3 w-3 text-muted-foreground" />
        )}
        <List className="h-3 w-3 text-blue-500" />
        <span className="text-muted-foreground font-medium">Attributes</span>
        <Badge variant="outline" className="text-xs h-4 px-1">
          {attrCount}
        </Badge>
      </div>
      {expanded && (
        <div className="pl-2">
          {Object.entries(attributes).map(([key, value]) => (
            <AttributeRow key={key} name={key} value={value} depth={depth} searchTerm={searchTerm} />
          ))}
        </div>
      )}
    </div>
  )
}

// Relationship instance component
function RelationshipInstance({
  instance,
  depth = 0,
  searchTerm = "",
}: {
  instance: any
  depth?: number
  searchTerm?: string
}) {
  const [headerExpanded, setHeaderExpanded] = useState(true)
  const attributes = instance?.attributes || {}
  const relationships = instance?.relationships || {}
  const hasRelationships = Object.keys(relationships).length > 0

  // Get type name from the first attribute key
  const firstAttrKey = Object.keys(attributes)[0] || ""
  const typeName = firstAttrKey.split(".").slice(-2, -1)[0] || "Instance"

  // Extract id if available
  const idKey = Object.keys(attributes).find((k) => k.endsWith(".id"))
  const id = idKey ? attributes[idKey] : null

  return (
    <div className="border-l-2 border-primary/20 ml-2" style={{ marginLeft: `${depth * 8}px` }}>
      {/* Instance header - just shows type name and ID */}
      <div
        className="flex items-center gap-2 py-1.5 px-2 cursor-pointer hover:bg-muted/50 rounded"
        onClick={() => setHeaderExpanded(!headerExpanded)}
      >
        {headerExpanded ? (
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
        )}
        <Database className="h-3.5 w-3.5 text-primary" />
        <span className="font-medium text-sm">{typeName}</span>
        {id && (
          <Badge variant="outline" className="text-xs font-mono">
            #{id}
          </Badge>
        )}
      </div>

      {/* Content area - attributes and relationships as separate collapsible sections */}
      {headerExpanded && (
        <div className="pl-4 space-y-1">
          {/* Attributes section - independently collapsible */}
          <AttributesSection attributes={attributes} searchTerm={searchTerm} depth={depth + 1} />

          {/* Nested relationships - always visible when header is expanded */}
          {hasRelationships &&
            Object.entries(relationships).map(([relKey, relInstances]) => {
              if (!Array.isArray(relInstances) || relInstances.length === 0) return null
              const relName = relKey.split(".")[1] || relKey
              return (
                <RelationshipSection
                  key={relKey}
                  name={relName}
                  instances={relInstances}
                  depth={depth + 1}
                  searchTerm={searchTerm}
                />
              )
            })}
        </div>
      )}
    </div>
  )
}

// Relationship section component
function RelationshipSection({
  name,
  instances,
  depth = 0,
  searchTerm = "",
}: {
  name: string
  instances: any[]
  depth?: number
  searchTerm?: string
}) {
  const [expanded, setExpanded] = useState(depth < 2)

  return (
    <div className="mt-2">
      <div
        className="flex items-center gap-2 py-1 px-2 cursor-pointer hover:bg-muted/50 rounded"
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? (
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
        )}
        <Link2 className="h-3.5 w-3.5 text-orange-500" />
        <span className="text-sm font-medium text-muted-foreground">{name}</span>
        <Badge variant="secondary" className="text-xs">
          {instances.length}
        </Badge>
      </div>

      {expanded && (
        <div className="space-y-1 mt-1">
          {instances.map((item, idx) => (
            <RelationshipInstance key={idx} instance={item.instance} depth={depth} searchTerm={searchTerm} />
          ))}
        </div>
      )}
    </div>
  )
}

// Root item component
function RootItem({ item, searchTerm = "" }: { item: any; searchTerm?: string }) {
  const [expanded, setExpanded] = useState(true)
  const rootType = item?.key?.root || "Unknown"
  const attributes = item?.attributes || {}
  const relationships = item?.relationships || {}

  // Get ID from attributes
  const idKey = Object.keys(attributes).find((k) => k.endsWith(".id"))
  const id = idKey ? attributes[idKey] : null

  return (
    <div className="border rounded-lg overflow-hidden bg-card">
      <div
        className="flex items-center gap-2 p-3 bg-muted/50 cursor-pointer hover:bg-muted/70"
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        )}
        <Database className="h-4 w-4 text-primary" />
        <span className="font-semibold">{rootType}</span>
        {id && (
          <Badge variant="outline" className="font-mono text-xs">
            #{id}
          </Badge>
        )}
      </div>

      {expanded && (
        <div className="p-3 space-y-1">
          {/* Attributes section - independently collapsible */}
          <AttributesSection attributes={attributes} searchTerm={searchTerm} />

          {/* Relationships - always visible when root is expanded */}
          {Object.entries(relationships).map(([relKey, relInstances]) => {
            if (!Array.isArray(relInstances) || relInstances.length === 0) return null
            const relName = relKey.split(".")[1] || relKey
            return <RelationshipSection key={relKey} name={relName} instances={relInstances} searchTerm={searchTerm} />
          })}
        </div>
      )}
    </div>
  )
}

export function ResponseDataViewer({ data }: ResponseDataViewerProps) {
  const [searchTerm, setSearchTerm] = useState("")

  const items = useMemo(() => {
    if (!data) return []
    if (Array.isArray(data.data)) return data.data
    if (Array.isArray(data)) return data
    return [data]
  }, [data])

  if (items.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-8">
        <p>No data to display</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search attributes and values..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-9 h-9"
        />
      </div>

      {/* Data items */}
      <ScrollArea className="h-[350px]">
        <div className="space-y-3 pr-4">
          {items.map((item, idx) => (
            <RootItem key={idx} item={item} searchTerm={searchTerm} />
          ))}
        </div>
      </ScrollArea>
    </div>
  )
}
