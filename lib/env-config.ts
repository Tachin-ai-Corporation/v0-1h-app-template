"use client"

/**
 * Environment configuration for 1Health Demo vs Production
 * 
 * This module handles:
 * - Auto-detection of environment from document.referrer
 * - Manual environment selection
 * - Persistent storage of environment choice
 * - Environment-specific URL and config retrieval
 */

export type OneHealthEnvironment = "demo" | "prod"

const ENV_COOKIE_NAME = "onehealth_env"
const ENV_COOKIE_MAX_AGE = 60 * 60 * 24 * 30 // 30 days

/**
 * Detects environment from referrer URL
 * - demo.1health.io -> demo
 * - app.1health.io -> prod
 * - Unknown -> null (requires manual selection)
 */
export function detectEnvironmentFromReferrer(referrer: string): OneHealthEnvironment | null {
  if (!referrer) return null
  
  try {
    const url = new URL(referrer)
    const hostname = url.hostname.toLowerCase()
    
    if (hostname.includes("demo.1health")) {
      return "demo"
    }
    if (hostname.includes("app.1health")) {
      return "prod"
    }
    // Generic 1health domain without demo/app prefix - default to prod
    if (hostname.includes("1health") && !hostname.includes("demo")) {
      return "prod"
    }
  } catch {
    // Invalid URL
  }
  
  return null
}

/**
 * Gets the stored environment from cookie
 */
export function getStoredEnvironment(): OneHealthEnvironment | null {
  if (typeof document === "undefined") return null
  
  const match = document.cookie.match(new RegExp(`(?:^|; )${ENV_COOKIE_NAME}=([^;]*)`))
  if (!match) return null
  
  const value = decodeURIComponent(match[1])
  if (value === "demo" || value === "prod") {
    return value
  }
  return null
}

/**
 * Stores the environment choice in a cookie
 */
export function setStoredEnvironment(env: OneHealthEnvironment): void {
  if (typeof document === "undefined") return
  
  const secure = window.location.protocol === "https:" ? "; Secure" : ""
  document.cookie = `${ENV_COOKIE_NAME}=${encodeURIComponent(env)}; path=/; max-age=${ENV_COOKIE_MAX_AGE}; SameSite=Lax${secure}`
}

/**
 * Clears the stored environment
 */
export function clearStoredEnvironment(): void {
  if (typeof document === "undefined") return
  document.cookie = `${ENV_COOKIE_NAME}=; path=/; max-age=0`
}

/**
 * Gets the 1Health API URL for the specified environment
 */
export function getApiUrl(env: OneHealthEnvironment): string {
  if (env === "demo") {
    return process.env.NEXT_PUBLIC_1H_URL_DEMO || "https://demo.1health.io"
  }
  return process.env.NEXT_PUBLIC_1H_URL_PROD || "https://app.1health.io"
}

/**
 * Gets the App ID for the specified environment
 */
export function getAppId(env: OneHealthEnvironment): string {
  if (env === "demo") {
    return process.env.APP_ID_DEMO || ""
  }
  return process.env.APP_ID_PROD || ""
}

/**
 * Gets the current environment, with auto-detection fallback
 * Returns null if no environment is set and can't be auto-detected
 */
export function getCurrentEnvironment(): OneHealthEnvironment | null {
  // First check stored environment
  const stored = getStoredEnvironment()
  if (stored) return stored
  
  // Try to detect from referrer
  if (typeof document !== "undefined" && document.referrer) {
    const detected = detectEnvironmentFromReferrer(document.referrer)
    if (detected) {
      setStoredEnvironment(detected)
      return detected
    }
  }
  
  return null
}

/**
 * Gets the 1Health API URL for the current environment
 * Throws if no environment is configured
 */
export function getCurrentApiUrl(): string {
  const env = getCurrentEnvironment()
  if (!env) {
    throw new Error("No 1Health environment configured. Please select Demo or Production.")
  }
  return getApiUrl(env)
}
