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
    console.log("[v0] TokenRefresh - Starting token refresh...")

    const requestUrl = "/api/token/refresh"
    const requestBody = JSON.stringify({})
    console.log("[v0] TokenRefresh - Request URL:", requestUrl)
    console.log("[v0] TokenRefresh - Request Method: POST")
    console.log("[v0] TokenRefresh - Request Body:", requestBody)

    try {
      const response = await fetch(requestUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: requestBody,
      })

      console.log("[v0] TokenRefresh - Response Status:", response.status)
      console.log("[v0] TokenRefresh - Response OK:", response.ok)
      console.log("[v0] TokenRefresh - Response Headers:", Object.fromEntries(response.headers.entries()))

      const responseText = await response.text()
      console.log("[v0] TokenRefresh - Response Body (raw):", responseText)

      if (response.ok) {
        try {
          const data = JSON.parse(responseText)
          console.log("[v0] TokenRefresh - Response Body (parsed):", data)
          console.log(
            "[v0] TokenRefresh - Token refreshed successfully, new expiry:",
            data.expires_at ? new Date(data.expires_at).toISOString() : "unknown",
          )
          return true
        } catch (parseError) {
          console.error("[v0] TokenRefresh - Failed to parse response JSON:", parseError)
          return false
        }
      } else {
        console.error("[v0] TokenRefresh - Failed to refresh token:", response.status, responseText)
        return false
      }
    } catch (error) {
      console.error("[v0] TokenRefresh - Network error:", error)
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
