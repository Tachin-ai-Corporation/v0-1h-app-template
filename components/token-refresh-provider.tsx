"use client"

import { createContext, useContext, useEffect, useRef, useCallback, type ReactNode } from "react"

interface TokenRefreshContextValue {
  refreshToken: () => Promise<boolean>
}

const TokenRefreshContext = createContext<TokenRefreshContextValue | null>(null)

/**
 * Gets the token expiry timestamp from cookies
 */
function getTokenExpiresAt(): number | null {
  if (typeof document === "undefined") return null

  const match = document.cookie.match(/(?:^|; )token_expires_at=([^;]*)/)
  if (!match) return null

  const expiresAt = Number.parseInt(match[1], 10)
  return isNaN(expiresAt) ? null : expiresAt
}

/**
 * Checks if the access token cookie exists
 */
function hasAccessToken(): boolean {
  if (typeof document === "undefined") return false
  return document.cookie.includes("access_token=")
}

/**
 * Provider that handles proactive token refresh before expiration.
 * Checks every minute if the token is about to expire (within 5 minutes)
 * and refreshes it proactively to prevent session interruption.
 */
export function TokenRefreshProvider({ children }: { children: ReactNode }) {
  const refreshInProgress = useRef(false)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  const refreshToken = useCallback(async (): Promise<boolean> => {
    if (refreshInProgress.current) {
      console.log("[v0] TokenRefresh - Refresh already in progress, skipping")
      return false
    }

    refreshInProgress.current = true

    console.log("=".repeat(60))
    console.log("[v0] AUTH DEBUG - Token Refresh Started")
    console.log("=".repeat(60))

    const requestUrl = "/api/token/refresh"
    console.log("[v0] AUTH DEBUG - Internal API Request:")
    console.log("  URL:", requestUrl)
    console.log("  Method: POST")
    console.log("  Body: {}")

    try {
      const response = await fetch(requestUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      })

      console.log("[v0] AUTH DEBUG - Internal API Response:")
      console.log("  Status:", response.status)

      const responseText = await response.text()
      let responseData: any = null

      try {
        responseData = JSON.parse(responseText)
      } catch (e) {
        console.log("  Body (raw text):", responseText)
      }

      if (responseData) {
        console.log("  Body (parsed):", responseData)

        // Log the 1health request/response details if present
        if (responseData.debug) {
          console.log("-".repeat(60))
          console.log("[v0] AUTH DEBUG - 1health OAuth Details:")
          console.log("  Step:", responseData.debug.step)
          console.log("  Base URL:", responseData.debug.baseUrl)
          console.log("  Token URL:", responseData.debug.tokenUrl)
          console.log("  Request Body:", responseData.debug.requestBody)
          console.log("  Response Status:", responseData.debug.responseStatus)
          console.log("  Response Body:", responseData.debug.responseBody)
          if (responseData.debug.error) {
            console.log("  Error:", responseData.debug.error)
          }
          console.log("-".repeat(60))
        }
      }

      console.log("=".repeat(60))

      if (response.ok && responseData?.success) {
        console.log("[v0] AUTH DEBUG - Token refresh SUCCESS")
        return true
      } else {
        console.error("[v0] AUTH DEBUG - Token refresh FAILED")
        return false
      }
    } catch (error) {
      console.error("[v0] AUTH DEBUG - Network error:", error)
      console.log("=".repeat(60))
      return false
    } finally {
      refreshInProgress.current = false
    }
  }, [])

  const checkAndRefresh = useCallback(async () => {
    // Skip if no access token (user not logged in)
    if (!hasAccessToken()) {
      return
    }

    const expiresAt = getTokenExpiresAt()
    if (!expiresAt) {
      console.log("[v0] TokenRefresh - No expiry timestamp found, skipping check")
      return
    }

    const now = Date.now()
    const timeUntilExpiry = expiresAt - now
    const fiveMinutes = 5 * 60 * 1000

    console.log(
      "[v0] TokenRefresh - Check: expiresAt=",
      new Date(expiresAt).toISOString(),
      "timeUntilExpiry=",
      Math.round(timeUntilExpiry / 1000),
      "seconds",
    )

    // If token expires within 5 minutes, refresh proactively
    if (timeUntilExpiry < fiveMinutes && timeUntilExpiry > 0) {
      console.log("[v0] TokenRefresh - Token expires soon, refreshing proactively")
      await refreshToken()
    } else if (timeUntilExpiry <= 0) {
      // Token already expired, try to refresh
      console.log("[v0] TokenRefresh - Token expired, attempting refresh")
      await refreshToken()
    }
  }, [refreshToken])

  useEffect(() => {
    // Initial check on mount
    checkAndRefresh()

    // Check every minute
    intervalRef.current = setInterval(checkAndRefresh, 60 * 1000)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [checkAndRefresh])

  // Also refresh when tab becomes visible (user returns after being away)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        console.log("[v0] TokenRefresh - Tab became visible, checking token")
        checkAndRefresh()
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange)
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange)
  }, [checkAndRefresh])

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
