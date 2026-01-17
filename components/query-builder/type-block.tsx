"use client"

import { useState, useMemo, useEffect } from "react"
import { ChevronDown, ChevronRight, Search, Loader2, Link2, Copy, ArrowRight, ArrowLeft, Repeat } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { AttributeList } from "./attribute-list"
import type { AttributeSelection, RelationshipSelection } from "@/lib/types/query-builder"

interface TypeBlockProps {
  typeName: string
  typeLabel: string
  attributes: AttributeSelection[]
  relationships: RelationshipSelection[]
  backwardRelationships?: RelationshipSelection[]
  onAttributeChange: (attrKey: string, changes: Partial<AttributeSelection>) => void
  onRelationshipToggle: (relId: string, enabled: boolean) => void
  onRelationshipLimitChange: (relId: string, limit: number) => void
  onRelationshipAttributeChange: (relPath: string[], attrKey: string, changes: Partial<AttributeSelection>) => void
  onNestedRelationshipToggle: (relPath: string[], enabled: boolean) => void
  onNestedRelationshipLimitChange: (relPath: string[], limit: number) => void
  onRepeatAttributes?: (relPath: string[], sourceAttributes: AttributeSelection[]) => void
  onRepeatPattern?: (
    recursiveRelId: string,
    sourceAttributes: AttributeSelection[],
    sourceForwardRels: RelationshipSelection[],
    sourceBackwardRels: RelationshipSelection[],
  ) => void
  loadingRelationships: Set<string>
  depth?: number
  relationshipPath?: string
  idPrefix?: string
  parentRelPath?: string[]
  ancestorTypes?: string[]
  collapseSignal?: number
  isRoot?: boolean
  limit?: number
  offset?: number
  onLimitChange?: (limit: number) => void
  onOffsetChange?: (offset: number) => void
}

interface CombinedRelationship extends RelationshipSelection {
  isBackward: boolean
}

function groupRelationshipsByTargetType(relationships: CombinedRelationship[]) {
  const groups: Record<string, CombinedRelationship[]> = {}
  for (const rel of relationships) {
    const displayType = rel.targetTypeLabel || rel.targetType
    if (!groups[displayType]) {
      groups[displayType] = []
    }
    groups[displayType].push(rel)
  }
  return groups
}

