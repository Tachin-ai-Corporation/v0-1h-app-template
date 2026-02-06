"use client"

import { useState, Suspense, type ReactNode } from "react"
import { ChevronLeft, ChevronRight, Home, Settings, type LucideIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Header } from "@/components/header"
import { ThemeToggle } from "@/components/theme-toggle"
import { useNavigation } from "@/contexts/navigation-context"
import { AuthExitDialog } from "@/components/auth-exit-dialog"

export interface NavItem {
  name: string
  key: string
  icon: LucideIcon
}

interface AppShellProps {
  /** Application title shown in header */
  title?: string
  /** Navigation items for sidebar */
  navItems?: NavItem[]
  /** Content to render based on currentView */
  children: ReactNode
  /** Optional header slot for additional controls */
  headerSlot?: ReactNode
  /** Optional footer slot in sidebar */
  sidebarFooterSlot?: ReactNode
}

// Default navigation items - developers can override these
const defaultNavItems: NavItem[] = [
  { name: "Home", key: "home", icon: Home },
  { name: "Settings", key: "settings", icon: Settings },
]

export function AppShell({
  title = "1health App",
  navItems = defaultNavItems,
  children,
  headerSlot,
  sidebarFooterSlot,
}: AppShellProps) {
  const { currentView, setCurrentView } = useNavigation()
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)

  const toggleSidebar = () => {
    setIsSidebarCollapsed(!isSidebarCollapsed)
  }

  const handleNavClick = (pageKey: string) => {
    setCurrentView(pageKey)
  }

  return (
    <div className="h-screen bg-background flex flex-col">
      <Header title={title}>{headerSlot}</Header>

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
            {sidebarFooterSlot}
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleSidebar}
              className={`h-8 w-8 text-sidebar-foreground hover:bg-sidebar-accent ${!sidebarFooterSlot ? "ml-auto" : ""}`}
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
        <div className="w-full h-full overflow-auto relative">
          <Suspense fallback={<div className="flex items-center justify-center h-full">Loading...</div>}>
            <div className="w-full h-full">{children}</div>
          </Suspense>
        </div>
      </main>

      <AuthExitDialog />
    </div>
  )
}
