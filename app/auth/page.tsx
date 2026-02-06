"use client"

import type React from "react"

import { Suspense, useEffect, useState } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { AlertCircle, Loader2, CheckCircle2, ExternalLink } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

type AuthState = "idle" | "loading" | "success" | "error" | "manual-entry"
type Environment = "demo" | "prod"

interface AuthError {
  title: string
  message: string
}

const ENV_URLS: Record<Environment, string> = {
  demo: "https://demo.1health.io",
  prod: "https://app.1health.io",
}

function getOneHealthUrlFromCookie(): string | null {
  if (typeof document === "undefined") return null
  const match = document.cookie.match(/onehealth_base_url=([^;]+)/)
  return match ? decodeURIComponent(match[1]) : null
}

/**
 * Detects the environment from document.referrer.
 * Returns "demo" if referrer contains "demo.1health", "prod" if "app.1health", or null.
 */
function detectEnvironmentFromReferrer(): Environment | null {
  if (typeof document === "undefined" || !document.referrer) return null
  try {
    const referrerHostname = new URL(document.referrer).hostname
    if (referrerHostname.includes("demo.1health")) return "demo"
    if (referrerHostname.includes("app.1health")) return "prod"
  } catch {
    // Invalid referrer URL
  }
  return null
}

/**
 * Detects environment from a stored cookie.
 */
function getEnvironmentFromCookie(): Environment | null {
  if (typeof document === "undefined") return null
  const match = document.cookie.match(/onehealth_environment=([^;]+)/)
  if (!match) return null
  const value = decodeURIComponent(match[1])
  return value === "demo" || value === "prod" ? value : null
}

