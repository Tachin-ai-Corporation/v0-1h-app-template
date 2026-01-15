import type React from "react"
import type { Metadata } from "next"
import { Suspense } from "react"
import "./globals.css"
import { ToasterWrapper } from "@/components/toaster-wrapper"
import { ThemeProvider } from "@/components/theme-provider"
import { NavigationProvider } from "@/contexts/navigation-context"

export const metadata: Metadata = {
  title: "1health App Template",
  description: "Generic 1health Front-End Application Template",
  icons: {
    icon: "/favicon.png",
  },
  generator: "v0.app",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="font-sans antialiased">
        <style>{`
          :root {
            --destructive-foreground: oklch(0.985 0 0);
            /* Made destructive color less saturated (softer red) */
            --destructive: oklch(0.65 0.18 27.325);
          }
          .dark {
            --destructive-foreground: oklch(0.985 0 0);
            /* Made destructive color less saturated (softer red) */
            --destructive: oklch(0.65 0.18 27.325);
          }
        `}</style>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <NavigationProvider>
            <Suspense fallback={<div className="flex items-center justify-center min-h-screen">Loading...</div>}>
              {children}
            </Suspense>
            <ToasterWrapper />
          </NavigationProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
