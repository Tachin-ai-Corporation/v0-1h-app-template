"use client"

import type React from "react"
import { createContext, useContext, useEffect, useState, useCallback, useRef } from "react"

type NavigationState = {
  view: string
  patient?: string | null
  modal?: string | null
}

type NavigationContextType = {
  currentView: string
  setCurrentView: (view: string) => void
  patientId: string | null
  openPatient: (id: string) => void
  closePatient: () => void
  showAuthExitDialog: boolean
  setShowAuthExitDialog: (show: boolean) => void
  confirmAuthExit: () => void
  cancelAuthExit: () => void
  pushModalState: (modalId: string) => void
  popModalState: () => void
}

const NavigationContext = createContext<NavigationContextType | null>(null)

// Map internal view keys to URL paths
// const viewToPath: Record<string, string> = {
//   dashboard: "/dashboard",
//   admissions: "/admissions-grid",
//   discharges: "/discharge-grid",
//   "medication-reconciliation": "/medication-reconciliation",
// }

// Map URL paths back to internal view keys
// const pathToView: Record<string, string> = {
//   "/dashboard": "dashboard",
//   "/admissions-grid": "admissions",
//   "/discharge-grid": "discharges",
//   "/medication-reconciliation": "medication-reconciliation",
//   "/": "dashboard",
// }

export function NavigationProvider({ children }: { children: React.ReactNode }) {
  const [currentView, setCurrentViewState] = useState("home")
  const [patientId, setPatientId] = useState<string | null>(null)
  const [showAuthExitDialog, setShowAuthExitDialog] = useState(false)
  const isInitialized = useRef(false)
  const isNavigatingRef = useRef(false)
  const modalStackRef = useRef<string[]>([])

  const buildUrl = useCallback((view: string, patient?: string | null) => {
    const params = new URLSearchParams()
    if (view && view !== "home") {
      params.set("view", view)
    }
    if (patient) {
      params.set("patient", patient)
    }
    const queryString = params.toString()
    return queryString ? `/?${queryString}` : "/"
  }, [])

  const parseUrl = useCallback(() => {
    const searchParams = new URLSearchParams(window.location.search)
    const view = searchParams.get("view") || "home"
    const patient = searchParams.get("patient") || null
    return { view, patient }
  }, [])

  // Initialize state from current URL on mount
  useEffect(() => {
    if (isInitialized.current) return
    isInitialized.current = true

    const { view, patient } = parseUrl()

    console.log("[v0] Navigation init - view:", view, "patient:", patient)
    setCurrentViewState(view)

    if (patient) {
      setPatientId(patient)
    }

    // Replace current history state with our navigation state
    const initialState: NavigationState = {
      view,
      patient,
    }
    window.history.replaceState(initialState, "", window.location.href)
  }, [parseUrl])

  // Handle browser back/forward buttons
  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      const state = event.state as NavigationState | null

      console.log("[v0] PopState fired - state:", JSON.stringify(state))

      // Check if we're going back to /auth
      if (window.location.pathname === "/auth") {
        console.log("[v0] PopState - detected /auth, showing exit dialog")
        event.preventDefault()
        setShowAuthExitDialog(true)
        // Re-push current state to prevent actual navigation
        const currentState: NavigationState = {
          view: currentView,
          patient: patientId,
        }
        window.history.pushState(currentState, "", buildUrl(currentView, patientId))
        return
      }

      // Handle modal close on back
      if (modalStackRef.current.length > 0) {
        console.log("[v0] PopState - closing modal from stack")
        modalStackRef.current.pop()
        window.dispatchEvent(new CustomEvent("navigation:modal-close"))
        return
      }

      if (!state) {
        const { view, patient } = parseUrl()

        console.log("[v0] PopState - no state, reconstructing - view:", view, "patient:", patient)

        isNavigatingRef.current = true
        setCurrentViewState(view)
        setPatientId(patient)
        isNavigatingRef.current = false

        const reconstructedState: NavigationState = {
          view,
          patient,
        }
        window.history.replaceState(reconstructedState, "", window.location.href)
        return
      }

      isNavigatingRef.current = true

      console.log("[v0] PopState - applying state.view:", state.view, "state.patient:", state.patient)

      if (state.view) {
        setCurrentViewState(state.view)
      }

      if (state.patient) {
        setPatientId(state.patient)
      } else {
        setPatientId(null)
      }

      isNavigatingRef.current = false
    }

    window.addEventListener("popstate", handlePopState)
    return () => window.removeEventListener("popstate", handlePopState)
  }, [currentView, patientId, buildUrl, parseUrl])

  // Change view with history push
  const setCurrentView = useCallback(
    (view: string) => {
      if (isNavigatingRef.current) return

      console.log("[v0] setCurrentView called - new view:", view)

      setCurrentViewState(view)
      setPatientId(null)

      const state: NavigationState = { view, patient: null }
      const url = buildUrl(view, null)
      console.log("[v0] setCurrentView - pushing state:", JSON.stringify(state), "url:", url)
      window.history.pushState(state, "", url)
    },
    [buildUrl],
  )

  // Open patient overlay with history push
  const openPatient = useCallback(
    (id: string) => {
      if (isNavigatingRef.current) return

      setPatientId(id)

      const state: NavigationState = { view: currentView, patient: id }
      const url = buildUrl(currentView, id)
      window.history.pushState(state, "", url)
    },
    [currentView, buildUrl],
  )

  // Close patient overlay (via UI, not back button)
  const closePatient = useCallback(() => {
    if (isNavigatingRef.current) return

    setPatientId(null)

    const state: NavigationState = { view: currentView, patient: null }
    const url = buildUrl(currentView, null)
    window.history.pushState(state, "", url)
  }, [currentView, buildUrl])

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
        patient: patientId,
        modal: modalId,
      }
      window.history.pushState(state, "", window.location.href)
    },
    [currentView, patientId],
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
        patientId,
        openPatient,
        closePatient,
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
