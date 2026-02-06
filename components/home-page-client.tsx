"use client"

import { Home, Settings } from "lucide-react"
import { useSessionExpired } from "@/hooks/use-session-expired"
import { useNavigation } from "@/contexts/navigation-context"
import { AppShell, type NavItem } from "@/components/app-shell"
import { SettingsPage } from "@/components/settings-page"
import { StarterHomePage } from "@/components/pages/home-page"

const navItems: NavItem[] = [
  { name: "Home", key: "home", icon: Home },
  { name: "Settings", key: "settings", icon: Settings },
]

export function HomePageClient() {
  const { currentView } = useNavigation()

  useSessionExpired()

  const renderCurrentPage = () => {
    switch (currentView) {
      case "settings":
        return <SettingsPage />
      case "home":
      default:
        return <StarterHomePage />
    }
  }

  return (
    <AppShell title="1health App" navItems={navItems}>
      {renderCurrentPage()}
    </AppShell>
  )
}
