"use client"

import { Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"
import { Button } from "@/components/ui/button"
import { useEffect, useState } from "react"

export function ThemeToggle({ collapsed = false }: { collapsed?: boolean }) {
  const { setTheme, resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  // Avoid hydration mismatch
  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <div className={collapsed ? "flex justify-center" : ""}>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-sidebar-foreground hover:bg-sidebar-accent"
          disabled
        >
          <Sun className="h-4 w-4" />
        </Button>
      </div>
    )
  }

  const isDark = resolvedTheme === "dark"

  const toggleTheme = () => {
    setTheme(isDark ? "light" : "dark")
  }

  return (
    <div className={collapsed ? "flex justify-center" : ""}>
      <Button
        variant="ghost"
        size={collapsed ? "icon" : "default"}
        onClick={toggleTheme}
        className={`h-8 text-sidebar-foreground hover:bg-sidebar-accent ${collapsed ? "w-8" : "w-full justify-start gap-2 px-3"}`}
        title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      >
        {isDark ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
        {!collapsed && <span className="text-sm">{isDark ? "Dark Mode" : "Light Mode"}</span>}
      </Button>
    </div>
  )
}
