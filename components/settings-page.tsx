"use client"

import { useState, useEffect, useCallback } from "react"
import { ArrowLeft, Settings, RefreshCw, Clock, Key, AlertTriangle, CheckCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { refreshToken, getCookie } from "@/lib/auth-client"

interface SettingsPageProps {
  onClose: () => void
}

interface TokenInfo {
  expiresAt: number | null
  isExpired: boolean
  timeRemaining: string
  rawToken: string | null
}

function parseJwt(token: string): { exp?: number } | null {
  try {
    const parts = token.split(".")
    if (parts.length !== 3) return null
    const payload = JSON.parse(atob(parts[1]))
    return payload
  } catch {
    return null
  }
}

function formatTimeRemaining(ms: number): string {
  if (ms <= 0) return "Expired"
  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (days > 0) return `${days}d ${hours % 24}h ${minutes % 60}m`
  else if (hours > 0) return `${hours}h ${minutes % 60}m ${seconds % 60}s`
  else if (minutes > 0) return `${minutes}m ${seconds % 60}s`
  else return `${seconds}s`
}

function getTokenInfo(tokenName: string): TokenInfo {
  const token = getCookie(tokenName)
  if (!token) {
    return { expiresAt: null, isExpired: true, timeRemaining: "No token", rawToken: null }
  }

  const parsed = parseJwt(token)
  if (!parsed?.exp) {
    const expiresAtCookieName = tokenName === "access_token" ? "token_expires_at" : "refresh_token_expires_at"
    const expiresAtCookie = getCookie(expiresAtCookieName)
    if (expiresAtCookie) {
      const expiresAtSeconds = Number.parseInt(expiresAtCookie, 10)
      const expiresAt = expiresAtSeconds * 1000
      const now = Date.now()
      const remaining = expiresAt - now
      return { expiresAt, isExpired: remaining <= 0, timeRemaining: formatTimeRemaining(remaining), rawToken: token }
    }
    return { expiresAt: null, isExpired: false, timeRemaining: "Unknown", rawToken: token }
  }

  const expiresAt = parsed.exp * 1000
  const now = Date.now()
  const remaining = expiresAt - now

  return { expiresAt, isExpired: remaining <= 0, timeRemaining: formatTimeRemaining(remaining), rawToken: token }
}

export function SettingsPage({ onClose }: SettingsPageProps) {
  const [accessTokenInfo, setAccessTokenInfo] = useState<TokenInfo>({
    expiresAt: null,
    isExpired: true,
    timeRemaining: "Loading...",
    rawToken: null,
  })
  const [refreshTokenInfo, setRefreshTokenInfo] = useState<TokenInfo>({
    expiresAt: null,
    isExpired: true,
    timeRemaining: "Loading...",
    rawToken: null,
  })
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [refreshStatus, setRefreshStatus] = useState<"idle" | "success" | "error">("idle")

  const updateTokenInfo = useCallback(() => {
    setAccessTokenInfo(getTokenInfo("access_token"))
    setRefreshTokenInfo(getTokenInfo("refresh_token"))
  }, [])

  useEffect(() => {
    updateTokenInfo()
    const interval = setInterval(updateTokenInfo, 1000)
    return () => clearInterval(interval)
  }, [updateTokenInfo])

  const handleManualRefresh = async () => {
    setIsRefreshing(true)
    setRefreshStatus("idle")

    console.log("[Settings] Manual token refresh requested")

    try {
      const success = await refreshToken()
      console.log("[Settings] Refresh completed, success:", success)
      setRefreshStatus(success ? "success" : "error")
      if (success) updateTokenInfo()
    } catch (error) {
      console.error("[Settings] Refresh error:", error)
      setRefreshStatus("error")
    } finally {
      setIsRefreshing(false)
      setTimeout(() => setRefreshStatus("idle"), 3000)
    }
  }

  return (
    <div className="h-full flex flex-col bg-background">
      <div className="flex items-center gap-4 px-6 py-4 border-b border-border bg-card">
        <Button variant="ghost" size="icon" onClick={onClose} className="text-foreground hover:bg-accent">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex items-center gap-2">
          <Settings className="h-5 w-5 text-muted-foreground" />
          <h1 className="text-xl font-semibold text-foreground">Settings</h1>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="bg-card rounded-lg border border-border shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Key className="h-5 w-5 text-muted-foreground" />
                <h2 className="text-lg font-semibold text-foreground">Authentication Status</h2>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleManualRefresh}
                disabled={isRefreshing || !refreshTokenInfo.rawToken}
                className="gap-2 bg-transparent"
              >
                <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
                {isRefreshing ? "Refreshing..." : "Refresh Token"}
              </Button>
            </div>

            {refreshStatus === "success" && (
              <div className="mb-4 p-3 bg-green-500/10 border border-green-500/20 rounded-md flex items-center gap-2 text-green-600 dark:text-green-400">
                <CheckCircle className="h-4 w-4" />
                <span className="text-sm">Token refreshed successfully</span>
              </div>
            )}

            {refreshStatus === "error" && (
              <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded-md flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-4 w-4" />
                <span className="text-sm">Failed to refresh token. You may need to re-authenticate.</span>
              </div>
            )}

            <div className="space-y-4">
              <div className="p-4 bg-muted rounded-md">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Access Token
                  </h3>
                  <Badge
                    variant={
                      accessTokenInfo.isExpired
                        ? "destructive"
                        : accessTokenInfo.timeRemaining.includes("m") && !accessTokenInfo.timeRemaining.includes("h")
                          ? "secondary"
                          : "default"
                    }
                  >
                    {accessTokenInfo.isExpired ? "Expired" : "Active"}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Time Remaining</span>
                  <span
                    className={`text-sm font-mono ${accessTokenInfo.isExpired ? "text-destructive" : "text-foreground"}`}
                  >
                    {accessTokenInfo.timeRemaining}
                  </span>
                </div>
                {accessTokenInfo.expiresAt && (
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-sm text-muted-foreground">Expires At</span>
                    <span className="text-sm font-mono text-muted-foreground">
                      {new Date(accessTokenInfo.expiresAt).toLocaleString()}
                    </span>
                  </div>
                )}
              </div>

              <div className="p-4 bg-muted rounded-md">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Refresh Token
                  </h3>
                  <Badge variant={refreshTokenInfo.isExpired || !refreshTokenInfo.rawToken ? "destructive" : "default"}>
                    {!refreshTokenInfo.rawToken ? "Not Found" : refreshTokenInfo.isExpired ? "Expired" : "Active"}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Time Remaining</span>
                  <span
                    className={`text-sm font-mono ${refreshTokenInfo.isExpired ? "text-destructive" : "text-foreground"}`}
                  >
                    {refreshTokenInfo.timeRemaining}
                  </span>
                </div>
                {refreshTokenInfo.expiresAt && (
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-sm text-muted-foreground">Expires At</span>
                    <span className="text-sm font-mono text-muted-foreground">
                      {new Date(refreshTokenInfo.expiresAt).toLocaleString()}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="bg-card rounded-lg border border-border shadow-sm p-6">
            <h2 className="text-lg font-semibold text-foreground mb-2">Application Settings</h2>
            <p className="text-sm text-muted-foreground mb-6">
              Configure your application settings here. This is a placeholder page that developers can customize for
              their specific use case.
            </p>

            <div className="space-y-4">
              <div className="p-4 bg-muted rounded-md">
                <h3 className="text-sm font-medium text-foreground mb-1">Getting Started</h3>
                <p className="text-sm text-muted-foreground">
                  To add settings functionality, edit this component at{" "}
                  <code className="text-xs bg-background px-1 py-0.5 rounded">components/settings-page.tsx</code>
                </p>
              </div>

              <div className="p-4 bg-muted rounded-md">
                <h3 className="text-sm font-medium text-foreground mb-1">Common Settings Patterns</h3>
                <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
                  <li>User preferences (theme, language, timezone)</li>
                  <li>Notification settings</li>
                  <li>API configuration</li>
                  <li>Feature flags</li>
                  <li>Organization/tenant settings</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
