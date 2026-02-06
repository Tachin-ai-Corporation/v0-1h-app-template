"use client"

/**
 * Session Context
 *
 * Provides the current user (from /myself) and tenant configuration
 * (from /tenant/sys-config) to the entire app. Data is fetched once
 * on mount and cached for all downstream consumers via useSession().
 *
 * Usage:
 *   // Wrap your app (done in home-page-client.tsx)
 *   <SessionProvider>{children}</SessionProvider>
 *
 *   // Consume anywhere
 *   const { user, tenant, isLoading, error } = useSession()
 */

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react"
import { fetchMyself, type UserInfo } from "@/lib/api/user"
import { fetchTenantConfig, type TenantConfig } from "@/lib/api/tenant"

interface SessionState {
  user: UserInfo | null
  tenant: TenantConfig | null
  isLoading: boolean
  error: string | null
  /** Re-fetch both user and tenant data */
  refresh: () => Promise<void>
}

const SessionContext = createContext<SessionState | null>(null)

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserInfo | null>(null)
  const [tenant, setTenant] = useState<TenantConfig | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    // Step 1: fetch user
    const userResult = await fetchMyself()
    if (!userResult.success || !userResult.data) {
      setError(userResult.error || "Failed to load user info")
      setIsLoading(false)
      return
    }
    setUser(userResult.data)

    // Step 2: fetch tenant config using the user's tenant ID
    const tenantId = userResult.data.tenantContext?.id
    if (tenantId) {
      const tenantResult = await fetchTenantConfig(tenantId)
      if (tenantResult.success && tenantResult.data) {
        setTenant(tenantResult.data)
      }
      // Tenant fetch failure is non-fatal; user data is still available
    }

    setIsLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  return (
    <SessionContext.Provider value={{ user, tenant, isLoading, error, refresh: load }}>
      {children}
    </SessionContext.Provider>
  )
}

export function useSession(): SessionState {
  const ctx = useContext(SessionContext)
  if (!ctx) {
    throw new Error("useSession must be used within a <SessionProvider>")
  }
  return ctx
}