function AuthContent() {
  const [authState, setAuthState] = useState<AuthState>("idle")
  const [error, setError] = useState<AuthError | null>(null)
  const [manualLpl, setManualLpl] = useState("")
  const [environment, setEnvironment] = useState<Environment | null>(null)
  const searchParams = useSearchParams()
  const router = useRouter()

  const lpl = (searchParams.get("lpl") || "").replace(/ /g, "+")

  // Auto-detect environment on mount
  useEffect(() => {
    const fromReferrer = detectEnvironmentFromReferrer()
    if (fromReferrer) {
      setEnvironment(fromReferrer)
      return
    }

    const fromCookie = getEnvironmentFromCookie()
    if (fromCookie) {
      setEnvironment(fromCookie)
      return
    }

    // No auto-detection possible -- user will choose manually
  }, [])

  // Persist environment choice to cookie and set the onehealth_base_url cookie
  useEffect(() => {
    if (!environment) return
    const secure = window.location.protocol === "https:" ? "; Secure" : ""
    document.cookie = `onehealth_environment=${environment}; path=/; max-age=${60 * 60 * 24 * 30}; SameSite=Lax${secure}`

    const baseUrl = ENV_URLS[environment]
    document.cookie = `onehealth_base_url=${encodeURIComponent(baseUrl)}; path=/; max-age=${60 * 60 * 24 * 30}; SameSite=Lax${secure}`
  }, [environment])

  // Once environment is set and we have an LPL, process it
  useEffect(() => {
    if (environment && lpl) {
      processLpl(lpl)
    } else if (environment && !lpl) {
      setAuthState("manual-entry")
    }
  }, [environment, lpl])

  async function processLpl(lplValue: string) {
    if (!lplValue || !environment) return

    setAuthState("loading")

    try {
      const res = await fetch("/api/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lpl: lplValue, environment }),
      })

      const data = await res.json()

      if (!res.ok) {
        setAuthState("error")
        setError({
          title: "Authentication Failed",
          message: data.error || "Unable to authenticate. Please return to 1health and try again.",
        })
        return
      }

      if (!data.access_token) {
        setAuthState("error")
        setError({
          title: "Invalid Response",
          message: "No access token received. Please return to 1health and try again.",
        })
        return
      }

      setAuthState("success")
      const redirectRoute = process.env.NEXT_PUBLIC_DEFAULT_LAUNCH_REDIRECT_ROUTE || "/"

      setTimeout(() => {
        router.push(redirectRoute)
      }, 500)
    } catch {
      setAuthState("error")
      setError({
        title: "Connection Error",
        message: "Unable to connect to the authentication service. Please check your connection and try again.",
      })
    }
  }

  function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (manualLpl.trim() && environment) {
      processLpl(manualLpl.trim().replace(/ /g, "+"))
    }
  }

  const returnUrl = environment ? ENV_URLS[environment] : null

  // Environment selection screen
  if (!environment && authState !== "loading" && authState !== "success") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <Card>
            <CardHeader className="text-center">
              <CardTitle className="text-2xl">Choose Environment</CardTitle>
              <CardDescription>
                Select which 1health environment to connect to.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <Button
                variant="outline"
                className="h-16 text-lg justify-between"
                onClick={() => setEnvironment("demo")}
              >
                <div className="flex flex-col items-start">
                  <span className="font-semibold">Demo</span>
                  <span className="text-xs text-muted-foreground">demo.1health.io</span>
                </div>
                <ExternalLink className="h-4 w-4 text-muted-foreground" />
              </Button>
              <Button
                variant="outline"
                className="h-16 text-lg justify-between"
                onClick={() => setEnvironment("prod")}
              >
                <div className="flex flex-col items-start">
                  <span className="font-semibold">Production</span>
                  <span className="text-xs text-muted-foreground">app.1health.io</span>
                </div>
                <ExternalLink className="h-4 w-4 text-muted-foreground" />
              </Button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">Or</span>
                </div>
              </div>

              <p className="text-sm text-muted-foreground text-center">
                {"Prefer to log in via 1health directly?"}
              </p>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" className="flex-1" asChild>
                  <a href={ENV_URLS.demo} target="_blank" rel="noopener noreferrer">
                    Go to Demo <ExternalLink className="ml-1 h-3 w-3" />
                  </a>
                </Button>
                <Button variant="ghost" size="sm" className="flex-1" asChild>
                  <a href={ENV_URLS.prod} target="_blank" rel="noopener noreferrer">
                    Go to Production <ExternalLink className="ml-1 h-3 w-3" />
                  </a>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        {authState === "loading" && (
          <div className="flex flex-col items-center gap-4 text-center">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <div>
              <h2 className="text-xl font-semibold">Authenticating...</h2>
              <p className="text-muted-foreground mt-1">
                Connecting to {environment === "demo" ? "Demo" : "Production"} environment.
              </p>
            </div>
          </div>
        )}

        {authState === "success" && (
          <div className="flex flex-col items-center gap-4 text-center">
            <CheckCircle2 className="h-12 w-12 text-green-500" />
            <div>
              <h2 className="text-xl font-semibold">Authentication Successful</h2>
              <p className="text-muted-foreground mt-1">Redirecting you now...</p>
            </div>
          </div>
        )}

        {authState === "error" && error && (
          <div className="flex flex-col gap-4">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>{error.title}</AlertTitle>
              <AlertDescription>{error.message}</AlertDescription>
            </Alert>
            <div className="flex flex-col gap-2">
              <Button variant="outline" onClick={() => setAuthState("manual-entry")}>
                Enter LPL Manually
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setEnvironment(null)
                  setAuthState("idle")
                  setError(null)
                }}
              >
                Switch Environment
              </Button>
              {returnUrl && (
                <Button asChild>
                  <a href={returnUrl} target="_blank" rel="noopener noreferrer">
                    Go to 1health ({environment === "demo" ? "Demo" : "Production"})
                    <ExternalLink className="ml-2 h-4 w-4" />
                  </a>
                </Button>
              )}
            </div>
          </div>
        )}

        {authState === "manual-entry" && (
          <Card>
            <CardHeader>
              <CardTitle>Authentication Required</CardTitle>
              <CardDescription>
                Connected to <span className="font-medium">{environment === "demo" ? "Demo" : "Production"}</span> environment.
                No launch payload detected. Paste an LPL below or return to 1health to login.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <form onSubmit={handleManualSubmit} className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="lpl">Launch Payload (LPL)</Label>
                  <Input
                    id="lpl"
                    type="text"
                    placeholder="Paste encrypted LPL here..."
                    value={manualLpl}
                    onChange={(e) => setManualLpl(e.target.value)}
                  />
                </div>
                <Button type="submit" disabled={!manualLpl.trim()}>
                  Submit
                </Button>
              </form>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">Or</span>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                {returnUrl && (
                  <Button variant="outline" asChild>
                    <a href={returnUrl} target="_blank" rel="noopener noreferrer">
                      Go to 1health ({environment === "demo" ? "Demo" : "Production"})
                      <ExternalLink className="ml-2 h-4 w-4" />
                    </a>
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setEnvironment(null)
                    setAuthState("idle")
                    setError(null)
                  }}
                >
                  Switch Environment
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {authState === "idle" && environment && (
          <div className="flex flex-col items-center gap-4 text-center">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <p className="text-muted-foreground">Initializing...</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default function Auth() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background flex items-center justify-center p-6">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </div>
      }
    >
      <AuthContent />
    </Suspense>
  )
}
