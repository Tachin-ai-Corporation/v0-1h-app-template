"use client"

import type React from "react"

import { Suspense, useEffect, useState } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { AlertCircle, Loader2, CheckCircle2, ExternalLink, Building2, FlaskConical } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  type OneHealthEnvironment,
  detectEnvironmentFromReferrer,
  getStoredEnvironment,
  setStoredEnvironment,
  getApiUrl,
} from "@/lib/env-config"

type AuthState = "idle" | "loading" | "success" | "error" | "select-env" | "manual-entry"

interface AuthError {
  title: string
  message: string
}

function setOneHealthBaseUrlCookie(url: string) {
  const normalizedUrl = url.replace(/\/$/, "")
  document.cookie = `onehealth_base_url=${encodeURIComponent(normalizedUrl)}; path=/; max-age=${60 * 60 * 24 * 30}; SameSite=Lax`
}

function AuthContent() {
  const [authState, setAuthState] = useState<AuthState>("idle")
  const [error, setError] = useState<AuthError | null>(null)
  const [manualLpl, setManualLpl] = useState("")
  const [selectedEnv, setSelectedEnv] = useState<OneHealthEnvironment | null>(null)
  const [pendingLpl, setPendingLpl] = useState<string | null>(null)
  const searchParams = useSearchParams()
  const router = useRouter()

  const lpl = (searchParams.get("lpl") || "").replace(/ /g, "+")

  async function processLpl(lplValue: string, env: OneHealthEnvironment) {
    if (!lplValue) {
      setAuthState("manual-entry")
      return
    }

    setAuthState("loading")

    // Set the environment and URL before making the token request
    setStoredEnvironment(env)
    const apiUrl = getApiUrl(env)
    setOneHealthBaseUrlCookie(apiUrl)

    try {
      const res = await fetch("/api/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lpl: lplValue, env }),
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
    } catch (err) {
      setAuthState("error")
      setError({
        title: "Connection Error",
        message: "Unable to connect to the authentication service. Please check your connection and try again.",
      })
    }
  }

  useEffect(() => {
    if (!lpl) {
      setAuthState("manual-entry")
      return
    }

    // Try to detect environment from referrer
    const detectedEnv = detectEnvironmentFromReferrer(document.referrer)
    
    if (detectedEnv) {
      // Auto-detected environment, proceed with auth
      processLpl(lpl, detectedEnv)
    } else {
      // Check if we have a stored environment
      const storedEnv = getStoredEnvironment()
      if (storedEnv) {
        processLpl(lpl, storedEnv)
      } else {
        // Need user to select environment
        setPendingLpl(lpl)
        setAuthState("select-env")
      }
    }
  }, [lpl])

  function handleEnvSelect(env: OneHealthEnvironment) {
    setSelectedEnv(env)
    setStoredEnvironment(env)
    
    if (pendingLpl) {
      processLpl(pendingLpl, env)
    } else if (manualLpl.trim()) {
      processLpl(manualLpl.trim().replace(/ /g, "+"), env)
    } else {
      // Just set the environment and show manual entry
      const apiUrl = getApiUrl(env)
      setOneHealthBaseUrlCookie(apiUrl)
      setAuthState("manual-entry")
    }
  }

  function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!manualLpl.trim()) return

    const env = selectedEnv || getStoredEnvironment()
    if (!env) {
      setPendingLpl(manualLpl.trim().replace(/ /g, "+"))
      setAuthState("select-env")
      return
    }

    processLpl(manualLpl.trim().replace(/ /g, "+"), env)
  }

  const currentEnv = selectedEnv || getStoredEnvironment()
  const returnUrl = currentEnv ? getApiUrl(currentEnv) : ""

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        {authState === "loading" && (
          <div className="flex flex-col items-center gap-4 text-center">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <div>
              <h2 className="text-xl font-semibold">Authenticating...</h2>
              <p className="text-muted-foreground mt-1">Please wait while we verify your credentials.</p>
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
              {returnUrl && (
                <Button asChild>
                  <a href={returnUrl} target="_blank" rel="noopener noreferrer">
                    Return to 1health <ExternalLink className="ml-2 h-4 w-4" />
                  </a>
                </Button>
              )}
            </div>
          </div>
        )}

        {authState === "select-env" && (
          <Card>
            <CardHeader className="text-center">
              <CardTitle>Select Environment</CardTitle>
              <CardDescription>
                Choose which 1health environment to connect to.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-4">
                <Button
                  variant="outline"
                  className="h-24 flex flex-col gap-2 bg-transparent"
                  onClick={() => handleEnvSelect("prod")}
                >
                  <Building2 className="h-8 w-8" />
                  <span className="font-semibold">Production</span>
                </Button>
                <Button
                  variant="outline"
                  className="h-24 flex flex-col gap-2 bg-transparent"
                  onClick={() => handleEnvSelect("demo")}
                >
                  <FlaskConical className="h-8 w-8" />
                  <span className="font-semibold">Demo</span>
                </Button>
              </div>
              <p className="text-xs text-muted-foreground text-center">
                This selection will be remembered for future visits.
              </p>
            </CardContent>
          </Card>
        )}

        {authState === "manual-entry" && (
          <Card>
            <CardHeader>
              <CardTitle>Authentication Required</CardTitle>
              <CardDescription>
                {currentEnv ? (
                  <>Connected to <span className="font-medium">{currentEnv === "demo" ? "Demo" : "Production"}</span>. Paste an LPL below or return to 1health.</>
                ) : (
                  <>No launch payload detected. Select an environment and paste an LPL below.</>
                )}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {!currentEnv && (
                <div className="flex flex-col gap-2">
                  <Label>Environment</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      type="button"
                      variant={selectedEnv === "prod" ? "default" : "outline"}
                      size="sm"
                      onClick={() => {
                        setSelectedEnv("prod")
                        setStoredEnvironment("prod")
                        setOneHealthBaseUrlCookie(getApiUrl("prod"))
                      }}
                    >
                      <Building2 className="h-4 w-4 mr-2" />
                      Production
                    </Button>
                    <Button
                      type="button"
                      variant={selectedEnv === "demo" ? "default" : "outline"}
                      size="sm"
                      onClick={() => {
                        setSelectedEnv("demo")
                        setStoredEnvironment("demo")
                        setOneHealthBaseUrlCookie(getApiUrl("demo"))
                      }}
                    >
                      <FlaskConical className="h-4 w-4 mr-2" />
                      Demo
                    </Button>
                  </div>
                </div>
              )}

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
                <Button type="submit" disabled={!manualLpl.trim() || (!currentEnv && !selectedEnv)}>
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
                {currentEnv && (
                  <Button variant="outline" asChild>
                    <a href={returnUrl} target="_blank" rel="noopener noreferrer">
                      Go to 1health ({currentEnv === "demo" ? "Demo" : "Production"}) <ExternalLink className="ml-2 h-4 w-4" />
                    </a>
                  </Button>
                )}
                {currentEnv && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSelectedEnv(null)
                      setAuthState("select-env")
                    }}
                  >
                    Switch Environment
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {authState === "idle" && (
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
