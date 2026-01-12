"use client"

import { useState, useMemo, useEffect } from "react"
import { ChevronDown, ChevronRight, Search, Loader2, Link2, Copy, ArrowRight, ArrowLeft } from "lucide-react"
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
  loadingRelationships: Set<string>
  depth?: number
  relationshipPath?: string
  idPrefix?: string
  parentRelPath?: string[]
  ancestorTypes?: string[]
  collapseSignal?: number
}

function groupRelationshipsByTargetType(relationships: RelationshipSelection[]) {
  const groups: Record<string, RelationshipSelection[]> = {}
  for (const rel of relationships) {
    const displayType = rel.targetTypeLabel || rel.targetType
    if (!groups[displayType]) {
      groups[displayType] = []
    }
    groups[displayType].push(rel)
  }
  return groups
}

function RelationshipSection({
  title,
  icon: Icon,
  relationships,
  relationshipSearch,
  setRelationshipSearch,
  expandedGroups,
  toggleGroup,
  loadingRelationships,
  currentAncestorTypes,
  attributes,
  idPrefix,
  onRelationshipToggle,
  onRelationshipLimitChange,
  onRepeatAttributes,
  isExpanded,
  onExpandedChange,
}: {
  title: string
  icon: typeof ArrowRight
  relationships: RelationshipSelection[]
  relationshipSearch: string
  setRelationshipSearch: (v: string) => void
  expandedGroups: Set<string>
  toggleGroup: (group: string) => void
  loadingRelationships: Set<string>
  currentAncestorTypes: string[]
  attributes: AttributeSelection[]
  idPrefix: string
  onRelationshipToggle: (relId: string, enabled: boolean) => void
  onRelationshipLimitChange: (relId: string, limit: number) => void
  onRepeatAttributes?: (relId: string) => void
  isExpanded: boolean
  onExpandedChange: (v: boolean) => void
}) {
  const filteredRelationships = useMemo(() => {
    return relationships.filter((rel) => {
      if (!relationshipSearch.trim()) return true
      const lower = relationshipSearch.toLowerCase()
      return (
        rel.relationshipName.toLowerCase().includes(lower) ||
        rel.targetType.toLowerCase().includes(lower) ||
        rel.relationshipKey.toLowerCase().includes(lower)
      )
    })
  }, [relationships, relationshipSearch])

  const groupedRelationships = useMemo(() => {
    return groupRelationshipsByTargetType(filteredRelationships)
  }, [filteredRelationships])

  const enabledRelCount = useMemo(() => relationships.filter((r) => r.enabled).length, [relationships])
  const enabledRelationships = useMemo(() => relationships.filter((r) => r.enabled), [relationships])
  const hasSelectedAttrs = attributes.some((a) => a.selected || a.filterEnabled)

  if (relationships.length === 0) return null

  return (
    <Collapsible open={isExpanded} onOpenChange={onExpandedChange}>
      <CollapsibleTrigger asChild>
        <Button variant="ghost" className="w-full justify-between p-2 h-auto hover:bg-muted/50">
          <div className="flex items-center gap-2">
            {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            <Icon className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium text-sm">{title}</span>
            <Badge variant="secondary" className="text-xs">
              {enabledRelCount} enabled
            </Badge>
          </div>
        </Button>
      </CollapsibleTrigger>

      {!isExpanded && enabledRelCount > 0 && (
        <div className="px-2 py-1 text-xs flex flex-wrap gap-1">
          {enabledRelationships.map((rel) => (
            <Badge key={rel.id} variant="outline" className="text-xs">
              {rel.relationshipName} → {rel.targetTypeLabel || rel.targetType}
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
                <Collapsible key={targetType} open={isGroupExpanded} onOpenChange={() => toggleGroup(targetType)}>
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="sm" className="w-full justify-start gap-2 h-8 px-2 hover:bg-muted/50">
                      {isGroupExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                      <span className="text-xs font-medium">→ {targetType}</span>
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
                            {rel.relationshipName}
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
                                        onClick={() => onRepeatAttributes(rel.id)}
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
  )
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
  loadingRelationships,
  depth = 0,
  relationshipPath,
  idPrefix = "root-",
  parentRelPath = [],
  ancestorTypes = [],
  collapseSignal = 0,
}: TypeBlockProps) {
  console.log(
    `[v0] TypeBlock render: ${typeName}, depth=${depth}, attrs=${attributes.length}, fwdRels=${relationships.length}, bwdRels=${backwardRelationships.length}`,
  )

  const [attributesExpanded, setAttributesExpanded] = useState(true)
  const [forwardRelationshipsExpanded, setForwardRelationshipsExpanded] = useState(depth === 0)
  const [backwardRelationshipsExpanded, setBackwardRelationshipsExpanded] = useState(depth === 0)
  const [forwardRelationshipSearch, setForwardRelationshipSearch] = useState("")
  const [backwardRelationshipSearch, setBackwardRelationshipSearch] = useState("")
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (collapseSignal > 0) {
      setAttributesExpanded(false)
      setForwardRelationshipsExpanded(false)
      setBackwardRelationshipsExpanded(false)
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

  const allEnabledRelationships = useMemo(
    () => [...relationships.filter((r) => r.enabled), ...backwardRelationships.filter((r) => r.enabled)],
    [relationships, backwardRelationships],
  )

  const borderColors = [
    "border-l-primary",
    "border-l-blue-500",
    "border-l-green-500",
    "border-l-orange-500",
    "border-l-purple-500",
  ]
  const borderColor = borderColors[depth % borderColors.length]

  const handleRepeatAttributes = (relId: string) => {
    if (onRepeatAttributes) {
      onRepeatAttributes([relId], attributes)
    }
  }

  return (
    <div className="space-y-3">
      <Card className={`border-l-4 ${borderColor}`}>
        <CardHeader className="pb-2">
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
        </CardHeader>

        <CardContent className="space-y-3">
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

          <RelationshipSection
            title="Relationships (Forward)"
            icon={ArrowRight}
            relationships={relationships}
            relationshipSearch={forwardRelationshipSearch}
            setRelationshipSearch={setForwardRelationshipSearch}
            expandedGroups={expandedGroups}
            toggleGroup={toggleGroup}
            loadingRelationships={loadingRelationships}
            currentAncestorTypes={currentAncestorTypes}
            attributes={attributes}
            idPrefix={`${idPrefix}fwd-`}
            onRelationshipToggle={onRelationshipToggle}
            onRelationshipLimitChange={onRelationshipLimitChange}
            onRepeatAttributes={onRepeatAttributes ? handleRepeatAttributes : undefined}
            isExpanded={forwardRelationshipsExpanded}
            onExpandedChange={setForwardRelationshipsExpanded}
          />

          <RelationshipSection
            title="Relationships (From)"
            icon={ArrowLeft}
            relationships={backwardRelationships}
            relationshipSearch={backwardRelationshipSearch}
            setRelationshipSearch={setBackwardRelationshipSearch}
            expandedGroups={expandedGroups}
            toggleGroup={toggleGroup}
            loadingRelationships={loadingRelationships}
            currentAncestorTypes={currentAncestorTypes}
            attributes={attributes}
            idPrefix={`${idPrefix}bwd-`}
            onRelationshipToggle={onRelationshipToggle}
            onRelationshipLimitChange={onRelationshipLimitChange}
            onRepeatAttributes={onRepeatAttributes ? handleRepeatAttributes : undefined}
            isExpanded={backwardRelationshipsExpanded}
            onExpandedChange={setBackwardRelationshipsExpanded}
          />
        </CardContent>
      </Card>

      {allEnabledRelationships.map((rel) => {
        const currentRelPath = [...parentRelPath, rel.id]

        const nestedForward = rel.nestedRelationships.filter((r) => r.direction === "FORWARD")
        const nestedBackward = rel.nestedRelationships.filter((r) => r.direction === "BACKWARDS")

        console.log(
          `[v0] Rendering child TypeBlock for ${rel.relationshipName}, direction=${rel.direction}, attrs=${rel.attributes.length}, nestedFwd=${nestedForward.length}, nestedBwd=${nestedBackward.length}`,
        )
        return (
          <div key={rel.id} className="ml-4">
            <TypeBlock
              typeName={rel.targetType}
              typeLabel={rel.targetTypeLabel || rel.targetType}
              attributes={rel.attributes}
              relationships={nestedForward}
              backwardRelationships={nestedBackward}
              onAttributeChange={(attrKey, changes) => {
                console.log(`[v0] Child onAttributeChange: relPath=[${currentRelPath.join(",")}], attr=${attrKey}`)
                onRelationshipAttributeChange(currentRelPath, attrKey, changes)
              }}
              onRelationshipToggle={(nestedRelId, enabled) => {
                const fullPath = [...currentRelPath, nestedRelId]
                console.log(`[v0] Child onRelationshipToggle: fullPath=[${fullPath.join(",")}], enabled=${enabled}`)
                onNestedRelationshipToggle(fullPath, enabled)
              }}
              onRelationshipLimitChange={(nestedRelId, limit) => {
                onNestedRelationshipLimitChange([...currentRelPath, nestedRelId], limit)
              }}
              onRelationshipAttributeChange={(nestedRelPath, attrKey, changes) => {
                const fullPath = [...currentRelPath, ...nestedRelPath]
                console.log(
                  `[v0] Child onRelationshipAttributeChange: fullPath=[${fullPath.join(",")}], attr=${attrKey}`,
                )
                onRelationshipAttributeChange(fullPath, attrKey, changes)
              }}
              onNestedRelationshipToggle={(nestedRelPath, enabled) => {
                const fullPath = [...currentRelPath, ...nestedRelPath]
                console.log(
                  `[v0] Child onNestedRelationshipToggle: fullPath=[${fullPath.join(",")}], enabled=${enabled}`,
                )
                onNestedRelationshipToggle(fullPath, enabled)
              }}
              onNestedRelationshipLimitChange={(nestedRelPath, limit) => {
                onNestedRelationshipLimitChange([...currentRelPath, ...nestedRelPath], limit)
              }}
              onRepeatAttributes={(nestedRelPath, sourceAttrs) => {
                if (onRepeatAttributes) {
                  onRepeatAttributes([...currentRelPath, ...nestedRelPath], sourceAttrs)
                }
              }}
              loadingRelationships={loadingRelationships}
              depth={depth + 1}
              relationshipPath={rel.relationshipName}
              idPrefix={`${idPrefix}${rel.id}-`}
              parentRelPath={[]}
              ancestorTypes={currentAncestorTypes}
              collapseSignal={collapseSignal}
            />
          </div>
        )
      })}
    </div>
  )
}
