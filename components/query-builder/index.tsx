"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Play, Database, ChevronsDownUp } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { TypeSelector } from "./type-selector"
import { TypeBlock } from "./type-block"
import { TestPanel } from "./test-panel"
import { ImportQueryDialog } from "./import-query-dialog"
import { fetchAllTypes, fetchTypeDetails, type TypeAttribute, type TypeRelationship } from "@/lib/api/type-metadata"
import { executeQuery } from "@/lib/api/query"
import { buildQueryRequest } from "@/lib/utils/query-generator"
import { parseQueryPayload, extractJsonFromInput } from "@/lib/utils/query-parser"
import {
  createInitialQueryBuilderState,
  createAttributeSelection,
  getBaselineAttributeSelections,
  type QueryBuilderState,
  type AttributeSelection,
  type RelationshipSelection,
} from "@/lib/types/query-builder"

interface TypeInfo {
  boKey: string
  name: string
}

function mapAttributeToSelection(attr: TypeAttribute): AttributeSelection {
  const valueOptions = attr.attributeValues?.map((v) => v.name) || undefined
  return createAttributeSelection(attr.attrKey, attr.name, attr.type, valueOptions)
}

function mapRelationshipToSelection(rel: TypeRelationship, currentType: string): RelationshipSelection {
  const isForward = rel.direction === "FORWARD"
  const targetTypeRaw = isForward ? rel.toBoClassName : rel.fromBoClassName
  const targetTypeKey = targetTypeRaw.replace(/\s+/g, "")
  const currentTypeKey = currentType.replace(/\s+/g, "")

  const queryPath = isForward
    ? `${currentTypeKey}.${rel.relKey}.${targetTypeKey}`
    : `${targetTypeKey}.${rel.relKey}.${currentTypeKey}`

  return {
    id: crypto.randomUUID(),
    relationshipKey: queryPath,
    relationshipName: rel.name,
    targetType: targetTypeKey,
    targetTypeLabel: targetTypeRaw,
    direction: rel.direction,
    enabled: false,
    limit: 10,
    attributes: [],
    nestedRelationships: [],
  }
}

