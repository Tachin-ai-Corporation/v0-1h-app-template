import type React from "react"
import type { Metadata } from "next"
import { Suspense } from "react"
import { Inter } from "next/font/google"
import "./globals.css"
import { ToasterWrapper } from "@/components/toaster-wrapper"
import { NavigationProvider } from "@/contexts/navigation-context"

// 1health design system typeface. `variable` feeds --font-inter, which
// globals.css maps onto Tailwind's font-sans (see @theme inline).
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
})

export const metadata: Metadata = {
  title: "1health App Starter",
  description: "Greenfield starter template for building 1health platform applications",
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
  // To enable the command-center dark theme, add `dark` to this className.
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <body className="font-sans antialiased">
        <NavigationProvider>
          <Suspense fallback={<div className="flex items-center justify-center min-h-screen">Loading...</div>}>
            {children}
          </Suspense>
          <ToasterWrapper />
        </NavigationProvider>
      </body>
    </html>
  )
}
