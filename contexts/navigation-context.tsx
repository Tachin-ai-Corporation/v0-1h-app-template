"use client"

import type React from "react"
import { createContext, useContext, useState, useCallback } from "react"

type NavigationContextType = {
  showAuthExitDialog: boolean
  setShowAuthExitDialog: (show: boolean) => void
  confirmAuthExit: () => void
  cancelAuthExit: () => void
}

const NavigationContext = createContext<NavigationContextType | null>(null)

export function NavigationProvider({ children }: { children: React.ReactNode }) {
  const [showAuthExitDialog, setShowAuthExitDialog] = useState(false)

  // Confirm exit to 1health -- read URL from cookie (set by auth page per environment)
  const confirmAuthExit = useCallback(() => {
    let oneHealthUrl = ""
    const match = document.cookie.match(/onehealth_base_url=([^;]+)/)
    if (match) {
      oneHealthUrl = decodeURIComponent(match[1])
    }
    window.location.href = oneHealthUrl ? `${oneHealthUrl}/applications` : "/auth"
  }, [])

  // Cancel exit dialog
  const cancelAuthExit = useCallback(() => {
    setShowAuthExitDialog(false)
  }, [])

  return (
    <NavigationContext.Provider
      value={{
        showAuthExitDialog,
        setShowAuthExitDialog,
        confirmAuthExit,
        cancelAuthExit,
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
