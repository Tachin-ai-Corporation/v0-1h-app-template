"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Search, Grid3X3, User, Database, FileCode, BookOpen } from "lucide-react"

export function HomePage() {
  return (
    <div className="h-full overflow-auto p-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">1health App Template</h1>
          <p className="text-muted-foreground">
            A generic template for building front-end applications on top of the 1health platform. Use this as a
            starting point to build any healthcare application.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <Card className="bg-card">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Search className="h-4 w-4 text-primary" />
                Patient Search
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Search patients by name, date of birth, or external ID. Click results to view full details.
              </p>
            </CardContent>
          </Card>

          <Card className="bg-card">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Grid3X3 className="h-4 w-4 text-primary" />
                Campaign Grids
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Connect to any campaign by ID to view and manage journey data with filtering and export.
              </p>
            </CardContent>
          </Card>

          <Card className="bg-card">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <User className="h-4 w-4 text-primary" />
                Patient Details
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                View demographics, contact info, addresses, insurance coverage, and external system IDs.
              </p>
            </CardContent>
          </Card>

          <Card className="bg-card">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Database className="h-4 w-4 text-primary" />
                API Integration
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Built-in SSO authentication, token management, and server actions for 1health APIs.
              </p>
            </CardContent>
          </Card>

          <Card className="bg-card">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <FileCode className="h-4 w-4 text-primary" />
                Server Actions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Pre-built actions for persons, insurance, organizations, and queries. Easy to extend.
              </p>
            </CardContent>
          </Card>

          <Card className="bg-card">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <BookOpen className="h-4 w-4 text-primary" />
                Documentation
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                See README.md and docs/ACTION-PATTERNS.md for guides on extending this template.
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="mt-8 p-6 bg-card rounded-lg border border-border">
          <h2 className="text-lg font-semibold mb-4">Quick Start</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-medium text-sm mb-2">Add a New Page</h3>
              <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
                <li>
                  Create component in <code className="bg-muted px-1 rounded text-xs">components/pages/</code>
                </li>
                <li>
                  Add nav item in <code className="bg-muted px-1 rounded text-xs">home-page-client.tsx</code>
                </li>
                <li>
                  Add case to <code className="bg-muted px-1 rounded text-xs">renderContent()</code>
                </li>
              </ol>
            </div>
            <div>
              <h3 className="font-medium text-sm mb-2">Add a New API Action</h3>
              <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
                <li>
                  Create file in <code className="bg-muted px-1 rounded text-xs">app/actions/</code>
                </li>
                <li>
                  Use <code className="bg-muted px-1 rounded text-xs">authFetch()</code> for API calls
                </li>
                <li>
                  See <code className="bg-muted px-1 rounded text-xs">docs/ACTION-PATTERNS.md</code>
                </li>
              </ol>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
