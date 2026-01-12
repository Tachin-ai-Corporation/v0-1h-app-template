"use client"

import { useState, useEffect, useRef, useCallback } from "react"

interface UseFetchOptions {
  revalidateOnFocus?: boolean
  revalidateOnReconnect?: boolean
  keepPreviousData?: boolean
  dedupingInterval?: number
}

interface UseFetchReturn<T> {
  data: T | undefined
  error: Error | undefined
  isLoading: boolean
  mutate: () => void
}

const mutateCallbacks = new Map<string, () => void>()

/**
 * Custom data fetching hook to replace SWR
 * Provides similar functionality with caching and deduplication
 */
export function useFetch<T>(
  key: string | null,
  fetcher: (() => Promise<T>) | null,
  options: UseFetchOptions = {},
): UseFetchReturn<T> {
  const { keepPreviousData = true, dedupingInterval = 2000 } = options

  const [data, setData] = useState<T | undefined>(undefined)
  const [error, setError] = useState<Error | undefined>(undefined)
  const [isLoading, setIsLoading] = useState(false)

  const previousDataRef = useRef<T | undefined>(undefined)
  const lastFetchTimeRef = useRef<number>(0)
  const lastKeyRef = useRef<string | null>(null)
  const fetcherRef = useRef(fetcher)
  const isFetchingRef = useRef(false)
  const hasInitialFetchRef = useRef(false)

  // Update fetcher ref when it changes (don't trigger re-render)
  fetcherRef.current = fetcher

  useEffect(() => {
    console.log("[v0] useFetch key changed:", key ? key.substring(0, 80) + "..." : "null")
  }, [key])

  const fetchData = useCallback(
    async (forceKey?: string) => {
      const currentKey = forceKey || key

      console.log("[v0] useFetch fetchData called:", {
        currentKey: currentKey?.substring(0, 50),
        hasFetcher: !!fetcherRef.current,
        isFetching: isFetchingRef.current,
        hasInitialFetch: hasInitialFetchRef.current,
      })

      if (!currentKey || !fetcherRef.current) {
        console.log("[v0] useFetch - bailing: no key or fetcher")
        return
      }

      if (isFetchingRef.current) {
        console.log("[v0] useFetch - bailing: already fetching")
        return
      }

      const now = Date.now()

      // Deduplication: skip if same key was fetched recently (but not on initial fetch)
      if (
        hasInitialFetchRef.current &&
        currentKey === lastKeyRef.current &&
        now - lastFetchTimeRef.current < dedupingInterval
      ) {
        console.log("[v0] useFetch - bailing: deduplication")
        return
      }

      console.log("[v0] useFetch - proceeding with fetch")
      isFetchingRef.current = true
      setIsLoading(true)
      setError(undefined)
      lastKeyRef.current = currentKey
      lastFetchTimeRef.current = now
      hasInitialFetchRef.current = true

      try {
        const result = await fetcherRef.current()
        console.log("[v0] useFetch - fetch succeeded")
        setData(result)
        previousDataRef.current = result
      } catch (err) {
        console.log("[v0] useFetch - fetch failed:", err)
        setError(err instanceof Error ? err : new Error(String(err)))
        if (!keepPreviousData) {
          setData(undefined)
        }
      } finally {
        setIsLoading(false)
        isFetchingRef.current = false
      }
    },
    [key, dedupingInterval, keepPreviousData],
  )

  const mutate = useCallback(() => {
    console.log("[v0] mutate called, forcing refetch")
    lastFetchTimeRef.current = 0 // Reset deduplication
    hasInitialFetchRef.current = false // Reset initial fetch flag
    isFetchingRef.current = false // Reset fetching flag
    if (key) {
      fetchData(key)
    }
  }, [fetchData, key])

  useEffect(() => {
    if (key) {
      mutateCallbacks.set(key, mutate)
      return () => {
        mutateCallbacks.delete(key)
      }
    }
  }, [key, mutate])

  useEffect(() => {
    if (!key) {
      return
    }

    if (key !== lastKeyRef.current) {
      fetchData(key)
    } else if (!hasInitialFetchRef.current) {
      fetchData(key)
    }
  }, [key, fetchData])

  return {
    data: keepPreviousData && isLoading ? (previousDataRef.current ?? data) : data,
    error,
    isLoading,
    mutate,
  }
}

export function mutate(key?: string) {
  console.log("[v0] global mutate called with key:", key?.substring(0, 50))
  if (key) {
    const callback = mutateCallbacks.get(key)
    if (callback) {
      console.log("[v0] found callback for key, calling mutate")
      callback()
    } else {
      console.log("[v0] no callback found for key")
    }
  } else {
    // Mutate all
    console.log("[v0] mutating all callbacks")
    mutateCallbacks.forEach((callback) => callback())
  }
}
