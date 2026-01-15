"use client"

import { createContext, useContext, useRef, useCallback, type ReactNode } from "react"

interface TokenRefreshContextValue {
  refreshToken: () => Promise<boolean>
}

const TokenRefreshContext = createContext<TokenRefreshContextValue | null>(null)

/**
 * Checks if the access token cookie exists
 */
function hasAccessToken(): boolean {
  if (typeof document === "undefined") return false
  return document.cookie.includes("access_token=")
}

/**
 * Provider that exposes the token refresh function.
 * Removed automatic refresh interval - only manual refresh via button or on 401 response
 */
export function TokenRefreshProvider({ children }: { children: ReactNode }) {
  const refreshInProgress = useRef(false)

  const refreshToken = useCallback(async (): Promise<boolean> => {
    if (refreshInProgress.current) {
      return false
    }

    refreshInProgress.current = true

    console.log("[TokenRefresh] Calling /api/token/refresh")

    try {
      const response = await fetch("/api/token/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      })

      const responseData = await response.json().catch(() => null)

      if (response.ok && responseData?.success) {
        console.log("[TokenRefresh] Success")
        return true
      } else {
        console.log("[TokenRefresh] Failed:", response.status)
        return false
      }
    } catch (error) {
      console.error("[TokenRefresh] Network error:", error)
      return false
    } finally {
      refreshInProgress.current = false
    }
  }, [])

  return <TokenRefreshContext.Provider value={{ refreshToken }}>{children}</TokenRefreshContext.Provider>
}

/**
 * Hook to access the token refresh function
 */
export function useTokenRefresh() {
  const context = useContext(TokenRefreshContext)
  if (!context) {
    throw new Error("useTokenRefresh must be used within a TokenRefreshProvider")
  }
  return context
}
