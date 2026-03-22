"use client"

/**
 * Session Context
 *
 * Provides the current user (from /myself) and tenant configuration
 * (from /tenant/sys-config) to the entire app. Uses SWR for request
 * deduplication and caching - prevents duplicate API calls even with
 * React Strict Mode or multiple consumers.
 *
 * Usage:
 *   // Wrap your app (done in home-page-client.tsx)
 *   <SessionProvider>{children}</SessionProvider>
 *
 *   // Consume anywhere
 *   const { user, tenant, isLoading, error, refresh } = useSession()
 */

import { createContext, useContext, type ReactNode } from "react"
import useSWR from "swr"
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

// SWR fetcher for user data
async function userFetcher(): Promise<UserInfo | null> {
  const result = await fetchMyself()
  if (!result.success || !result.data) {
    throw new Error(result.error || "Failed to load user info")
  }
  return result.data
}

// SWR fetcher for tenant data - requires tenantId
async function tenantFetcher(tenantId: number): Promise<TenantConfig | null> {
  const result = await fetchTenantConfig(tenantId)
  if (!result.success || !result.data) {
    // Tenant fetch failure is non-fatal
    return null
  }
  return result.data
}

export function SessionProvider({ children }: { children: ReactNode }) {
  // Fetch user with SWR - deduplicates requests automatically
  const {
    data: user,
    error: userError,
    isLoading: userLoading,
    mutate: mutateUser,
  } = useSWR("session:user", userFetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    dedupingInterval: 2000, // Dedupe for 2 seconds - allows fresh fetches after POST
  })

  // Extract tenant ID from user data
  const tenantId = user?.tenantContext?.id ?? null

  // Fetch tenant with SWR - only when we have a tenantId
  const {
    data: tenant,
    isLoading: tenantLoading,
    mutate: mutateTenant,
  } = useSWR(
    tenantId ? `session:tenant:${tenantId}` : null, // null key = don't fetch
    () => tenantFetcher(tenantId!),
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: 2000,
    }
  )

  const isLoading = userLoading || (!!tenantId && tenantLoading)
  const error = userError ? (userError as Error).message : null

  const refresh = async () => {
    await mutateUser()
    await mutateTenant()
  }

  return (
    <SessionContext.Provider
      value={{
        user: user ?? null,
        tenant: tenant ?? null,
        isLoading,
        error,
        refresh,
      }}
    >
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
