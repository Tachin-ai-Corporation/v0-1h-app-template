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

interface AuthError {
  title: string
  message: string
}

function getOneHealthUrlFromCookie(): string | null {
  if (typeof document === "undefined") return null
  const match = document.cookie.match(/onehealth_base_url=([^;]+)/)
  return match ? decodeURIComponent(match[1]) : null
}

function AuthContent() {
  const [authState, setAuthState] = useState<AuthState>("idle")
  const [error, setError] = useState<AuthError | null>(null)
  const [manualLpl, setManualLpl] = useState("")
  const [manualUrl, setManualUrl] = useState("")
  const [oneHealthUrl, setOneHealthUrl] = useState<string | null>(null)
  const searchParams = useSearchParams()
  const router = useRouter()

  const lpl = (searchParams.get("lpl") || "").replace(/ /g, "+")

  function isValidOneHealthUrl(url: string): boolean {
    try {
      const parsed = new URL(url)
      // Must contain "1health" in the hostname OR be an explicit 1health URL
      // Exclude our own preview/app URLs
      const isOneHealth = parsed.hostname.includes("1health")
      const isOurPreview =
        parsed.hostname.includes("vusercontent.net") ||
        parsed.hostname.includes("vercel.app") ||
        parsed.hostname.includes("localhost")
      return isOneHealth && !isOurPreview
    } catch {
      return false
    }
  }

  useEffect(() => {
    // Try to get URL from cookie first
    const urlFromCookie = getOneHealthUrlFromCookie()

    if (urlFromCookie && isValidOneHealthUrl(urlFromCookie)) {
      setOneHealthUrl(urlFromCookie)
    } else if (document.referrer && isValidOneHealthUrl(document.referrer)) {
      try {
        const referrerUrl = new URL(document.referrer)
        setOneHealthBaseUrlCookie(referrerUrl.origin)
        setOneHealthUrl(referrerUrl.origin)
      } catch {
        // Invalid referrer, fall back to env var
        setOneHealthUrl(process.env.NEXT_PUBLIC_1H_URL || null)
      }
    } else {
      const envUrl = process.env.NEXT_PUBLIC_1H_URL || null
      if (envUrl) {
        setOneHealthBaseUrlCookie(envUrl)
      }
      setOneHealthUrl(envUrl)
    }
  }, [])

  async function processLpl(lplValue: string) {
    if (!lplValue) {
      setAuthState("manual-entry")
      return
    }

    setAuthState("loading")

    try {
      const res = await fetch("/api/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lpl: lplValue }),
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
    if (lpl) {
      processLpl(lpl)
    } else {
      setAuthState("manual-entry")
    }
  }, [lpl])

  function setOneHealthBaseUrlCookie(url: string) {
    if (!isValidOneHealthUrl(url)) {
      console.warn("[v0] Ignoring invalid 1health URL:", url)
      return
    }
    const normalizedUrl = url.replace(/\/$/, "")
    document.cookie = `onehealth_base_url=${encodeURIComponent(normalizedUrl)}; path=/; max-age=${60 * 60 * 24 * 30}; SameSite=Lax`
    setOneHealthUrl(normalizedUrl)
  }

  function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (manualUrl.trim()) {
      try {
        const parsed = new URL(manualUrl.trim())
        setOneHealthBaseUrlCookie(parsed.origin)
      } catch {
        // Invalid URL, ignore
      }
    }

    if (manualLpl.trim()) {
      processLpl(manualLpl.trim().replace(/ /g, "+"))
    }
  }

  const returnUrl = oneHealthUrl || process.env.NEXT_PUBLIC_1H_URL || ""

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

        {authState === "manual-entry" && (
          <Card>
            <CardHeader>
              <CardTitle>Authentication Required</CardTitle>
              <CardDescription>
                No launch payload detected. You can paste an LPL below or return to 1health to login.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <form onSubmit={handleManualSubmit} className="flex flex-col gap-4">
                {!oneHealthUrl && (
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="url">1health URL</Label>
                    <Input
                      id="url"
                      type="url"
                      placeholder="https://demo.1health.io"
                      value={manualUrl}
                      onChange={(e) => setManualUrl(e.target.value)}
                    />
                  </div>
                )}
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

              {returnUrl && (
                <Button variant="outline" asChild>
                  <a href={returnUrl} target="_blank" rel="noopener noreferrer">
                    Go to 1health <ExternalLink className="ml-2 h-4 w-4" />
                  </a>
                </Button>
              )}
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
