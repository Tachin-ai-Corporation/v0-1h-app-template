"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Settings, BookOpen, Code, Layers, Shield, Plug } from "lucide-react"
import { useNavigation } from "@/contexts/navigation-context"

export function StarterHomePage() {
  const { setCurrentView } = useNavigation()

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground text-balance">1health App Starter</h1>
        <p className="text-muted-foreground mt-2 text-pretty leading-relaxed">
          Welcome to your greenfield 1health application. This template provides authentication,
          API integration, and navigation infrastructure -- you bring the features.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border-border bg-card">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-base">Authentication</CardTitle>
            </div>
            <CardDescription>Pre-configured and ready to use</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground leading-relaxed">
              LPL-based authentication with automatic token refresh, session management,
              and secure cookie handling. See{" "}
              <code className="text-xs bg-muted px-1 py-0.5 rounded font-mono">docs/AUTH-ARCHITECTURE.md</code>{" "}
              for details.
            </p>
            <div className="flex gap-2 mt-3">
              <Badge variant="secondary">OAuth2</Badge>
              <Badge variant="secondary">Auto-refresh</Badge>
              <Badge variant="secondary">AES-256-GCM</Badge>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Plug className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-base">API Layer</CardTitle>
            </div>
            <CardDescription>Authenticated API calls made simple</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Use <code className="text-xs bg-muted px-1 py-0.5 rounded font-mono">authFetch()</code> from{" "}
              <code className="text-xs bg-muted px-1 py-0.5 rounded font-mono">lib/auth-client.ts</code> for
              all API calls. Token refresh and error handling are automatic.
            </p>
            <div className="flex gap-2 mt-3">
              <Badge variant="secondary">authFetch</Badge>
              <Badge variant="secondary">SWR-compatible</Badge>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Layers className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-base">Navigation</CardTitle>
            </div>
            <CardDescription>SPA routing with browser history</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Add pages by creating components and registering them in{" "}
              <code className="text-xs bg-muted px-1 py-0.5 rounded font-mono">home-page-client.tsx</code>.
              The navigation context handles URL state, back/forward, and modal management.
            </p>
            <div className="flex gap-2 mt-3">
              <Badge variant="secondary">Query params</Badge>
              <Badge variant="secondary">History API</Badge>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Code className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-base">Patterns & Docs</CardTitle>
            </div>
            <CardDescription>Follow established conventions</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Check the <code className="text-xs bg-muted px-1 py-0.5 rounded font-mono">docs/</code> folder
              for architecture docs on authentication, action patterns, and API debugging.
            </p>
            <div className="flex gap-2 mt-3">
              <Badge variant="secondary">AUTH-ARCHITECTURE</Badge>
              <Badge variant="secondary">ACTION-PATTERNS</Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6 border-border bg-card">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-base">Quick Start</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <ol className="text-sm text-muted-foreground list-decimal list-inside leading-relaxed flex flex-col gap-2">
            <li>
              <strong className="text-foreground">Create a page component</strong> in{" "}
              <code className="text-xs bg-muted px-1 py-0.5 rounded font-mono">components/pages/</code>
            </li>
            <li>
              <strong className="text-foreground">Register it</strong> in{" "}
              <code className="text-xs bg-muted px-1 py-0.5 rounded font-mono">components/home-page-client.tsx</code>{" "}
              -- add a nav item and a case in the view switch
            </li>
            <li>
              <strong className="text-foreground">Add API functions</strong> in{" "}
              <code className="text-xs bg-muted px-1 py-0.5 rounded font-mono">lib/api/</code>{" "}
              using <code className="text-xs bg-muted px-1 py-0.5 rounded font-mono">authFetch()</code> (see{" "}
              <code className="text-xs bg-muted px-1 py-0.5 rounded font-mono">lib/api/user.ts</code> as an example)
            </li>
            <li>
              <strong className="text-foreground">Use SWR</strong> with{" "}
              <code className="text-xs bg-muted px-1 py-0.5 rounded font-mono">lib/hooks/use-fetch.ts</code>{" "}
              for data fetching and caching
            </li>
          </ol>
          <div className="mt-4">
            <Button
              variant="outline"
              size="sm"
              className="gap-2 bg-transparent"
              onClick={() => setCurrentView("settings")}
            >
              <Settings className="h-4 w-4" />
              View Account Settings
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
