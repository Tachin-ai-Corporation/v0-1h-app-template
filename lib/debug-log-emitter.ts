/**
 * =============================================================================
 * DEBUG LOG EMITTER (SERVER-SIDE)
 * =============================================================================
 *
 * Server-side singleton EventEmitter for broadcasting API debug logs.
 * Used by SSE endpoint to stream logs to connected clients.
 *
 * Only active when NEXT_PUBLIC_ENABLE_DEBUG_STREAM=true
 * =============================================================================
 */

import { EventEmitter } from "events"

export interface DebugLogEntry {
  id: string
  timestamp: string
  type: "request" | "response" | "error" | "info"
  source: "auth" | "token-exchange" | "token-refresh" | "api-call"
  method?: string
  url?: string
  headers?: Record<string, string>
  body?: string | object
  status?: number
  statusText?: string
  duration?: number
  error?: string
  metadata?: Record<string, unknown>
}

class DebugLogEmitter extends EventEmitter {
  private static instance: DebugLogEmitter | null = null

  private constructor() {
    super()
    this.setMaxListeners(100) // Allow many SSE connections
  }

  static getInstance(): DebugLogEmitter {
    if (!DebugLogEmitter.instance) {
      DebugLogEmitter.instance = new DebugLogEmitter()
    }
    return DebugLogEmitter.instance
  }

  emitLog(entry: Omit<DebugLogEntry, "id" | "timestamp">) {
    const fullEntry: DebugLogEntry = {
      ...entry,
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      timestamp: new Date().toISOString(),
    }
    console.log(
      `[v0] debugLogEmitter.emitLog - type: ${fullEntry.type}, source: ${fullEntry.source}, listenerCount: ${this.listenerCount("log")}`,
    )
    this.emit("log", fullEntry)
  }
}

export const debugLogEmitter = DebugLogEmitter.getInstance()

/**
 * Helper to emit a request log
 */
export function emitRequestLog(
  source: DebugLogEntry["source"],
  method: string,
  url: string,
  headers?: Record<string, string>,
  body?: string | object,
) {
  debugLogEmitter.emitLog({
    type: "request",
    source,
    method,
    url,
    headers: sanitizeHeaders(headers),
    body: sanitizeBody(body),
  })
}

/**
 * Helper to emit a response log
 */
export function emitResponseLog(
  source: DebugLogEntry["source"],
  method: string,
  url: string,
  status: number,
  statusText: string,
  headers?: Record<string, string>,
  body?: string | object,
  duration?: number,
) {
  debugLogEmitter.emitLog({
    type: "response",
    source,
    method,
    url,
    status,
    statusText,
    headers: sanitizeHeaders(headers),
    body: sanitizeBody(body),
    duration,
  })
}

/**
 * Helper to emit an error log
 */
export function emitErrorLog(source: DebugLogEntry["source"], error: string, metadata?: Record<string, unknown>) {
  debugLogEmitter.emitLog({
    type: "error",
    source,
    error,
    metadata,
  })
}

/**
 * Helper to emit an info log
 */
export function emitInfoLog(source: DebugLogEntry["source"], message: string, metadata?: Record<string, unknown>) {
  debugLogEmitter.emitLog({
    type: "info",
    source,
    body: message,
    metadata,
  })
}

/**
 * Sanitize headers to redact sensitive values
 */
function sanitizeHeaders(headers?: Record<string, string>): Record<string, string> | undefined {
  if (!headers) return undefined

  const sanitized = { ...headers }
  const sensitiveKeys = ["authorization", "cookie", "set-cookie", "x-api-key"]

  for (const key of Object.keys(sanitized)) {
    if (sensitiveKeys.includes(key.toLowerCase())) {
      const value = sanitized[key]
      if (value && value.length > 20) {
        sanitized[key] = `${value.substring(0, 10)}...[REDACTED:${value.length}]`
      }
    }
  }

  return sanitized
}

/**
 * Sanitize body to redact sensitive values and truncate large payloads
 */
function sanitizeBody(body?: string | object): string | object | undefined {
  if (!body) return undefined

  const MAX_LENGTH = 5000

  if (typeof body === "string") {
    // Redact tokens in URL-encoded bodies
    let sanitized = body
      .replace(/access_token=[^&]+/g, "access_token=[REDACTED]")
      .replace(/refresh_token=[^&]+/g, "refresh_token=[REDACTED]")

    if (sanitized.length > MAX_LENGTH) {
      sanitized = sanitized.substring(0, MAX_LENGTH) + `...[TRUNCATED:${body.length}]`
    }
    return sanitized
  }

  // For objects, try to redact sensitive fields
  const sanitized = JSON.parse(JSON.stringify(body))
  const sensitiveFields = ["access_token", "refresh_token", "password", "secret", "signature", "securityCode"]

  function redactObject(obj: Record<string, unknown>) {
    for (const key of Object.keys(obj)) {
      if (sensitiveFields.includes(key)) {
        const val = obj[key]
        if (typeof val === "string" && val.length > 10) {
          obj[key] = `${val.substring(0, 5)}...[REDACTED:${val.length}]`
        }
      } else if (typeof obj[key] === "object" && obj[key] !== null) {
        redactObject(obj[key] as Record<string, unknown>)
      }
    }
  }

  redactObject(sanitized)
  return sanitized
}
