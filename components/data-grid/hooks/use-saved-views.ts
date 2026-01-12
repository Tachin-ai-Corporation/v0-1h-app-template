"use client"

import { useState, useCallback } from "react"
import type { SavedView, Column } from "../types"

/**
 * Simplified saved views hook for managing grid view configurations.
 *
 * This is a client-side only implementation that stores views in memory.
 * For persistent storage, implement backend actions and replace the
 * saveView/updateView/deleteView functions.
 *
 * @param gridIdentifier - Unique identifier for the grid (e.g., campaignId)
 */
export function useSavedViews(gridIdentifier: string) {
  const [views, setViews] = useState<SavedView[]>([])
  const [currentView, setCurrentView] = useState<SavedView | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const saveView = useCallback(async (name: string, columns: Column[]) => {
    setIsLoading(true)
    try {
      const newView: SavedView = {
        id: `view-${Date.now()}`,
        name,
        columns,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      setViews((prev) => [...prev, newView])
      setCurrentView(newView)
      return { success: true, view: newView }
    } finally {
      setIsLoading(false)
    }
  }, [])

  const updateView = useCallback(
    async (viewId: string, updates: Partial<SavedView>) => {
      setIsLoading(true)
      try {
        setViews((prev) =>
          prev.map((v) => (v.id === viewId ? { ...v, ...updates, updatedAt: new Date().toISOString() } : v)),
        )
        if (currentView?.id === viewId) {
          setCurrentView((prev) => (prev ? { ...prev, ...updates } : null))
        }
        return { success: true }
      } finally {
        setIsLoading(false)
      }
    },
    [currentView],
  )

  const deleteView = useCallback(
    async (viewId: string) => {
      setIsLoading(true)
      try {
        setViews((prev) => prev.filter((v) => v.id !== viewId))
        if (currentView?.id === viewId) {
          setCurrentView(null)
        }
        return { success: true }
      } finally {
        setIsLoading(false)
      }
    },
    [currentView],
  )

  return {
    views,
    currentView,
    setCurrentView,
    isLoading,
    saveView,
    updateView,
    deleteView,
  }
}
