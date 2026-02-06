"use client"

import { useSessionExpired } from "@/hooks/use-session-expired"
import { SettingsPage } from "@/components/settings-page"
import { AuthExitDialog } from "@/components/auth-exit-dialog"

export function HomePageClient() {
  useSessionExpired()

  return (
    <div className="min-h-screen bg-background">
      <SettingsPage />
      <AuthExitDialog />
    </div>
  )
}
