/**
 * =============================================================================
 * API DEBUG UTILITIES
 * =============================================================================
 *
 * Provides formatting utilities for logging 1health API requests/responses
 * to the browser console in a consistent, AI-agent readable format.
 *
 * Controlled by: NEXT_PUBLIC_ENABLE_DEBUG_STREAM environment variable
 *
 * =============================================================================
 */

export interface ApiDebugInfo {
  url: string
  method: string
  headers: Record<string, string>
  body?: unknown
  status: number
  statusText: string
  responseHeaders: Record<string, string>
  responseBody: string
  duration: number
}

const MAX_BODY_LENGTH = 5000
const SEPARATOR = "═".repeat(70)

/**
 * Check if debug logging is enabled
 */
export function isDebugEnabled(): boolean {
  return process.env.NEXT_PUBLIC_ENABLE_DEBUG_STREAM === "true"
}

/**
 * Truncates large payloads to prevent console flooding
 */
export function truncatePayload(data: unknown, maxLength: number = MAX_BODY_LENGTH): string {
  if (data === null || data === undefined) {
    return ""
  }

  // Handle binary/file data
  if (data instanceof FormData) {
    const fields = Array.from(data.keys())
    return `[FormData: ${fields.length} field(s) - ${fields.join(", ")}]`
  }

  let str: string
  if (typeof data === "string") {
    str = data
  } else {
    try {
      str = JSON.stringify(data, null, 2)
    } catch {
      str = String(data)
    }
  }

  // Check for binary content markers
  if (str.includes("�") || /[\x00-\x08\x0E-\x1F]/.test(str)) {
    return `[Binary data: ${str.length} bytes]`
  }

  if (str.length > maxLength) {
    return str.substring(0, maxLength) + `\n... [truncated ${str.length - maxLength} more characters]`
  }

  return str
}

/**
 * Generates a copy-pasteable cURL command from the request
 */
export function generateCurl(info: ApiDebugInfo): string {
  const parts: string[] = [`curl -X ${info.method} '${info.url}'`]

  // Add headers (excluding sensitive ones for display, but keeping them functional)
  for (const [key, value] of Object.entries(info.headers)) {
    if (key.toLowerCase() === "authorization") {
      // Truncate bearer token for readability
      const truncatedAuth = value.length > 50 ? value.substring(0, 50) + "..." : value
      parts.push(`  -H '${key}: ${truncatedAuth}'`)
    } else {
      parts.push(`  -H '${key}: ${value}'`)
    }
  }

  // Add body if present
  if (info.body && info.method !== "GET") {
    const bodyStr = typeof info.body === "string" ? info.body : JSON.stringify(info.body)
    if (bodyStr && !bodyStr.startsWith("[FormData")) {
      // Escape single quotes in the body
      const escapedBody = bodyStr.replace(/'/g, "'\\''")
      parts.push(`  -d '${truncatePayload(escapedBody, 1000)}'`)
    }
  }

  return parts.join(" \\\n")
}

/**
 * Formats the debug info into a readable, collapsible console log string
 */
export function formatApiDebug(info: ApiDebugInfo): string {
  const statusEmoji = info.status >= 200 && info.status < 300 ? "✓" : "✗"
  const urlPath = new URL(info.url).pathname

  const lines: string[] = [
    "",
    SEPARATOR,
    `[1HEALTH API] ${info.method} ${urlPath} (${info.status} ${info.statusText}) ${statusEmoji} - ${info.duration}ms`,
    SEPARATOR,
    "",
    "▸ cURL:",
    generateCurl(info),
    "",
  ]

  // Request body
  if (info.body && info.method !== "GET") {
    lines.push("▸ Request Body:")
    lines.push(truncatePayload(info.body))
    lines.push("")
  }

  // Response body
  lines.push("▸ Response Body:")
  const responseStr = truncatePayload(info.responseBody)
  // Try to pretty-print JSON
  try {
    const parsed = JSON.parse(info.responseBody)
    lines.push(truncatePayload(JSON.stringify(parsed, null, 2)))
  } catch {
    lines.push(responseStr)
  }

  lines.push("")
  lines.push(SEPARATOR)
  lines.push("")

  return lines.join("\n")
}

/**
 * Serializes debug info for transmission from server to client
 */
export function serializeDebugInfo(info: ApiDebugInfo): string {
  return JSON.stringify(info)
}

/**
 * Deserializes debug info received on the client
 */
export function deserializeDebugInfo(serialized: string): ApiDebugInfo | null {
  try {
    return JSON.parse(serialized) as ApiDebugInfo
  } catch {
    return null
  }
}
