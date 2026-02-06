"use client"

import { useState, useEffect, useCallback } from "react"
import {
  RefreshCw,
  Clock,
  Key,
  AlertTriangle,
  CheckCircle,
  Copy,
  Check,
  User,
  Loader2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { refreshToken, getCookie } from "@/lib/auth-client"
import { fetchMyself, type UserInfo } from "@/lib/api/user"

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

export function SettingsPage() {
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null)
  const [userLoading, setUserLoading] = useState(true)
  const [userError, setUserError] = useState<string | null>(null)

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
  const [copiedToken, setCopiedToken] = useState<string | null>(null)

  // Fetch user info on mount
  useEffect(() => {
    const loadUser = async () => {
      setUserLoading(true)
      setUserError(null)
      const result = await fetchMyself()
      if (result.success && result.data) {
        setUserInfo(result.data)
      } else {
        setUserError(result.error || "Failed to load user info")
      }
      setUserLoading(false)
    }
    loadUser()
  }, [])

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
    try {
      const success = await refreshToken()
      setRefreshStatus(success ? "success" : "error")
      if (success) updateTokenInfo()
    } catch {
      setRefreshStatus("error")
    } finally {
      setIsRefreshing(false)
      setTimeout(() => setRefreshStatus("idle"), 3000)
    }
  }

  const copyToClipboard = useCallback((text: string, tokenName: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedToken(tokenName)
      setTimeout(() => setCopiedToken(null), 2000)
    })
  }, [])

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground">Settings</h1>
        <p className="text-muted-foreground mt-2">Account information and authentication status.</p>
      </div>

      <div className="flex flex-col gap-6">
        {/* Account Info Card */}
        <Card className="border-border bg-card">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <User className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-base">Account Information</CardTitle>
            </div>
            <CardDescription>Your 1health user profile</CardDescription>
          </CardHeader>
          <CardContent>
            {userLoading ? (
              <div className="flex flex-col gap-3">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-4 w-64" />
                <Skeleton className="h-4 w-36" />
                <Skeleton className="h-4 w-52" />
              </div>
            ) : userError ? (
              <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span className="text-sm">{userError}</span>
              </div>
            ) : userInfo ? (
              <div className="flex flex-col gap-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-3 bg-muted rounded-md">
                    <span className="text-xs text-muted-foreground uppercase tracking-wide">Name</span>
                    <p className="text-sm font-medium text-foreground mt-1">
                      {userInfo.firstName} {userInfo.lastName}
                    </p>
                  </div>
                  <div className="p-3 bg-muted rounded-md">
                    <span className="text-xs text-muted-foreground uppercase tracking-wide">Username</span>
                    <p className="text-sm font-medium text-foreground mt-1 font-mono">{userInfo.username}</p>
                  </div>
                  <div className="p-3 bg-muted rounded-md">
                    <span className="text-xs text-muted-foreground uppercase tracking-wide">Email</span>
                    <p className="text-sm font-medium text-foreground mt-1">{userInfo.email}</p>
                  </div>
                  <div className="p-3 bg-muted rounded-md">
                    <span className="text-xs text-muted-foreground uppercase tracking-wide">User ID</span>
                    <p className="text-sm font-medium text-foreground mt-1 font-mono">{userInfo.id}</p>
                  </div>
                  <div className="p-3 bg-muted rounded-md">
                    <span className="text-xs text-muted-foreground uppercase tracking-wide">Tenant</span>
                    <p className="text-sm font-medium text-foreground mt-1">
                      {userInfo.tenantContext?.name || "N/A"}
                      {userInfo.tenantContext?.id && (
                        <span className="text-muted-foreground font-mono text-xs ml-2">
                          (ID: {userInfo.tenantContext.id})
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="p-3 bg-muted rounded-md">
                    <span className="text-xs text-muted-foreground uppercase tracking-wide">System Admin</span>
                    <p className="text-sm font-medium text-foreground mt-1">
                      {userInfo.systemAdministrator ? "Yes" : "No"}
                    </p>
                  </div>
                </div>
                {userInfo.roles && userInfo.roles.length > 0 && (
                  <div className="p-3 bg-muted rounded-md">
                    <span className="text-xs text-muted-foreground uppercase tracking-wide">Roles</span>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {userInfo.roles.map((role) => (
                        <Badge key={role} variant="secondary">
                          {role}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : null}
          </CardContent>
        </Card>

        {/* Authentication Status Card */}
        <Card className="border-border bg-card">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Key className="h-5 w-5 text-muted-foreground" />
                <CardTitle className="text-base">Authentication Status</CardTitle>
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
            <CardDescription>Token status and management</CardDescription>
          </CardHeader>
          <CardContent>
            {refreshStatus === "success" && (
              <div className="mb-4 p-3 bg-green-500/10 border border-green-500/20 rounded-md flex items-center gap-2 text-green-400">
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

            <div className="flex flex-col gap-4">
              {/* Access Token */}
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
                {accessTokenInfo.rawToken && (
                  <div className="mt-3 pt-3 border-t border-border">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-muted-foreground">Token Value</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-xs"
                        onClick={() => copyToClipboard(accessTokenInfo.rawToken!, "access")}
                      >
                        {copiedToken === "access" ? (
                          <Check className="h-3 w-3 mr-1 text-green-500" />
                        ) : (
                          <Copy className="h-3 w-3 mr-1" />
                        )}
                        {copiedToken === "access" ? "Copied" : "Copy"}
                      </Button>
                    </div>
                    <div className="bg-background p-2 rounded border border-border overflow-hidden">
                      <code className="text-xs font-mono text-foreground break-all block max-h-20 overflow-y-auto">
                        {accessTokenInfo.rawToken}
                      </code>
                    </div>
                  </div>
                )}
              </div>

              {/* Refresh Token */}
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
                {refreshTokenInfo.rawToken && (
                  <div className="mt-3 pt-3 border-t border-border">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-muted-foreground">Token Value</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-xs"
                        onClick={() => copyToClipboard(refreshTokenInfo.rawToken!, "refresh")}
                      >
                        {copiedToken === "refresh" ? (
                          <Check className="h-3 w-3 mr-1 text-green-500" />
                        ) : (
                          <Copy className="h-3 w-3 mr-1" />
                        )}
                        {copiedToken === "refresh" ? "Copied" : "Copy"}
                      </Button>
                    </div>
                    <div className="bg-background p-2 rounded border border-border overflow-hidden">
                      <code className="text-xs font-mono text-foreground break-all block max-h-20 overflow-y-auto">
                        {refreshTokenInfo.rawToken}
                      </code>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
