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
  Building2,
  MapPin,
  Phone,
  Mail,
  Shield,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { refreshToken, getCookie } from "@/lib/auth-client"
import { useSession } from "@/contexts/session-context"

// ============================================================================
// Token helpers (unchanged)
// ============================================================================

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
    return JSON.parse(atob(parts[1]))
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
  if (hours > 0) return `${hours}h ${minutes % 60}m ${seconds % 60}s`
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`
  return `${seconds}s`
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
      const expiresAt = Number.parseInt(expiresAtCookie, 10) * 1000
      const remaining = expiresAt - Date.now()
      return { expiresAt, isExpired: remaining <= 0, timeRemaining: formatTimeRemaining(remaining), rawToken: token }
    }
    return { expiresAt: null, isExpired: false, timeRemaining: "Unknown", rawToken: token }
  }

  const expiresAt = parsed.exp * 1000
  const remaining = expiresAt - Date.now()
  return { expiresAt, isExpired: remaining <= 0, timeRemaining: formatTimeRemaining(remaining), rawToken: token }
}

/** Normalize "n/a", empty strings, and null to null for display */
function normalize(value: string | null | undefined): string | null {
  if (!value || value === "n/a" || value.trim() === "") return null
  return value
}

// ============================================================================
// Component
// ============================================================================

export function SettingsPage() {
  const { user, tenant, isLoading, error } = useSession()
  const org = tenant?.organization ?? null

  // Token state
  const [accessTokenInfo, setAccessTokenInfo] = useState<TokenInfo>({
    expiresAt: null, isExpired: true, timeRemaining: "Loading...", rawToken: null,
  })
  const [refreshTokenInfo, setRefreshTokenInfo] = useState<TokenInfo>({
    expiresAt: null, isExpired: true, timeRemaining: "Loading...", rawToken: null,
  })
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [refreshStatus, setRefreshStatus] = useState<"idle" | "success" | "error">("idle")
  const [copiedToken, setCopiedToken] = useState<string | null>(null)

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

  // Derived org display values
  const orgName = tenant?.tenantName ?? org?.name ?? null
  const orgShortName = org?.shortOrganizationName ?? null
  const logoUrl = tenant?.tenantLogo?.publicUrl ?? tenant?.tenantDarkLogo?.publicUrl ?? null
  const orgTypes = org?.type ?? []
  const hqAddress = org?.headquarterAddress ?? null
  const primaryContact = org?.personContacts?.find((c) => c.contactTypes?.includes("Primary")) ?? org?.personContacts?.[0] ?? null
  const primaryColor = tenant?.primaryColor ?? null
  const secondaryColor = tenant?.secondaryColor ?? null

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-h2 text-foreground text-balance">Settings</h1>
        <p className="text-muted-foreground mt-2">Organization, account, and authentication information.</p>
      </div>

      {/* Global loading state */}
      {isLoading && (
        <div className="flex flex-col gap-6">
          <Card className="border-border bg-card">
            <CardHeader className="pb-3"><Skeleton className="h-5 w-40" /></CardHeader>
            <CardContent><div className="flex flex-col gap-3"><Skeleton className="h-16 w-full" /><Skeleton className="h-4 w-64" /><Skeleton className="h-4 w-48" /></div></CardContent>
          </Card>
          <Card className="border-border bg-card">
            <CardHeader className="pb-3"><Skeleton className="h-5 w-40" /></CardHeader>
            <CardContent><div className="flex flex-col gap-3"><Skeleton className="h-4 w-48" /><Skeleton className="h-4 w-64" /><Skeleton className="h-4 w-36" /></div></CardContent>
          </Card>
        </div>
      )}

      {/* Global error */}
      {!isLoading && error && (
        <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-md flex items-center gap-2 text-destructive">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span className="text-sm">{error}</span>
        </div>
      )}

      {/* Content */}
      {!isLoading && !error && (
        <div className="flex flex-col gap-6">

          {/* ============================================================ */}
          {/* Organization Card                                            */}
          {/* ============================================================ */}
          <Card className="border-border bg-card">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                {logoUrl ? (
                  <img
                    src={logoUrl}
                    alt={`${orgName ?? "Organization"} logo`}
                    className="h-10 w-auto max-w-[160px] object-contain"
                  />
                ) : (
                  <Building2 className="h-5 w-5 text-muted-foreground" />
                )}
                <div>
                  <CardTitle className="text-base">{orgName ?? "Organization"}</CardTitle>
                  {orgShortName && orgShortName !== orgName && (
                    <CardDescription>{orgShortName}</CardDescription>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-4">
                {/* Org types */}
                {orgTypes.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {orgTypes.map((t) => (
                      <Badge key={t} variant="secondary">{t}</Badge>
                    ))}
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Tenant ID */}
                  <div className="p-3 bg-muted rounded-md">
                    <span className="text-xs text-muted-foreground uppercase tracking-wide">Tenant ID</span>
                    <p className="text-sm font-mono font-medium text-foreground mt-1">{tenant?.tenantId ?? "N/A"}</p>
                  </div>

                  {/* Subdomain */}
                  {normalize(tenant?.subdomain) && (
                    <div className="p-3 bg-muted rounded-md">
                      <span className="text-xs text-muted-foreground uppercase tracking-wide">Subdomain</span>
                      <p className="text-sm font-mono font-medium text-foreground mt-1">{tenant!.subdomain}</p>
                    </div>
                  )}

                  {/* HIPAA */}
                  <div className="p-3 bg-muted rounded-md flex items-center gap-2">
                    <div>
                      <span className="text-xs text-muted-foreground uppercase tracking-wide">HIPAA Covered Entity</span>
                      <p className="text-sm font-medium text-foreground mt-1 flex items-center gap-1.5">
                        <Shield className="h-3.5 w-3.5" />
                        {tenant?.hipaaCoveredEntity ? "Yes" : "No"}
                      </p>
                    </div>
                  </div>

                  {/* Brand colors */}
                  {(primaryColor || secondaryColor) && (
                    <div className="p-3 bg-muted rounded-md">
                      <span className="text-xs text-muted-foreground uppercase tracking-wide">Brand Colors</span>
                      <div className="flex items-center gap-3 mt-2">
                        {primaryColor && (
                          <div className="flex items-center gap-1.5">
                            <span className="h-4 w-4 rounded-full border border-border" style={{ backgroundColor: primaryColor }} />
                            <span className="text-xs font-mono text-muted-foreground">{primaryColor}</span>
                          </div>
                        )}
                        {secondaryColor && secondaryColor !== primaryColor && (
                          <div className="flex items-center gap-1.5">
                            <span className="h-4 w-4 rounded-full border border-border" style={{ backgroundColor: secondaryColor }} />
                            <span className="text-xs font-mono text-muted-foreground">{secondaryColor}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* HQ Address */}
                {hqAddress && normalize(hqAddress.fullAddress) && (
                  <div className="p-3 bg-muted rounded-md">
                    <span className="text-xs text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                      <MapPin className="h-3 w-3" /> Headquarters
                    </span>
                    <p className="text-sm font-medium text-foreground mt-1">{hqAddress.fullAddress}</p>
                  </div>
                )}

                {/* Primary Contact */}
                {primaryContact && (
                  <div className="p-3 bg-muted rounded-md">
                    <span className="text-xs text-muted-foreground uppercase tracking-wide">Primary Contact</span>
                    <div className="mt-1 flex flex-col gap-1">
                      <p className="text-sm font-medium text-foreground">
                        {primaryContact.firstName} {primaryContact.lastName}
                      </p>
                      {normalize(primaryContact.email) && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Mail className="h-3 w-3" /> {primaryContact.email}
                        </p>
                      )}
                      {normalize(primaryContact.phoneNumber) && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Phone className="h-3 w-3" /> {primaryContact.phoneNumber}
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* ============================================================ */}
          {/* Account Info Card                                            */}
          {/* ============================================================ */}
          {user && (
            <Card className="border-border bg-card">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <User className="h-5 w-5 text-muted-foreground" />
                  <CardTitle className="text-base">Account</CardTitle>
                </div>
                <CardDescription>Your 1health user profile</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col gap-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-3 bg-muted rounded-md">
                      <span className="text-xs text-muted-foreground uppercase tracking-wide">Name</span>
                      <p className="text-sm font-medium text-foreground mt-1">{user.firstName} {user.lastName}</p>
                    </div>
                    <div className="p-3 bg-muted rounded-md">
                      <span className="text-xs text-muted-foreground uppercase tracking-wide">Username</span>
                      <p className="text-sm font-mono font-medium text-foreground mt-1">{user.username}</p>
                    </div>
                    <div className="p-3 bg-muted rounded-md">
                      <span className="text-xs text-muted-foreground uppercase tracking-wide">Email</span>
                      <p className="text-sm font-medium text-foreground mt-1">{user.email}</p>
                    </div>
                    <div className="p-3 bg-muted rounded-md">
                      <span className="text-xs text-muted-foreground uppercase tracking-wide">User ID</span>
                      <p className="text-sm font-mono font-medium text-foreground mt-1">{user.id}</p>
                    </div>
                    <div className="p-3 bg-muted rounded-md">
                      <span className="text-xs text-muted-foreground uppercase tracking-wide">System Admin</span>
                      <p className="text-sm font-medium text-foreground mt-1">{user.systemAdministrator ? "Yes" : "No"}</p>
                    </div>
                  </div>
                  {user.roles && user.roles.length > 0 && (
                    <div className="p-3 bg-muted rounded-md">
                      <span className="text-xs text-muted-foreground uppercase tracking-wide">Roles</span>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {user.roles.map((role) => (
                          <Badge key={role} variant="secondary">{role}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* ============================================================ */}
          {/* Authentication Status Card                                   */}
          {/* ============================================================ */}
          <Card className="border-border bg-card">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Key className="h-5 w-5 text-muted-foreground" />
                  <CardTitle className="text-base">Authentication</CardTitle>
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
                <div className="mb-4 p-3 bg-success/10 border border-success/25 rounded-md flex items-center gap-2 text-success-strong">
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
                <TokenCard
                  label="Access Token"
                  info={accessTokenInfo}
                  copyKey="access"
                  copiedToken={copiedToken}
                  onCopy={copyToClipboard}
                />
                {/* Refresh Token */}
                <TokenCard
                  label="Refresh Token"
                  info={refreshTokenInfo}
                  copyKey="refresh"
                  copiedToken={copiedToken}
                  onCopy={copyToClipboard}
                />
              </div>
            </CardContent>
          </Card>

        </div>
      )}
    </div>
  )
}

// ============================================================================
// TokenCard sub-component (extracted from repeated pattern)
// ============================================================================

function TokenCard({
  label,
  info,
  copyKey,
  copiedToken,
  onCopy,
}: {
  label: string
  info: TokenInfo
  copyKey: string
  copiedToken: string | null
  onCopy: (text: string, key: string) => void
}) {
  return (
    <div className="p-4 bg-muted rounded-md">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
          <Clock className="h-4 w-4" />
          {label}
        </h3>
        <Badge variant={info.isExpired || !info.rawToken ? "destructive" : "success"}>
          {!info.rawToken ? "Not Found" : info.isExpired ? "Expired" : "Active"}
        </Badge>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">Time Remaining</span>
        <span className={`text-sm font-mono ${info.isExpired ? "text-destructive" : "text-foreground"}`}>
          {info.timeRemaining}
        </span>
      </div>
      {info.expiresAt && (
        <div className="flex items-center justify-between mt-1">
          <span className="text-sm text-muted-foreground">Expires At</span>
          <span className="text-sm font-mono text-muted-foreground">
            {new Date(info.expiresAt).toLocaleString()}
          </span>
        </div>
      )}
      {info.rawToken && (
        <div className="mt-3 pt-3 border-t border-border">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm text-muted-foreground">Token Value</span>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs"
              onClick={() => onCopy(info.rawToken!, copyKey)}
            >
              {copiedToken === copyKey ? (
                <Check className="h-3 w-3 mr-1 text-success" />
              ) : (
                <Copy className="h-3 w-3 mr-1" />
              )}
              {copiedToken === copyKey ? "Copied" : "Copy"}
            </Button>
          </div>
          <div className="bg-background p-2 rounded border border-border overflow-hidden">
            <code className="text-xs font-mono text-foreground break-all block max-h-20 overflow-y-auto">
              {info.rawToken}
            </code>
          </div>
        </div>
      )}
    </div>
  )
}