export function QueryBuilder() {
  const [types, setTypes] = useState<TypeInfo[]>([])
  const [typesLoading, setTypesLoading] = useState(true)
  const [state, setState] = useState<QueryBuilderState>(createInitialQueryBuilderState())
  const [typeLoading, setTypeLoading] = useState(false)
  const [loadingRelationships, setLoadingRelationships] = useState<Set<string>>(new Set())
  const [testPanelOpen, setTestPanelOpen] = useState(false)
  const [isExecuting, setIsExecuting] = useState(false)
  const [results, setResults] = useState<any>(null)
  const [queryError, setQueryError] = useState<string | null>(null)
  const [collapseKey, setCollapseKey] = useState(0)

  useEffect(() => {
    async function loadTypes() {
      setTypesLoading(true)
      const result = await fetchAllTypes()
      if (result.success && result.data) {
        setTypes(result.data)
      }
      setTypesLoading(false)
    }
    loadTypes()
  }, [])

  const handleTypeChange = useCallback(async (typeKey: string) => {
    setTypeLoading(true)
    setResults(null)
    setQueryError(null)

    const result = await fetchTypeDetails(typeKey)

    if (result.success && result.data) {
      const typeData = result.data

      const baselineAttrs = getBaselineAttributeSelections()
      const typeAttrs: AttributeSelection[] = typeData.attributes.map(mapAttributeToSelection)
      const attributes: AttributeSelection[] = [...baselineAttrs, ...typeAttrs]

      const forwardRelationships: RelationshipSelection[] = typeData.relationships
        .filter((rel) => rel.direction === "FORWARD")
        .map((rel) => mapRelationshipToSelection(rel, typeKey))

      const backwardRelationships: RelationshipSelection[] = typeData.relationships
        .filter((rel) => rel.direction === "BACKWARDS")
        .map((rel) => mapRelationshipToSelection(rel, typeKey))

      setState({
        ...createInitialQueryBuilderState(),
        rootType: typeKey,
        rootTypeLabel: typeData.name,
        attributes,
        relationships: forwardRelationships,
        backwardRelationships: backwardRelationships,
      })
    } else {
      setState({
        ...createInitialQueryBuilderState(),
        error: result.error || "Failed to load type details",
      })
    }

    setTypeLoading(false)
  }, [])

  const handleImportQuery = useCallback(async (input: string) => {
    const payload = extractJsonFromInput(input)
    if (!payload) {
      throw new Error("Could not parse input. Please provide valid JSON or a cURL command.")
    }

    setTypeLoading(true)
    setResults(null)
    setQueryError(null)

    const result = await parseQueryPayload(payload)

    if (result.success && result.state) {
      setState(result.state)
    } else {
      throw new Error(result.error || "Failed to import query")
    }

    setTypeLoading(false)
  }, [])

  const stateRef = useRef(state)
  useEffect(() => {
    stateRef.current = state
  }, [state])

  const handleAttributeChange = useCallback((attrKey: string, changes: Partial<AttributeSelection>) => {
    console.log(`[v0] handleAttributeChange called: ${attrKey}`, changes)
    setState((prev) => {
      const newAttrs = prev.attributes.map((attr) => {
        if (attr.key === attrKey) {
          console.log(`[v0] Updating attr ${attrKey}:`, { ...attr, ...changes })
          return { ...attr, ...changes }
        }
        return attr
      })
      return { ...prev, attributes: newAttrs }
    })
  }, [])

  const updateNestedRelationshipAttribute = useCallback(
    (
      relationships: RelationshipSelection[],
      path: string[],
      attrKey: string,
      changes: Partial<AttributeSelection>,
    ): RelationshipSelection[] => {
      if (path.length === 0) return relationships

      const [currentRelId, ...restPath] = path

      return relationships.map((rel) => {
        if (rel.id !== currentRelId) return rel

        if (restPath.length === 0) {
          return {
            ...rel,
            attributes: rel.attributes.map((attr) => (attr.key === attrKey ? { ...attr, ...changes } : attr)),
          }
        } else {
          return {
            ...rel,
            nestedRelationships: updateNestedRelationshipAttribute(rel.nestedRelationships, restPath, attrKey, changes),
          }
        }
      })
    },
    [],
  )

  const handleRelationshipAttributeChange = useCallback(
    (relPath: string[], attrKey: string, changes: Partial<AttributeSelection>) => {
      console.log(`[v0] handleRelationshipAttributeChange: path=${relPath.join(".")}, attr=${attrKey}`, changes)
      setState((prev) => ({
        ...prev,
        relationships: updateNestedRelationshipAttribute(prev.relationships, relPath, attrKey, changes),
        backwardRelationships: updateNestedRelationshipAttribute(
          prev.backwardRelationships || [],
          relPath,
          attrKey,
          changes,
        ),
      }))
    },
    [updateNestedRelationshipAttribute],
  )

  const handleRelationshipToggle = useCallback(async (relPath: string[], enabled: boolean) => {
    const relId = relPath[relPath.length - 1]
    console.log(`[v0] handleRelationshipToggle: path=${relPath.join(".")}, enabled=${enabled}`)

    const findRelationship = (relationships: RelationshipSelection[], path: string[]): RelationshipSelection | null => {
      console.log(`[v0] findRelationship: searching path [${path.join(", ")}] in ${relationships.length} rels`)
      if (path.length === 0) return null
      const [currentId, ...rest] = path
      const rel = relationships.find((r) => r.id === currentId)
      if (!rel) {
        console.log(
          `[v0] findRelationship: NOT FOUND id=${currentId}, available: [${relationships.map((r) => `${r.relationshipName}:${r.id}`).join(", ")}]`,
        )
        return null
      }
      console.log(
        `[v0] findRelationship: found ${rel.relationshipName}, attrs=${rel.attributes.length}, nested=${rel.nestedRelationships.length}`,
      )
      if (rest.length === 0) {
        return rel
      }
      return findRelationship(rel.nestedRelationships, rest)
    }

    const updateRelationship = (
      relationships: RelationshipSelection[],
      path: string[],
      update: Partial<RelationshipSelection>,
    ): RelationshipSelection[] => {
      if (path.length === 0) return relationships
      const [currentId, ...rest] = path

      return relationships.map((rel) => {
        if (rel.id !== currentId) return rel
        if (rest.length === 0) {
          console.log(`[v0] updateRelationship: updating ${rel.relationshipName}`, Object.keys(update))
          return { ...rel, ...update }
        }
        return {
          ...rel,
          nestedRelationships: updateRelationship(rel.nestedRelationships, rest, update),
        }
      })
    }

    const getRelationshipFromCurrentState = (): Promise<{
      relationship: RelationshipSelection | null
      isBackward: boolean
    }> => {
      return new Promise((resolve) => {
        setState((currentState) => {
          let rel = findRelationship(currentState.relationships, relPath)
          if (rel) {
            resolve({ relationship: rel, isBackward: false })
            return currentState
          }
          rel = findRelationship(currentState.backwardRelationships || [], relPath)
          resolve({ relationship: rel, isBackward: true })
          return currentState
        })
      })
    }

    const { relationship, isBackward } = await getRelationshipFromCurrentState()

    if (!relationship) {
      console.log(`[v0] handleRelationshipToggle: relationship not found in path ${relPath.join(".")}`)
      return
    }

    console.log(
      `[v0] handleRelationshipToggle: found relationship ${relationship.relationshipName}, targetType=${relationship.targetType}, currentAttrs=${relationship.attributes.length}, isBackward=${isBackward}`,
    )

    if (enabled && relationship.attributes.length === 0) {
      setLoadingRelationships((prev) => new Set(prev).add(relId))
      console.log(`[v0] handleRelationshipToggle: fetching type details for ${relationship.targetType}`)

      const targetType = relationship.targetType
      const result = await fetchTypeDetails(targetType)
      console.log(`[v0] handleRelationshipToggle: fetchTypeDetails result`, result.success, result.error)

      if (result.success && result.data) {
        const baselineAttrs = getBaselineAttributeSelections()
        const typeAttrs: AttributeSelection[] = result.data.attributes.map(mapAttributeToSelection)
        const attributes: AttributeSelection[] = [...baselineAttrs, ...typeAttrs]

        const forwardNestedRels: RelationshipSelection[] = result.data.relationships
          .filter((rel) => rel.direction === "FORWARD")
          .map((rel) => mapRelationshipToSelection(rel, targetType))

        const backwardNestedRels: RelationshipSelection[] = result.data.relationships
          .filter((rel) => rel.direction === "BACKWARDS")
          .map((rel) => mapRelationshipToSelection(rel, targetType))

        const nestedRelationships: RelationshipSelection[] = [...forwardNestedRels, ...backwardNestedRels]

        console.log(
          `[v0] handleRelationshipToggle: loaded ${attributes.length} attrs, ${nestedRelationships.length} rels (${forwardNestedRels.length} forward, ${backwardNestedRels.length} backward) for ${relationship.relationshipName}`,
        )

        setState((prev) => ({
          ...prev,
          relationships: isBackward
            ? prev.relationships
            : updateRelationship(prev.relationships, relPath, {
                enabled: true,
                attributes,
                nestedRelationships,
              }),
          backwardRelationships: isBackward
            ? updateRelationship(prev.backwardRelationships || [], relPath, {
                enabled: true,
                attributes,
                nestedRelationships,
              })
            : prev.backwardRelationships || [],
        }))
      } else {
        console.log(`[v0] handleRelationshipToggle: fetchTypeDetails failed, only setting enabled`)
        setState((prev) => ({
          ...prev,
          relationships: isBackward ? prev.relationships : updateRelationship(prev.relationships, relPath, { enabled }),
          backwardRelationships: isBackward
            ? updateRelationship(prev.backwardRelationships || [], relPath, { enabled })
            : prev.backwardRelationships || [],
        }))
      }

      setLoadingRelationships((prev) => {
        const next = new Set(prev)
        next.delete(relId)
        return next
      })
    } else {
      console.log(
        `[v0] handleRelationshipToggle: not fetching (enabled=${enabled}, attrsLen=${relationship.attributes.length})`,
      )
      setState((prev) => ({
        ...prev,
        relationships: isBackward ? prev.relationships : updateRelationship(prev.relationships, relPath, { enabled }),
        backwardRelationships: isBackward
          ? updateRelationship(prev.backwardRelationships || [], relPath, { enabled })
          : prev.backwardRelationships || [],
      }))
    }
  }, [])

  const handleRelationshipLimitChange = useCallback((relPath: string[], limit: number) => {
    const updateRelationshipLimit = (
      relationships: RelationshipSelection[],
      path: string[],
    ): RelationshipSelection[] => {
      if (path.length === 0) return relationships
      const [currentId, ...rest] = path

      return relationships.map((rel) => {
        if (rel.id !== currentId) return rel
        if (rest.length === 0) {
          return { ...rel, limit }
        }
        return {
          ...rel,
          nestedRelationships: updateRelationshipLimit(rel.nestedRelationships, rest),
        }
      })
    }

    setState((prev) => ({
      ...prev,
      relationships: updateRelationshipLimit(prev.relationships, relPath),
      backwardRelationships: updateRelationshipLimit(prev.backwardRelationships || [], relPath),
    }))
  }, [])

  const handleLimitChange = useCallback((limit: number) => {
    setState((prev) => ({ ...prev, limit }))
  }, [])

  const handleOffsetChange = useCallback((offset: number) => {
    setState((prev) => ({ ...prev, offset }))
  }, [])

  const handleExecute = useCallback(async () => {
    const request = buildQueryRequest(state)
    if (!request) return

    setIsExecuting(true)
    setQueryError(null)

    const result = await executeQuery(request as Record<string, unknown>)

    if (result.success) {
      setResults(result.data)
    } else {
      setQueryError(result.error || "Unknown error")
      setResults(null)
    }

    setIsExecuting(false)
  }, [state])

  const queryRequest = buildQueryRequest(state)

  const handleRepeatAttributes = useCallback((relPath: string[], sourceAttributes: AttributeSelection[]) => {
    console.log(`[v0] handleRepeatAttributes: path=${relPath.join(".")}, sourceAttrs=${sourceAttributes.length}`)

    const updateRelationshipAttributes = (
      relationships: RelationshipSelection[],
      path: string[],
    ): RelationshipSelection[] => {
      if (path.length === 0) return relationships
      const [currentId, ...rest] = path

      return relationships.map((rel) => {
        if (rel.id !== currentId) return rel

        if (rest.length === 0) {
          const updatedAttributes = rel.attributes.map((attr) => {
            const sourceAttr = sourceAttributes.find((sa) => sa.key === attr.key)
            if (sourceAttr) {
              return {
                ...attr,
                selected: sourceAttr.selected,
                filterEnabled: sourceAttr.filterEnabled,
                filterOperator: sourceAttr.filterOperator,
                filterValue: sourceAttr.filterValue,
              }
            }
            return attr
          })
          console.log(
            `[v0] handleRepeatAttributes: updated ${updatedAttributes.filter((a) => a.selected).length} selected attrs`,
          )
          return { ...rel, attributes: updatedAttributes }
        }

        return {
          ...rel,
          nestedRelationships: updateRelationshipAttributes(rel.nestedRelationships, rest),
        }
      })
    }

    setState((prev) => ({
      ...prev,
      relationships: updateRelationshipAttributes(prev.relationships, relPath),
      backwardRelationships: updateRelationshipAttributes(prev.backwardRelationships || [], relPath),
    }))
  }, [])

  const handleRepeatPattern = useCallback(
    async (
      recursiveRelId: string,
      sourceAttributes: AttributeSelection[],
      sourceForwardRels: RelationshipSelection[],
      sourceBackwardRels: RelationshipSelection[],
    ) => {
      console.log(
        `[v0] handleRepeatPattern: recursiveRelId=${recursiveRelId}, attrs=${sourceAttributes.length}, fwdRels=${sourceForwardRels.length}, bwdRels=${sourceBackwardRels.length}`,
      )

      const findRelationshipById = (
        relationships: RelationshipSelection[],
        id: string,
      ): { rel: RelationshipSelection; path: string[]; isBackward: boolean } | null => {
        for (const rel of relationships) {
          if (rel.id === id) {
            return { rel, path: [id], isBackward: rel.direction === "BACKWARDS" }
          }
          const nested = findRelationshipById(rel.nestedRelationships, id)
          if (nested) {
            return { ...nested, path: [rel.id, ...nested.path] }
          }
        }
        return null
      }

      let found = findRelationshipById(state.relationships, recursiveRelId)
      let searchedBackward = false
      if (!found) {
        found = findRelationshipById(state.backwardRelationships || [], recursiveRelId)
        searchedBackward = true
      }

      if (!found) {
        console.log(`[v0] handleRepeatPattern: relationship ${recursiveRelId} not found`)
        return
      }

      const { rel: recursiveRel, path: relPath } = found
      console.log(`[v0] handleRepeatPattern: found relationship at path [${relPath.join(", ")}]`)

      if (!recursiveRel.enabled) {
        await handleRelationshipToggle(relPath, true)
      }

      const copyAttributeSettings = (
        targetAttrs: AttributeSelection[],
        sourceAttrs: AttributeSelection[],
      ): AttributeSelection[] => {
        return targetAttrs.map((attr) => {
          const sourceAttr = sourceAttrs.find((sa) => sa.key === attr.key)
          if (sourceAttr) {
            return {
              ...attr,
              selected: sourceAttr.selected,
              filterEnabled: sourceAttr.filterEnabled,
              filterOperator: sourceAttr.filterOperator,
              filterValue: sourceAttr.filterValue,
              filterValueEnd: sourceAttr.filterValueEnd,
            }
          }
          return attr
        })
      }

      const copyRelationshipSettings = (
        targetRels: RelationshipSelection[],
        sourceRels: RelationshipSelection[],
      ): RelationshipSelection[] => {
        return targetRels.map((targetRel) => {
          const sourceRel = sourceRels.find(
            (sr) =>
              sr.relationshipKey === targetRel.relationshipKey || sr.relationshipName === targetRel.relationshipName,
          )
          if (sourceRel && sourceRel.enabled) {
            return {
              ...targetRel,
              enabled: true,
              limit: sourceRel.limit,
            }
          }
          return targetRel
        })
      }

      await new Promise((resolve) => setTimeout(resolve, 100))

      setState((prev) => {
        const updateRelationshipInTree = (
          relationships: RelationshipSelection[],
          path: string[],
        ): RelationshipSelection[] => {
          if (path.length === 0) return relationships
          const [currentId, ...rest] = path

          return relationships.map((rel) => {
            if (rel.id !== currentId) return rel

            if (rest.length === 0) {
              const updatedAttrs = copyAttributeSettings(rel.attributes, sourceAttributes)
              const updatedNestedFwd = copyRelationshipSettings(
                rel.nestedRelationships.filter((r) => r.direction === "FORWARD"),
                sourceForwardRels,
              )
              const updatedNestedBwd = copyRelationshipSettings(
                rel.nestedRelationships.filter((r) => r.direction === "BACKWARDS"),
                sourceBackwardRels,
              )

              console.log(
                `[v0] handleRepeatPattern: updating ${rel.relationshipName} with ${updatedAttrs.filter((a) => a.selected).length} selected attrs`,
              )

              return {
                ...rel,
                attributes: updatedAttrs,
                nestedRelationships: [...updatedNestedFwd, ...updatedNestedBwd],
              }
            }

            return {
              ...rel,
              nestedRelationships: updateRelationshipInTree(rel.nestedRelationships, rest),
            }
          })
        }

        return {
          ...prev,
          relationships: searchedBackward ? prev.relationships : updateRelationshipInTree(prev.relationships, relPath),
          backwardRelationships: searchedBackward
            ? updateRelationshipInTree(prev.backwardRelationships || [], relPath)
            : prev.backwardRelationships || [],
        }
      })

      const enabledSourceFwd = sourceForwardRels.filter((r) => r.enabled && r.targetType !== recursiveRel.targetType)
      const enabledSourceBwd = sourceBackwardRels.filter((r) => r.enabled && r.targetType !== recursiveRel.targetType)

      for (const srcRel of [...enabledSourceFwd, ...enabledSourceBwd]) {
        setState((prev) => {
          const findMatchingRelInTarget = (relationships: RelationshipSelection[], path: string[]): string | null => {
            if (path.length === 0) return null
            const [currentId, ...rest] = path

            for (const rel of relationships) {
              if (rel.id !== currentId) continue

              if (rest.length === 0) {
                const match = rel.nestedRelationships.find((nr) => nr.relationshipName === srcRel.relationshipName)
                return match?.id || null
              }

              return findMatchingRelInTarget(rel.nestedRelationships, rest)
            }
            return null
          }

          const matchId = searchedBackward
            ? findMatchingRelInTarget(prev.backwardRelationships || [], relPath)
            : findMatchingRelInTarget(prev.relationships, relPath)

          if (matchId) {
            setTimeout(() => {
              handleRelationshipToggle([...relPath, matchId], true)
            }, 50)
          }

          return prev
        })
      }
    },
    [state.relationships, state.backwardRelationships, handleRelationshipToggle],
  )

  const handleCollapseAll = useCallback(() => {
    setCollapseKey((prev) => prev + 1)
  }, [])

  return (
    <div className="flex flex-col h-full w-full">
      <div className="flex-shrink-0 px-6 py-4 border-b bg-background">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Database className="h-6 w-6 text-primary" />
            <div>
              <h1 className="text-xl font-semibold">Query Builder</h1>
              <p className="text-sm text-muted-foreground">Build and test 1health /query requests</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {state.rootType && (
              <Button variant="outline" size="sm" onClick={handleCollapseAll}>
                <ChevronsDownUp className="h-4 w-4 mr-2" />
                Collapse All
              </Button>
            )}
            <ImportQueryDialog onImport={handleImportQuery} disabled={typesLoading} />
            <Button onClick={() => setTestPanelOpen(true)} disabled={!state.rootType}>
              <Play className="h-4 w-4 mr-2" />
              Test Query
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="space-y-4 w-full">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">1. Select Root Type</CardTitle>
              <CardDescription>Choose the starting type for your query</CardDescription>
            </CardHeader>
            <CardContent>
              <TypeSelector
                types={types}
                selectedType={state.rootType}
                onTypeChange={handleTypeChange}
                isLoading={typesLoading}
                disabled={typeLoading}
              />
            </CardContent>
          </Card>

          {state.rootType && !typeLoading && (
            <TypeBlock
              key={`typeblock-${state.rootType}`}
              typeName={state.rootType}
              typeLabel={state.rootTypeLabel || state.rootType}
              attributes={state.attributes}
              relationships={state.relationships}
              backwardRelationships={state.backwardRelationships || []}
              onAttributeChange={handleAttributeChange}
              onRelationshipToggle={(relId, enabled) => handleRelationshipToggle([relId], enabled)}
              onRelationshipLimitChange={(relId, limit) => handleRelationshipLimitChange([relId], limit)}
              onRelationshipAttributeChange={(relPath, attrKey, changes) =>
                handleRelationshipAttributeChange(relPath, attrKey, changes)
              }
              onNestedRelationshipToggle={(relPath, enabled) => handleRelationshipToggle(relPath, enabled)}
              onNestedRelationshipLimitChange={(relPath, limit) => handleRelationshipLimitChange(relPath, limit)}
              onRepeatAttributes={handleRepeatAttributes}
              onRepeatPattern={handleRepeatPattern}
              loadingRelationships={loadingRelationships}
              depth={0}
              idPrefix="root-"
              ancestorTypes={[]}
              collapseSignal={collapseKey}
            />
          )}

          {typeLoading && (
            <Card>
              <CardContent className="py-8">
                <div className="flex items-center justify-center gap-2 text-muted-foreground">
                  <div className="h-4 w-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  Loading type details...
                </div>
              </CardContent>
            </Card>
          )}

          {state.error && (
            <Card className="border-destructive">
              <CardContent className="py-4">
                <p className="text-destructive text-sm">{state.error}</p>
              </CardContent>
            </Card>
          )}

          {state.rootType && !typeLoading && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Pagination</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-6">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="limit" className="text-sm whitespace-nowrap">
                      Items per page
                    </Label>
                    <Input
                      id="limit"
                      type="number"
                      min={1}
                      max={1000}
                      value={state.limit}
                      onChange={(e) => handleLimitChange(Number.parseInt(e.target.value) || 10)}
                      className="w-24"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Label htmlFor="offset" className="text-sm whitespace-nowrap">
                      Page number
                    </Label>
                    <Input
                      id="offset"
                      type="number"
                      min={0}
                      value={state.offset}
                      onChange={(e) => handleOffsetChange(Number.parseInt(e.target.value) || 0)}
                      className="w-24"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <TestPanel
        open={testPanelOpen}
        onOpenChange={setTestPanelOpen}
        request={queryRequest}
        onExecute={handleExecute}
        isExecuting={isExecuting}
        results={results}
        error={queryError}
      />
    </div>
  )
}
