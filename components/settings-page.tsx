"use client"

import { ArrowLeft, Settings } from "lucide-react"
import { Button } from "@/components/ui/button"

interface SettingsPageProps {
  onClose: () => void
}

/**
 * Generic Settings Page Placeholder
 *
 * This is a template settings page that developers can customize
 * for their specific use case. Common settings might include:
 * - User preferences
 * - Application configuration
 * - Integration settings
 * - Notification preferences
 */
export function SettingsPage({ onClose }: SettingsPageProps) {
  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header */}
      <div className="flex items-center gap-4 px-6 py-4 border-b border-border bg-card">
        <Button variant="ghost" size="icon" onClick={onClose} className="text-foreground hover:bg-accent">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex items-center gap-2">
          <Settings className="h-5 w-5 text-muted-foreground" />
          <h1 className="text-xl font-semibold text-foreground">Settings</h1>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-4xl mx-auto">
          {/* Placeholder Section */}
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
