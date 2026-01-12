"use client"

import type React from "react"

import { useState, useCallback, memo, useMemo } from "react"
import { ChevronDown, ChevronRight, Link2, Loader2 } from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { AttributeList } from "./attribute-list"
import type { RelationshipSelection, AttributeSelection } from "@/lib/types/query-builder"
import { cn } from "@/lib/utils"

interface RelationshipCardProps {
  relationship: RelationshipSelection
  onToggle: (enabled: boolean) => void
  onLimitChange: (limit: number) => void
  onAttributeChange: (attrKey: string, changes: Partial<AttributeSelection>) => void
  onNestedRelationshipToggle?: (nestedRelId: string, enabled: boolean) => void
  onNestedRelationshipLimitChange?: (nestedRelId: string, limit: number) => void
  onNestedRelationshipAttributeChange?: (
    nestedRelId: string,
    attrKey: string,
    changes: Partial<AttributeSelection>,
  ) => void
  isLoading?: boolean
  depth?: number
}

export const RelationshipCard = memo(function RelationshipCard({
  relationship,
  onToggle,
  onLimitChange,
  onAttributeChange,
  onNestedRelationshipToggle,
  onNestedRelationshipLimitChange,
  onNestedRelationshipAttributeChange,
  isLoading = false,
  depth = 0,
}: RelationshipCardProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  const depthColors = ["border-l-primary/40", "border-l-blue-500/40", "border-l-green-500/40", "border-l-orange-500/40"]
  const borderColor = depth > 0 ? depthColors[Math.min(depth - 1, depthColors.length - 1)] : ""

  const selectedAttrCount = useMemo(
    () => relationship.attributes.filter((a) => a.selected).length,
    [relationship.attributes],
  )
  const filterCount = useMemo(
    () => relationship.attributes.filter((a) => a.filterEnabled).length,
    [relationship.attributes],
  )
  const enabledNestedCount = useMemo(
    () => relationship.nestedRelationships.filter((r) => r.enabled).length,
    [relationship.nestedRelationships],
  )

  const handleCheckboxChange = useCallback(
    (checked: boolean | "indeterminate") => {
      onToggle(checked === true)
    },
    [onToggle],
  )

  const handleLimitChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onLimitChange(Number.parseInt(e.target.value) || 0)
    },
    [onLimitChange],
  )

  return (
    <div className={cn("rounded-lg border bg-card", depth > 0 && `ml-4 border-l-4 ${borderColor}`)}>
      {/* Header row */}
      <div className="flex items-center gap-3 p-3">
        <Checkbox
          id={`rel-${relationship.id}`}
          name={`rel-${relationship.id}`}
          checked={relationship.enabled}
          onCheckedChange={handleCheckboxChange}
          disabled={isLoading}
        />

        <Button
          variant="ghost"
          size="sm"
          className="p-0 h-auto hover:bg-transparent"
          disabled={!relationship.enabled}
          onClick={() => setIsExpanded(!isExpanded)}
        >
          {isExpanded && relationship.enabled ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
        </Button>

        <Link2 className="h-4 w-4 text-muted-foreground shrink-0" />

        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span className="font-medium text-sm truncate">{relationship.relationshipName}</span>
          <span className="text-muted-foreground text-sm">→</span>
          <span className="text-sm text-muted-foreground truncate">{relationship.targetType}</span>
        </div>

        {relationship.enabled && !isExpanded && (
          <div className="flex items-center gap-1">
            {selectedAttrCount > 0 && (
              <Badge variant="secondary" className="text-xs">
                {selectedAttrCount} attr
              </Badge>
            )}
            {filterCount > 0 && (
              <Badge variant="outline" className="text-xs">
                {filterCount} filter
              </Badge>
            )}
            {enabledNestedCount > 0 && (
              <Badge variant="default" className="text-xs">
                {enabledNestedCount} rel
              </Badge>
            )}
          </div>
        )}

        {isLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
      </div>

      {/* Expanded content */}
      {relationship.enabled && isExpanded && (
        <div className="px-3 pb-3 pt-0 space-y-4 border-t">
          {/* Limit control */}
          <div className="flex items-center gap-3 pt-3">
            <Label htmlFor={`limit-${relationship.id}`} className="text-sm text-muted-foreground">
              Limit:
            </Label>
            <Input
              id={`limit-${relationship.id}`}
              name={`limit-${relationship.id}`}
              type="number"
              value={relationship.limit}
              onChange={handleLimitChange}
              className="w-20 h-8"
              min={0}
            />
          </div>

          {/* Attributes with collapsible */}
          {relationship.attributes.length > 0 ? (
            <AttributeList
              attributes={relationship.attributes}
              onAttributeChange={onAttributeChange}
              title={`${relationship.targetType} Attributes`}
              idPrefix={`${relationship.id}-`}
              collapsible
              defaultExpanded={false}
            />
          ) : isLoading ? (
            <div className="py-4 text-center text-muted-foreground text-sm">Loading attributes...</div>
          ) : (
            <div className="py-4 text-center text-muted-foreground text-sm">No attributes available</div>
          )}

          {/* Nested relationships */}
          {relationship.nestedRelationships.length > 0 && (
            <Collapsible defaultOpen={false}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="w-full justify-between px-3 py-2 h-auto">
                  <div className="flex items-center gap-2">
                    <ChevronRight className="h-4 w-4 transition-transform data-[state=open]:rotate-90" />
                    <span className="font-medium text-sm">{relationship.targetType} Relationships</span>
                    <Badge variant="secondary" className="text-xs">
                      {relationship.nestedRelationships.length} available
                    </Badge>
                  </div>
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="space-y-2 pt-2">
                  {relationship.nestedRelationships.map((nestedRel) => (
                    <RelationshipCard
                      key={nestedRel.id}
                      relationship={nestedRel}
                      onToggle={(enabled) => onNestedRelationshipToggle?.(nestedRel.id, enabled)}
                      onLimitChange={(limit) => onNestedRelationshipLimitChange?.(nestedRel.id, limit)}
                      onAttributeChange={(attrKey, changes) =>
                        onNestedRelationshipAttributeChange?.(nestedRel.id, attrKey, changes)
                      }
                      depth={depth + 1}
                    />
                  ))}
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}
        </div>
      )}
    </div>
  )
})
