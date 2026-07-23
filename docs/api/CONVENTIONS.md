# API module conventions

How to add a new `lib/api/*.ts` module so it behaves like the rest. The pattern
is deliberately boring — consistency is the point.

## The building blocks

- [`authFetch`](../../lib/auth-client.ts) — the transport. Injects the Bearer
  token, auto-refreshes on 401 and retries once, throws `SessionExpiredError`
  when refresh fails, and skips the JSON `Content-Type` for `FormData`. **Never
  call `fetch` directly** for 1health endpoints.
- [`callApi`](../../lib/api/client.ts) — wraps `authFetch` + base-URL resolution
  + defensive body parsing + error logging into one call, returning
  `ApiResponse<T>`.
- `ApiResponse<T>` = `{ success; data?; error?; statusCode? }` — the standard
  return envelope.

## The skeleton

```ts
/**
 * <Entity> API
 *
 * URL Patterns:
 *   GET  /api/v2/<entity>/{id}   - fetch one
 *   POST /api/v2/<entity>        - create
 */
import { callApi, type ApiResponse } from "./client"
import { endpoints } from "./config"

// Public domain type (clean, camelCase, only what the app uses).
export interface EntityInfo {
  id: number
  name: string
}

// Fetch one — map the raw wire shape to the domain type inline.
export async function fetchEntity(id: number): Promise<ApiResponse<EntityInfo>> {
  const res = await callApi<Record<string, unknown>>("entity/fetchEntity", `/api/v2/entity/${id}`)
  if (!res.success || !res.data) return res as ApiResponse<EntityInfo>
  const raw = res.data
  return { success: true, data: { id: raw.id as number, name: (raw.name as string) ?? "" } }
}

// Create — return the envelope so callers can show errors.
export async function createEntity(input: { name: string }): Promise<ApiResponse<EntityInfo>> {
  return callApi<EntityInfo>("entity/createEntity", "/api/v2/entity", {
    method: "POST",
    body: JSON.stringify(input),
  })
}
```

Then re-export from the [barrel](../../lib/api/index.ts):

```ts
// lib/api/index.ts
export { fetchEntity, createEntity, type EntityInfo } from "./entity"
```

## Rules of the house

1. **Resolve the base URL per call.** `callApi` does this; if you drop to
   `callApiRaw`/`authFetch`, call `getOneHealthBaseUrl()` inside the function —
   never cache it at module scope (it can change with env/tenant at runtime).
2. **Centralize paths.** Add endpoint builders to
   [`config.ts`](../../lib/api/config.ts) rather than scattering path strings.
   Remember the version prefix isn't uniform (v2 vs v3 vs graphql).
3. **Two type layers when the wire differs from the app.** Export a clean domain
   type; keep the raw shape local and map inline (strip sentinels like `"n/a"`,
   rename fields, build composites).
4. **Return `ApiResponse<T>`** for anything a user sees the result of. Reserve
   `T | null` for trivial internal reads where "failed" == "not found".
5. **Name by verb intent:** `fetch`/`get` (read), `search` (filtered read),
   `create`, `update`, `upsert`, `is*` (derived boolean).
6. **Log with a `"<module>/<fn>"` context** (the first arg to `callApi`/`err`) so
   failures are greppable to their origin.
7. **Diff-based updates.** For update/upsert, send only changed fields + `id`
   (optionally diff against a passed-in snapshot) unless the endpoint requires a
   full-replacement PUT.
8. **FormData for multipart.** Build a `FormData` and pass it as `body`;
   `authFetch` handles the content-type/boundary. Don't set `Content-Type`
   yourself.

## Auth & environment (already wired in this template)

This template already ships:
- cookie-based tokens + `getOneHealthBaseUrl()` (base URL captured at `/auth`),
- `authFetch` with 401→refresh→retry, `SessionExpiredError`, refresh concurrency
  guard, and FormData handling,
- server-side token exchange (`/api/token`) and refresh (`/api/token/refresh`).

You normally don't touch these — just build API modules on top. If you're
integrating a different 1health launch/SSO handshake, the token-exchange route
is the only piece that changes; the cookie contract it writes stays the same.

See also [AUTH-ARCHITECTURE.md](../AUTH-ARCHITECTURE.md) and
[ACTION-PATTERNS.md](../ACTION-PATTERNS.md).
