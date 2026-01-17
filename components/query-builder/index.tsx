"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Database, ChevronsDownUp } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
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
  findRelationshipByPath,
  findRelationshipById,
  updateRelationshipAtPath,
  updateRelationshipAttribute,
  deleteRelationshipAtPath,
  copyAttributeSettings,
  copyRelationshipSettings,
} from "@/lib/utils/relationship-tree"
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

  const queryPath = `${currentTypeKey}.${rel.relKey}.${targetTypeKey}`

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

      const allRelationships: RelationshipSelection[] = typeData.relationships.map((rel) =>
        mapRelationshipToSelection(rel, typeKey),
      )

      setState({
        ...createInitialQueryBuilderState(),
        rootType: typeKey,
        rootTypeLabel: typeData.name,
        attributes,
        relationships: allRelationships,
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
    setState((prev) => ({
      ...prev,
      attributes: prev.attributes.map((attr) => (attr.key === attrKey ? { ...attr, ...changes } : attr)),
    }))
  }, [])

  const handleRelationshipAttributeChange = useCallback(
    (relPath: string[], attrKey: string, changes: Partial<AttributeSelection>) => {
      setState((prev) => ({
        ...prev,
        relationships: updateRelationshipAttribute(prev.relationships, relPath, attrKey, changes),
      }))
    },
    [],
  )

  const handleRelationshipToggle = useCallback(async (relPath: string[], enabled: boolean) => {
    const relId = relPath[relPath.length - 1]

    const getRelationshipFromCurrentState = (): Promise<RelationshipSelection | null> => {
      return new Promise((resolve) => {
        setState((currentState) => {
          const rel = findRelationshipByPath(currentState.relationships, relPath)
          resolve(rel)
          return currentState
        })
      })
    }

    const relationship = await getRelationshipFromCurrentState()

    if (!relationship) return

    if (enabled && relationship.attributes.length === 0) {
      setLoadingRelationships((prev) => new Set(prev).add(relId))

      const targetType = relationship.targetType
      const result = await fetchTypeDetails(targetType)

      if (result.success && result.data) {
        const baselineAttrs = getBaselineAttributeSelections()
        const typeAttrs: AttributeSelection[] = result.data.attributes.map(mapAttributeToSelection)
        const attributes: AttributeSelection[] = [...baselineAttrs, ...typeAttrs]

        const nestedRelationships: RelationshipSelection[] = result.data.relationships.map((rel) =>
          mapRelationshipToSelection(rel, targetType),
        )

        setState((prev) => ({
          ...prev,
          relationships: updateRelationshipAtPath(prev.relationships, relPath, {
            enabled: true,
            attributes,
            nestedRelationships,
          }),
        }))
      } else {
        setState((prev) => ({
          ...prev,
          relationships: updateRelationshipAtPath(prev.relationships, relPath, { enabled }),
        }))
      }

      setLoadingRelationships((prev) => {
        const next = new Set(prev)
        next.delete(relId)
        return next
      })
    } else {
      setState((prev) => ({
        ...prev,
        relationships: updateRelationshipAtPath(prev.relationships, relPath, { enabled }),
      }))
    }
  }, [])

  const handleRelationshipLimitChange = useCallback((relPath: string[], limit: number) => {
    setState((prev) => ({
      ...prev,
      relationships: updateRelationshipAtPath(prev.relationships, relPath, { limit }),
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
    setState((prev) => {
      const rel = findRelationshipByPath(prev.relationships, relPath)
      if (!rel) return prev
      
      const updatedAttributes = copyAttributeSettings(rel.attributes, sourceAttributes)
      return {
        ...prev,
        relationships: updateRelationshipAtPath(prev.relationships, relPath, { attributes: updatedAttributes }),
      }
    })
  }, [])

  const handleRepeatPattern = useCallback(
    async (
      recursiveRelId: string,
      sourceAttributes: AttributeSelection[],
      sourceRelationships: RelationshipSelection[],
    ) => {
      const found = findRelationshipById(state.relationships, recursiveRelId)
      if (!found) return

      const { rel: recursiveRel, path: relPath } = found

      if (!recursiveRel.enabled) {
        await handleRelationshipToggle(relPath, true)
      }

      await new Promise((resolve) => setTimeout(resolve, 100))

      setState((prev) => {
        const rel = findRelationshipByPath(prev.relationships, relPath)
        if (!rel) return prev

        const updatedAttributes = copyAttributeSettings(rel.attributes, sourceAttributes)
        const updatedNestedRels = copyRelationshipSettings(rel.nestedRelationships, sourceRelationships)

        return {
          ...prev,
          relationships: updateRelationshipAtPath(prev.relationships, relPath, {
            attributes: updatedAttributes,
            nestedRelationships: updatedNestedRels,
          }),
        }
      })

      const enabledSourceRels = sourceRelationships.filter((r) => r.enabled && r.targetType !== recursiveRel.targetType)

      for (const srcRel of enabledSourceRels) {
        setState((prev) => {
          const rel = findRelationshipByPath(prev.relationships, relPath)
          const match = rel?.nestedRelationships.find((nr) => nr.relationshipName === srcRel.relationshipName)

          if (match) {
            setTimeout(() => {
              handleRelationshipToggle([...relPath, match.id], true)
            }, 50)
          }

          return prev
        })
      }
    },
    [state.relationships, handleRelationshipToggle],
  )

  const handleDeleteRelationship = useCallback((relPath: string[]) => {
    setState((prev) => ({
      ...prev,
      relationships: deleteRelationshipAtPath(prev.relationships, relPath),
    }))
  }, [])

  const handleCollapseAll = useCallback(() => {
    setCollapseKey((prev) => prev + 1)
  }, [])

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                Select Root Type
              </CardTitle>
              <CardDescription>Choose a type to query and configure attributes and relationships</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <ImportQueryDialog onImport={handleImportQuery} />
              <Button variant="outline" size="sm" onClick={handleCollapseAll} title="Collapse all sections">
                <ChevronsDownUp className="h-4 w-4 mr-2" />
                Collapse All
              </Button>
              {state.rootType && (
                <Button variant="outline" size="sm" onClick={() => setTestPanelOpen(true)}>
                  View Query
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <TypeSelector
            types={types}
            selectedType={state.rootType}
            onTypeChange={handleTypeChange}
            isLoading={typesLoading || typeLoading}
          />
        </CardContent>
      </Card>

      {state.rootType && (
        <TypeBlock
          typeName={state.rootType}
          typeLabel={state.rootTypeLabel || state.rootType}
          attributes={state.attributes}
          relationships={state.relationships}
          onAttributeChange={handleAttributeChange}
          onRelationshipToggle={(relId, enabled) => handleRelationshipToggle([relId], enabled)}
          onRelationshipLimitChange={(relId, limit) => handleRelationshipLimitChange([relId], limit)}
          onRelationshipAttributeChange={handleRelationshipAttributeChange}
          onNestedRelationshipToggle={handleRelationshipToggle}
          onNestedRelationshipLimitChange={handleRelationshipLimitChange}
          onRepeatAttributes={handleRepeatAttributes}
          onRepeatPattern={handleRepeatPattern}
          loadingRelationships={loadingRelationships}
          idPrefix="root-"
          collapseSignal={collapseKey}
          isRoot={true}
          limit={state.limit}
          offset={state.offset}
          onLimitChange={handleLimitChange}
          onOffsetChange={handleOffsetChange}
        />
      )}



      <TestPanel
        open={testPanelOpen}
        onOpenChange={setTestPanelOpen}
        request={queryRequest}
        onExecute={handleExecute}
        results={results}
        error={queryError}
        isExecuting={isExecuting}
      />
    </div>
  )
}
