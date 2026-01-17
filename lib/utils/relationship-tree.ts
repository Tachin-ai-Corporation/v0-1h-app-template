"use client"

import type { RelationshipSelection, AttributeSelection } from "@/lib/types/query-builder"

/**
 * Find a relationship by traversing the tree using a path of IDs
 */
export function findRelationshipByPath(
  relationships: RelationshipSelection[],
  path: string[]
): RelationshipSelection | null {
  if (path.length === 0) return null
  const [currentId, ...rest] = path
  const rel = relationships.find((r) => r.id === currentId)
  if (!rel) return null
  if (rest.length === 0) return rel
  return findRelationshipByPath(rel.nestedRelationships, rest)
}

/**
 * Find a relationship by ID anywhere in the tree, returning both the relationship and its path
 */
export function findRelationshipById(
  relationships: RelationshipSelection[],
  id: string
): { rel: RelationshipSelection; path: string[] } | null {
  for (const rel of relationships) {
    if (rel.id === id) {
      return { rel, path: [id] }
    }
    const nested = findRelationshipById(rel.nestedRelationships, id)
    if (nested) {
      return { ...nested, path: [rel.id, ...nested.path] }
    }
  }
  return null
}

/**
 * Update a relationship at the specified path with partial updates
 */
export function updateRelationshipAtPath(
  relationships: RelationshipSelection[],
  path: string[],
  update: Partial<RelationshipSelection>
): RelationshipSelection[] {
  if (path.length === 0) return relationships
  const [currentId, ...rest] = path

  return relationships.map((rel) => {
    if (rel.id !== currentId) return rel
    if (rest.length === 0) {
      return { ...rel, ...update }
    }
    return {
      ...rel,
      nestedRelationships: updateRelationshipAtPath(rel.nestedRelationships, rest, update),
    }
  })
}

/**
 * Update an attribute within a relationship at the specified path
 */
export function updateRelationshipAttribute(
  relationships: RelationshipSelection[],
  path: string[],
  attrKey: string,
  changes: Partial<AttributeSelection>
): RelationshipSelection[] {
  if (path.length === 0) return relationships
  const [currentId, ...rest] = path

  return relationships.map((rel) => {
    if (rel.id !== currentId) return rel

    if (rest.length === 0) {
      return {
        ...rel,
        attributes: rel.attributes.map((attr) =>
          attr.key === attrKey ? { ...attr, ...changes } : attr
        ),
      }
    }
    return {
      ...rel,
      nestedRelationships: updateRelationshipAttribute(rel.nestedRelationships, rest, attrKey, changes),
    }
  })
}

/**
 * Delete (disable and clear) a relationship at the specified path
 */
export function deleteRelationshipAtPath(
  relationships: RelationshipSelection[],
  path: string[]
): RelationshipSelection[] {
  if (path.length === 0) return relationships
  const [currentId, ...rest] = path

  if (rest.length === 0) {
    return relationships.map((rel) => {
      if (rel.id === currentId) {
        return {
          ...rel,
          enabled: false,
          attributes: [],
          nestedRelationships: [],
        }
      }
      return rel
    })
  }

  return relationships.map((rel) => {
    if (rel.id !== currentId) return rel
    return {
      ...rel,
      nestedRelationships: deleteRelationshipAtPath(rel.nestedRelationships, rest),
    }
  })
}

/**
 * Copy attribute settings from source to target attributes (matching by key)
 */
export function copyAttributeSettings(
  targetAttrs: AttributeSelection[],
  sourceAttrs: AttributeSelection[]
): AttributeSelection[] {
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

/**
 * Copy enabled state and limit from source relationships to matching target relationships
 */
export function copyRelationshipSettings(
  targetRels: RelationshipSelection[],
  sourceRels: RelationshipSelection[]
): RelationshipSelection[] {
  return targetRels.map((targetRel) => {
    const sourceRel = sourceRels.find(
      (sr) =>
        sr.relationshipKey === targetRel.relationshipKey ||
        sr.relationshipName === targetRel.relationshipName
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
