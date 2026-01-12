"use client"

import { useState, useEffect, Suspense } from "react"
import { ChevronLeft, ChevronRight, LayoutDashboard, UserSearch, Grid3X3, Settings, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Header } from "@/components/header"
import { useSessionExpired } from "@/hooks/use-session-expired"
import { ThemeToggle } from "@/components/theme-toggle"
import { useNavigation } from "@/contexts/navigation-context"
import { AuthExitDialog } from "@/components/auth-exit-dialog"
import { SettingsPage } from "@/components/settings-page"
import { isSystemAdminAction } from "@/app/actions/user-actions"
import type { NavItem } from "@/components/app-shell"
import { HomePage } from "@/components/pages/home-page"
import { PatientSearchPage } from "@/components/pages/patient-search-page"
import { CampaignGridPage } from "@/components/pages/campaign-grid-page"
import { PatientDetailsPage } from "@/components/pages/patient-details-page"
import { QueryBuilderPage } from "@/components/pages/query-builder-page"

// Define navigation items for the template app
const navItems: NavItem[] = [
  { name: "Home", key: "home", icon: LayoutDashboard },
  { name: "Patient Search", key: "patient-search", icon: UserSearch },
  { name: "Campaign Grid", key: "campaign-grid", icon: Grid3X3 },
  { name: "Query Builder", key: "query-builder", icon: Search },
]

export function HomePageClient() {
  const { currentView, setCurrentView, patientId, closePatient } = useNavigation()

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const [isSystemAdmin, setIsSystemAdmin] = useState(false)
  const [showSettings, setShowSettings] = useState(false)

  useSessionExpired()

  useEffect(() => {
    const checkAdmin = async () => {
      const isAdmin = await isSystemAdminAction()
      setIsSystemAdmin(isAdmin)
    }
    checkAdmin()
  }, [])

  const toggleSidebar = () => {
    setIsSidebarCollapsed(!isSidebarCollapsed)
  }

  const handleNavClick = (pageKey: string) => {
    setCurrentView(pageKey)
  }

  const renderCurrentPage = () => {
    switch (currentView) {
      case "home":
        return <HomePage />
      case "patient-search":
        return <PatientSearchPage />
      case "campaign-grid":
        return <CampaignGridPage />
      case "query-builder":
        return <QueryBuilderPage />
      default:
        return <HomePage />
    }
  }

  return (
    <div className="h-screen bg-background flex flex-col">
      <Header />

      <nav
        className={`fixed left-0 top-16 bottom-0 bg-sidebar border-r border-sidebar-border flex flex-col z-40 transition-all duration-300 ${
          isSidebarCollapsed ? "w-16" : "w-48"
        }`}
      >
        <div className="flex-1 p-2 pt-4 flex flex-col">
          <ul className={`space-y-1 ${isSidebarCollapsed ? "flex flex-col items-center" : ""}`}>
            {navItems.map((item) => {
              const IconComponent = item.icon
              return (
                <li key={item.key} className={isSidebarCollapsed ? "w-full flex justify-center" : "w-full"}>
                  <button
                    onClick={() => handleNavClick(item.key)}
                    className={`text-left px-3 py-2 rounded-md transition-colors text-sm ${
                      currentView === item.key
                        ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                        : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                    } ${isSidebarCollapsed ? "flex justify-center w-10" : "flex items-center gap-2 w-full"}`}
                    title={isSidebarCollapsed ? item.name : undefined}
                  >
                    {isSidebarCollapsed ? (
                      <IconComponent className="h-4 w-4" />
                    ) : (
                      <>
                        <IconComponent className="h-4 w-4" />
                        <span>{item.name}</span>
                      </>
                    )}
                  </button>
                </li>
              )
            })}
          </ul>
          <div className={`mt-auto ${isSidebarCollapsed ? "flex justify-center" : ""}`}>
            <ThemeToggle collapsed={isSidebarCollapsed} />
          </div>
        </div>
        <div className="p-2 border-t border-sidebar-border">
          <div className={`flex items-center ${isSidebarCollapsed ? "justify-center" : "justify-between"}`}>
            {isSystemAdmin && (
              <Button
                variant="ghost"
                size={isSidebarCollapsed ? "icon" : "default"}
                onClick={() => setShowSettings(true)}
                className={`h-8 text-sidebar-foreground hover:bg-sidebar-accent ${isSidebarCollapsed ? "w-8" : "justify-start gap-2 px-3"}`}
                title="Settings"
              >
                <Settings className="h-4 w-4" />
                {!isSidebarCollapsed && <span className="text-sm">Settings</span>}
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleSidebar}
              className={`h-8 w-8 text-sidebar-foreground hover:bg-sidebar-accent ${!isSystemAdmin ? "ml-auto" : ""}`}
              title={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {isSidebarCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </nav>

      <main
        className={`fixed top-16 bottom-0 right-0 transition-all duration-300 ${isSidebarCollapsed ? "left-16" : "left-48"} bg-gradient-to-b from-[#ECF0F8] to-[#788CB3] dark:from-slate-900 dark:to-slate-800`}
      >
        <div className="w-full h-full overflow-hidden relative">
          <Suspense fallback={<div className="flex items-center justify-center h-full">Loading...</div>}>
            <div className="w-full h-full">{renderCurrentPage()}</div>
          </Suspense>
        </div>
      </main>

      {/* Patient Details Overlay */}
      {patientId && (
        <div className="fixed inset-0 z-50 bg-background">
          <PatientDetailsPage personId={patientId} onBack={closePatient} />
        </div>
      )}

      {showSettings && (
        <div className="fixed inset-0 z-50 bg-background">
          <SettingsPage onClose={() => setShowSettings(false)} />
        </div>
      )}

      <AuthExitDialog />
    </div>
  )
}
