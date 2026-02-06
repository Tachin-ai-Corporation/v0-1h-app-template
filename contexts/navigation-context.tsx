"use client"

import type React from "react"
import { createContext, useContext, useEffect, useState, useCallback, useRef } from "react"

type NavigationState = {
  view: string
  modal?: string | null
}

type NavigationContextType = {
  currentView: string
  setCurrentView: (view: string) => void
  showAuthExitDialog: boolean
  setShowAuthExitDialog: (show: boolean) => void
  confirmAuthExit: () => void
  cancelAuthExit: () => void
  pushModalState: (modalId: string) => void
  popModalState: () => void
}

const NavigationContext = createContext<NavigationContextType | null>(null)

export function NavigationProvider({ children }: { children: React.ReactNode }) {
  const [currentView, setCurrentViewState] = useState("home")
  const [showAuthExitDialog, setShowAuthExitDialog] = useState(false)
  const isInitialized = useRef(false)
  const isNavigatingRef = useRef(false)
  const modalStackRef = useRef<string[]>([])

  const buildUrl = useCallback((view: string) => {
    const params = new URLSearchParams()
    if (view && view !== "home") {
      params.set("view", view)
    }
    const queryString = params.toString()
    return queryString ? `/?${queryString}` : "/"
  }, [])

  const parseUrl = useCallback(() => {
    const searchParams = new URLSearchParams(window.location.search)
    const view = searchParams.get("view") || "home"
    return { view }
  }, [])

  // Initialize state from current URL on mount
  useEffect(() => {
    if (isInitialized.current) return
    isInitialized.current = true

    const { view } = parseUrl()
    setCurrentViewState(view)

    // Replace current history state with our navigation state
    const initialState: NavigationState = { view }
    window.history.replaceState(initialState, "", window.location.href)
  }, [parseUrl])

  // Handle browser back/forward buttons
  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      const state = event.state as NavigationState | null

      // Check if we're going back to /auth
      if (window.location.pathname === "/auth") {
        event.preventDefault()
        setShowAuthExitDialog(true)
        // Re-push current state to prevent actual navigation
        const currentState: NavigationState = { view: currentView }
        window.history.pushState(currentState, "", buildUrl(currentView))
        return
      }

      // Handle modal close on back
      if (modalStackRef.current.length > 0) {
        modalStackRef.current.pop()
        window.dispatchEvent(new CustomEvent("navigation:modal-close"))
        return
      }

      if (!state) {
        const { view } = parseUrl()
        isNavigatingRef.current = true
        setCurrentViewState(view)
        isNavigatingRef.current = false

        const reconstructedState: NavigationState = { view }
        window.history.replaceState(reconstructedState, "", window.location.href)
        return
      }

      isNavigatingRef.current = true
      if (state.view) {
        setCurrentViewState(state.view)
      }
      isNavigatingRef.current = false
    }

    window.addEventListener("popstate", handlePopState)
    return () => window.removeEventListener("popstate", handlePopState)
  }, [currentView, buildUrl, parseUrl])

  // Change view with history push
  const setCurrentView = useCallback(
    (view: string) => {
      if (isNavigatingRef.current) return
      setCurrentViewState(view)
      const state: NavigationState = { view }
      const url = buildUrl(view)
      window.history.pushState(state, "", url)
    },
    [buildUrl],
  )

  // Confirm exit to 1health
  const confirmAuthExit = useCallback(() => {
    const oneHealthUrl = process.env.NEXT_PUBLIC_1H_URL || ""
    window.location.href = oneHealthUrl + "/applications"
  }, [])

  // Cancel exit dialog
  const cancelAuthExit = useCallback(() => {
    setShowAuthExitDialog(false)
  }, [])

  // Push modal state for back button handling
  const pushModalState = useCallback(
    (modalId: string) => {
      modalStackRef.current.push(modalId)
      const state: NavigationState = {
        view: currentView,
        modal: modalId,
      }
      window.history.pushState(state, "", window.location.href)
    },
    [currentView],
  )

  // Pop modal state
  const popModalState = useCallback(() => {
    if (modalStackRef.current.length > 0) {
      modalStackRef.current.pop()
    }
  }, [])

  return (
    <NavigationContext.Provider
      value={{
        currentView,
        setCurrentView,
        showAuthExitDialog,
        setShowAuthExitDialog,
        confirmAuthExit,
        cancelAuthExit,
        pushModalState,
        popModalState,
      }}
    >
      {children}
    </NavigationContext.Provider>
  )
}

export function useNavigation() {
  const context = useContext(NavigationContext)
  if (!context) {
    throw new Error("useNavigation must be used within a NavigationProvider")
  }
  return context
}
