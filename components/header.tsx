"use client"

import type React from "react"

interface HeaderProps {
  title?: string
  children?: React.ReactNode
}

export function Header({ title = "1health App", children }: HeaderProps) {
  return (
    <header className="bg-card border-b border-border px-6 h-16 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-semibold text-foreground">{title}</h1>
      </div>
      {children && <div className="flex items-center gap-2">{children}</div>}
    </header>
  )
}
