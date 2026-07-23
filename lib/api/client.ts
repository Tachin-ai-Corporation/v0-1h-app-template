/**
 * =============================================================================
 * 1health API — shared client helper
 * =============================================================================
 *
 * Every `lib/api/*.ts` module is built on top of `authFetch` (Bearer token +
 * automatic 401 refresh/retry, see `lib/auth-client.ts`). This module distills
 * the repeated try/parse/error boilerplate into one place so a new module can be
 * written in a few lines and behave consistently.
 *
 * Two return conventions, both used across 1health apps:
 *   - `ApiResponse<T>`  — the default. Success/error is explicit and the UI can
 *                         always show `error`. Prefer this for anything a user
 *                         sees the result of (writes, submits, most reads).
 *   - `T | null`        — only for trivial internal reads where "failed" and
 *                         "not found" are equivalent to the caller.
 *
 * See docs/api/CONVENTIONS.md for the module-authoring recipe.
 * =============================================================================
 */

import { authFetch, getOneHealthBaseUrl } from "@/lib/auth-client"

/** Standard result envelope returned by every API module function. */
export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
  /** HTTP status of the underlying call, when there was one. */
  statusCode?: number
}

/** Build a success envelope. */
export function ok<T>(data: T, statusCode?: number): ApiResponse<T> {
  return { success: true, data, statusCode }
}

/**
 * Build an error envelope and log it with a `"<module>/<fn>"` context tag.
 * `context` shows up in the console so failures are greppable to their origin.
 */
export function err(error: unknown, context: string, statusCode?: number): ApiResponse<never> {
  const message = error instanceof Error ? error.message : String(error)
  console.error(`[1health API] ${context}:`, error)
  return { success: false, error: message, statusCode }
}

/**
 * The canonical JSON call. Resolves the base URL fresh (never cache it — it can
 * change at runtime with env/tenant), routes through `authFetch`, reads the body
 * defensively (some endpoints return an empty body on success), and wraps
 * everything in an `ApiResponse<T>`.
 *
 * `path` must start at the API root, e.g. `/api/v2/query`. Do NOT pass a full
 * URL — the base URL is prepended for you.
 *
 * @example
 * const res = await callApi<UserInfo>("user/fetchMyself", "/api/v2/user/myself")
 * if (res.success) use(res.data)
 */
export async function callApi<T = unknown>(
  context: string,
  path: string,
  init: RequestInit = {},
): Promise<ApiResponse<T>> {
  try {
    const baseUrl = getOneHealthBaseUrl()
    const response = await authFetch(`${baseUrl}${path}`, init)
    const text = await response.text()

    if (!response.ok) {
      console.error(`[1health API] ${context}:`, response.status, text)
      return { success: false, error: `${context} failed (${response.status})`, statusCode: response.status }
    }

    // Success may carry JSON, a bare string, or nothing at all.
    let data: unknown = undefined
    if (text) {
      try {
        data = JSON.parse(text)
      } catch {
        data = text
      }
    }
    return { success: true, data: data as T, statusCode: response.status }
  } catch (error) {
    return err(error, context)
  }
}

/**
 * Escape hatch for non-JSON responses (file downloads / blobs) or when you need
 * the raw `Response` (custom header reads, streaming). Still resolves the base
 * URL and goes through `authFetch`; throws `SessionExpiredError` on auth failure.
 */
export async function callApiRaw(path: string, init: RequestInit = {}): Promise<Response> {
  const baseUrl = getOneHealthBaseUrl()
  return authFetch(`${baseUrl}${path}`, init)
}