export function TypeBlock({
  typeName,
  typeLabel,
  attributes,
  relationships,
  backwardRelationships = [],
  onAttributeChange,
  onRelationshipToggle,
  onRelationshipLimitChange,
  onRelationshipAttributeChange,
  onNestedRelationshipToggle,
  onNestedRelationshipLimitChange,
  onRepeatAttributes,
  onRepeatPattern,
  loadingRelationships,
  depth = 0,
  relationshipPath,
  idPrefix = "root-",
  parentRelPath = [],
  ancestorTypes = [],
  collapseSignal = 0,
  isRoot = false,
  limit,
  offset,
  onLimitChange,
  onOffsetChange,
}: TypeBlockProps) {
  useEffect(() => {
    const selectedAttrs = attributes.filter((a) => a.selected)
    const filteredAttrs = attributes.filter((a) => a.filterEnabled)
    const enabledFwdRels = relationships.filter((r) => r.enabled)
    const enabledBwdRels = backwardRelationships.filter((r) => r.enabled)

    console.groupCollapsed(
      `[v0] TypeBlock: ${typeName} (depth=${depth}, attrs=${attributes.length}, fwdRels=${relationships.length}, bwdRels=${backwardRelationships.length})`,
    )
    console.log(
      "Selected attributes:",
      selectedAttrs.map((a) => a.key),
    )
    console.log(
      "Filtered attributes:",
      filteredAttrs.map((a) => ({ key: a.key, op: a.filterOperator, val: a.filterValue })),
    )
    console.log(
      "Enabled forward relationships:",
      enabledFwdRels.map((r) => r.relationshipKey),
    )
    console.log(
      "Enabled backward relationships:",
      enabledBwdRels.map((r) => r.relationshipKey),
    )
    console.groupEnd()
  }, [typeName, depth, attributes, relationships, backwardRelationships])

  const [attributesExpanded, setAttributesExpanded] = useState(true)
  const [relationshipsExpanded, setRelationshipsExpanded] = useState(depth === 0)
  const [relationshipSearch, setRelationshipSearch] = useState("")
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (collapseSignal > 0) {
      setAttributesExpanded(false)
      setRelationshipsExpanded(false)
      setExpandedGroups(new Set())
    }
  }, [collapseSignal])

  const currentAncestorTypes = useMemo(() => [...ancestorTypes, typeName], [ancestorTypes, typeName])

  const toggleGroup = (groupName: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(groupName)) {
        next.delete(groupName)
      } else {
        next.add(groupName)
      }
      return next
    })
  }

  const selectedAttrCount = useMemo(() => attributes.filter((a) => a.selected).length, [attributes])
  const filterAttrCount = useMemo(() => attributes.filter((a) => a.filterEnabled).length, [attributes])

  const combinedRelationships: CombinedRelationship[] = useMemo(() => {
    const fwd = relationships.map((r) => ({ ...r, isBackward: false }))
    const bwd = backwardRelationships.map((r) => ({ ...r, isBackward: true }))
    return [...fwd, ...bwd].sort((a, b) => {
      const aTarget = a.targetTypeLabel || a.targetType
      const bTarget = b.targetTypeLabel || b.targetType
      return aTarget.localeCompare(bTarget)
    })
  }, [relationships, backwardRelationships])

  const filteredRelationships = useMemo(() => {
    return combinedRelationships.filter((rel) => {
      if (!relationshipSearch.trim()) return true
      const lower = relationshipSearch.toLowerCase()
      return (
        rel.relationshipName.toLowerCase().includes(lower) ||
        rel.targetType.toLowerCase().includes(lower) ||
        rel.relationshipKey.toLowerCase().includes(lower)
      )
    })
  }, [combinedRelationships, relationshipSearch])

  const groupedRelationships = useMemo(() => {
    return groupRelationshipsByTargetType(filteredRelationships)
  }, [filteredRelationships])

  const enabledRelCount = useMemo(() => combinedRelationships.filter((r) => r.enabled).length, [combinedRelationships])
  const enabledRelationships = useMemo(() => combinedRelationships.filter((r) => r.enabled), [combinedRelationships])
  const hasSelectedAttrs = attributes.some((a) => a.selected || a.filterEnabled)

  const borderColors = [
    "border-l-primary",
    "border-l-blue-500",
    "border-l-green-500",
    "border-l-orange-500",
    "border-l-purple-500",
  ]
  const borderColor = borderColors[depth % borderColors.length]

  const handleRepeatAttributesForRel = (relId: string) => {
    if (onRepeatAttributes) {
      onRepeatAttributes([relId], attributes)
    }
  }

  const recursiveRelationship = useMemo(() => {
    const fwdRecursive = relationships.find((rel) => rel.targetType === typeName)
    if (fwdRecursive) return { rel: fwdRecursive, isBackward: false }
    const bwdRecursive = backwardRelationships.find((rel) => rel.targetType === typeName)
    if (bwdRecursive) return { rel: bwdRecursive, isBackward: true }
    return null
  }, [relationships, backwardRelationships, typeName])

  const hasConfiguredSettings = useMemo(() => {
    const hasSelectedAttrs = attributes.some((a) => a.selected || a.filterEnabled)
    const hasEnabledRels = relationships.some((r) => r.enabled) || backwardRelationships.some((r) => r.enabled)
    return hasSelectedAttrs || hasEnabledRels
  }, [attributes, relationships, backwardRelationships])

  const handleRepeatPattern = () => {
    if (recursiveRelationship && onRepeatPattern) {
      onRepeatPattern(recursiveRelationship.rel.id, attributes, relationships, backwardRelationships)
    }
  }

  return (
    <div className={`space-y-3 ${depth > 0 ? "ml-6" : ""}`}>
      <Card className={`border-l-4 ${borderColor}`}>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 flex-wrap">
              {relationshipPath && (
                <>
                  <Link2 className="h-4 w-4 text-muted-foreground" />
                  <Badge variant="outline" className="text-xs font-mono">
                    {relationshipPath}
                  </Badge>
                  <span className="text-muted-foreground">→</span>
                </>
              )}
              <CardTitle className="text-base">
                {typeLabel}
                {typeLabel !== typeName && (
                  <span className="text-muted-foreground font-normal text-sm ml-2">({typeName})</span>
                )}
              </CardTitle>
            </div>
            {recursiveRelationship && hasConfiguredSettings && onRepeatPattern && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="outline" size="sm" className="h-8 bg-transparent" onClick={handleRepeatPattern}>
                      <Repeat className="h-4 w-4 mr-2" />
                      Repeat Pattern
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Copy all attributes, filters, and relationships to the next recursive level</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-3">
          {isRoot && onLimitChange && onOffsetChange && (
            <div className="flex items-center gap-6 pb-3 border-b">
              <div className="flex items-center gap-2">
                <Label htmlFor="root-limit" className="text-sm whitespace-nowrap">
                  Items per page
                </Label>
                <Input
                  id="root-limit"
                  type="number"
                  min={1}
                  max={1000}
                  value={limit}
                  onChange={(e) => onLimitChange(Number.parseInt(e.target.value) || 10)}
                  className="w-24"
                />
              </div>
              <div className="flex items-center gap-2">
                <Label htmlFor="root-offset" className="text-sm whitespace-nowrap">
                  Page number
                </Label>
                <Input
                  id="root-offset"
                  type="number"
                  min={0}
                  value={offset}
                  onChange={(e) => onOffsetChange(Number.parseInt(e.target.value) || 0)}
                  className="w-24"
                />
              </div>
            </div>
          )}

          {/* Attributes Section */}
          <Collapsible open={attributesExpanded} onOpenChange={setAttributesExpanded}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="w-full justify-between p-2 h-auto hover:bg-muted/50">
                <div className="flex items-center gap-2">
                  {attributesExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  <span className="font-medium text-sm">Attributes</span>
                  <Badge variant="secondary" className="text-xs">
                    {selectedAttrCount} selected, {filterAttrCount} filtered
                  </Badge>
                </div>
              </Button>
            </CollapsibleTrigger>

            {!attributesExpanded && (selectedAttrCount > 0 || filterAttrCount > 0) && (
              <div className="px-2 py-1 text-xs flex flex-wrap gap-1">
                {attributes
                  .filter((a) => a.selected || a.filterEnabled)
                  .slice(0, 10)
                  .map((attr) => (
                    <Badge key={attr.key} variant="outline" className="text-xs">
                      {attr.label}
                      {attr.filterEnabled && ` (${attr.filterOperator})`}
                    </Badge>
                  ))}
                {attributes.filter((a) => a.selected || a.filterEnabled).length > 10 && (
                  <Badge variant="outline" className="text-xs">
                    +{attributes.filter((a) => a.selected || a.filterEnabled).length - 10} more
                  </Badge>
                )}
              </div>
            )}

            <CollapsibleContent className="pt-2">
              <AttributeList attributes={attributes} onAttributeChange={onAttributeChange} idPrefix={idPrefix} />
            </CollapsibleContent>
          </Collapsible>

          {combinedRelationships.length > 0 && (
            <Collapsible open={relationshipsExpanded} onOpenChange={setRelationshipsExpanded}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="w-full justify-between p-2 h-auto hover:bg-muted/50">
                  <div className="flex items-center gap-2">
                    {relationshipsExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    <Link2 className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium text-sm">Relationships</span>
                    <Badge variant="secondary" className="text-xs">
                      {enabledRelCount} enabled
                    </Badge>
                  </div>
                </Button>
              </CollapsibleTrigger>

              {!relationshipsExpanded && enabledRelCount > 0 && (
                <div className="px-2 py-1 text-xs flex flex-wrap gap-1">
                  {enabledRelationships.map((rel) => (
                    <Badge key={rel.id} variant="outline" className="text-xs">
                      {rel.isBackward ? "←" : "→"} {rel.relationshipName} → {rel.targetTypeLabel || rel.targetType}
                    </Badge>
                  ))}
                </div>
              )}

              <CollapsibleContent className="pt-2 space-y-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search relationships..."
                    value={relationshipSearch}
                    onChange={(e) => setRelationshipSearch(e.target.value)}
                    className="pl-9 h-9"
                  />
                </div>

                <div className="space-y-2">
                  {Object.entries(groupedRelationships)
                    .sort(([a], [b]) => a.localeCompare(b))
                    .map(([targetType, rels]) => {
                      const isGroupExpanded = expandedGroups.has(targetType)
                      const enabledInGroup = rels.filter((r) => r.enabled).length
                      return (
                        <Collapsible
                          key={targetType}
                          open={isGroupExpanded}
                          onOpenChange={() => toggleGroup(targetType)}
                        >
                          <CollapsibleTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="w-full justify-start gap-2 h-8 px-2 hover:bg-muted/50"
                            >
                              {isGroupExpanded ? (
                                <ChevronDown className="h-3 w-3" />
                              ) : (
                                <ChevronRight className="h-3 w-3" />
                              )}
                              <span className="text-xs font-medium">{targetType}</span>
                              <Badge variant="outline" className="text-xs ml-auto">
                                {enabledInGroup > 0 ? `${enabledInGroup}/${rels.length}` : rels.length}
                              </Badge>
                            </Button>
                          </CollapsibleTrigger>

                          {!isGroupExpanded && enabledInGroup > 0 && (
                            <div className="px-6 py-1 flex flex-wrap gap-1">
                              {rels
                                .filter((r) => r.enabled)
                                .map((rel) => (
                                  <Badge key={rel.id} variant="secondary" className="text-xs">
                                    {rel.isBackward ? "←" : "→"} {rel.relationshipName}
                                  </Badge>
                                ))}
                            </div>
                          )}

                          <CollapsibleContent>
                            <div className="space-y-1 pl-3 border-l-2 border-muted ml-2">
                              {rels.map((rel) => {
                                const isLoading = loadingRelationships.has(rel.id)
                                const isRecursive = currentAncestorTypes.includes(rel.targetType)
                                return (
                                  <div
                                    key={rel.id}
                                    className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-muted/50"
                                  >
                                    <div className="flex items-center gap-2">
                                      <Checkbox
                                        id={`${idPrefix}rel-${rel.id}`}
                                        checked={rel.enabled}
                                        onCheckedChange={(checked) => onRelationshipToggle(rel.id, checked === true)}
                                        disabled={isLoading}
                                      />
                                      {rel.isBackward ? (
                                        <ArrowLeft className="h-3 w-3 text-orange-500" />
                                      ) : (
                                        <ArrowRight className="h-3 w-3 text-blue-500" />
                                      )}
                                      <Label
                                        htmlFor={`${idPrefix}rel-${rel.id}`}
                                        className="text-sm font-medium cursor-pointer"
                                      >
                                        {rel.relationshipName}
                                      </Label>
                                      {isLoading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
                                      {isRecursive && (
                                        <Badge variant="outline" className="text-xs text-orange-600 border-orange-300">
                                          recursive
                                        </Badge>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-2">
                                      {rel.enabled && isRecursive && hasSelectedAttrs && onRepeatAttributes && (
                                        <TooltipProvider>
                                          <Tooltip>
                                            <TooltipTrigger asChild>
                                              <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-7 px-2"
                                                onClick={() => handleRepeatAttributesForRel(rel.id)}
                                              >
                                                <Copy className="h-3 w-3 mr-1" />
                                                <span className="text-xs">Repeat</span>
                                              </Button>
                                            </TooltipTrigger>
                                            <TooltipContent>
                                              <p>Copy attribute selections to child type</p>
                                            </TooltipContent>
                                          </Tooltip>
                                        </TooltipProvider>
                                      )}
                                      {rel.enabled && (
                                        <div className="flex items-center gap-2">
                                          <Label className="text-xs text-muted-foreground">Limit:</Label>
                                          <Input
                                            type="number"
                                            value={rel.limit}
                                            onChange={(e) =>
                                              onRelationshipLimitChange(rel.id, Number.parseInt(e.target.value) || 10)
                                            }
                                            className="w-16 h-7 text-xs"
                                            min={1}
                                          />
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          </CollapsibleContent>
                        </Collapsible>
                      )
                    })}
                </div>

                {filteredRelationships.length === 0 && relationshipSearch && (
                  <div className="text-center text-muted-foreground py-4 text-sm">
                    No relationships match "{relationshipSearch}"
                  </div>
                )}
              </CollapsibleContent>
            </Collapsible>
          )}
        </CardContent>
      </Card>

      {/* Render enabled relationships as nested TypeBlocks */}
      {enabledRelationships.map((rel) => {
        const currentRelPath = [...parentRelPath, rel.id]
        // Get the source arrays for forward vs backward relationships
        const sourceRels = rel.isBackward ? backwardRelationships : relationships
        const actualRel = sourceRels.find((r) => r.id === rel.id)
        if (!actualRel) return null

        // Split nested relationships back into forward and backward for the child
        const childForwardRels = actualRel.nestedRelationships.filter((r) => r.direction === "FORWARD")
        const childBackwardRels = actualRel.nestedRelationships.filter((r) => r.direction === "BACKWARDS")

        return (
          <TypeBlock
            key={rel.id}
            typeName={rel.targetType}
            typeLabel={rel.targetTypeLabel || rel.targetType}
            attributes={actualRel.attributes}
            relationships={childForwardRels}
            backwardRelationships={childBackwardRels}
            onAttributeChange={(attrKey, changes) => onRelationshipAttributeChange(currentRelPath, attrKey, changes)}
            onRelationshipToggle={(nestedRelId, enabled) =>
              onNestedRelationshipToggle([...currentRelPath, nestedRelId], enabled)
            }
            onRelationshipLimitChange={(nestedRelId, limit) =>
              onNestedRelationshipLimitChange([...currentRelPath, nestedRelId], limit)
            }
            onRelationshipAttributeChange={onRelationshipAttributeChange}
            onNestedRelationshipToggle={onNestedRelationshipToggle}
            onNestedRelationshipLimitChange={onNestedRelationshipLimitChange}
            onRepeatAttributes={onRepeatAttributes}
            onRepeatPattern={onRepeatPattern}
            loadingRelationships={loadingRelationships}
            depth={depth + 1}
            relationshipPath={rel.relationshipKey}
            idPrefix={`${idPrefix}${rel.id}-`}
            parentRelPath={currentRelPath}
            ancestorTypes={currentAncestorTypes}
            collapseSignal={collapseSignal}
          />
        )
      })}
    </div>
  )
}
