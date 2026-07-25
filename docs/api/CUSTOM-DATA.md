# Custom data

Every extensible instance (journey, organization, person, contact point, …)
carries one schemaless JSON field: `customData`. It's the platform's built-in
extension point — store app-specific fields there without schema changes.

Code: [`lib/api/custom-data.ts`](../../lib/api/custom-data.ts).

## Reading

`customData` is never fetched on its own — you read it as an attribute of its
owning instance via [`/api/v2/query`](QUERY.md). The helper wraps that:

```ts
import { readCustomData } from "@/lib/api"

const data = await readCustomData("Organization", orgId) // => Record<string, unknown>
```

(It queries `attributes: ["id", "customData"]`, then parses — remembering
`customData` may arrive as a JSON string.)

## Writing — `POST /api/v2/data/custom-data/bulk`

The bulk endpoint patches any instance. Two operations:

| Operation | Effect |
|---|---|
| `APPEND` | **Shallow (top-level-only) merge.** Top-level keys you omit are kept, but any key you send has its whole value **replaced** — nested objects are *not* deep-merged. |
| `REPLACE` | Overwrites the entire blob. |

```ts
import { appendCustomData, replaceCustomData, updateCustomData } from "@/lib/api"

// merge a TOP-LEVEL field (other top-level keys are kept)
await appendCustomData(orgId, { lastSyncedAt: "2026-07-23T00:00:00Z" })

// overwrite the whole blob
await replaceCustomData(orgId, { onlyThis: true })

// low-level (one or many instances at once)
await updateCustomData([
  { instanceId: orgId, customData: { a: 1 }, operation: "APPEND" },
  { instanceId: personId, customData: { b: 2 }, operation: "APPEND" },
])
```

> ⚠️ **APPEND does not deep-merge.** It merges only the *top* level: any key you
> include is overwritten wholesale — nested objects and all. So a partial write to
> a nested key silently drops that object's other fields. This is the #1 customData
> footgun; the next section is how to avoid it.

## Updating nested / namespaced data safely

Namespacing keeps apps from colliding: put your data under `appData.<yourAppId>`.
But because APPEND is shallow, a *partial* write to that namespace —
`{ appData: { <appId>: { phase: "x" } } }` — replaces the **entire** `appData`
object, wiping every other app's namespace **and** your own sibling keys
(`index`, prior fields, …). That's the footgun.

To update one nested field without losing its siblings, read → deep-merge
client-side → write the complete subtree. `mergeCustomData` does exactly that:

```ts
import { mergeCustomData, appData } from "@/lib/api"

// safe partial update of a namespaced field — siblings survive
await mergeCustomData("Organization", orgId, appData(appId, { phase: "x" }))
// customData.appData["<appId>"].phase = "x"   (…index and other apps preserved)
```

The first arg (`"Organization"`) is the owning object-type key — needed to read
the current blob before merging. `appId` is your application's own namespace key
(commonly `NEXT_PUBLIC_APP_ID`, defaulting to `"1"`) — **not** a 1health
object-type or attribute id.

**Rule of thumb:** flat top-level field → `appendCustomData`; anything nested →
`mergeCustomData`.

## Deleting a key (no delete verb)

There is no server-side key deletion. Remove a key by reading, dropping it, and
`REPLACE`-ing:

```ts
import { deleteCustomDataKeys } from "@/lib/api"
await deleteCustomDataKeys("Organization", orgId, ["staleKey", "anotherStaleKey"])
```

For nested keys, `readCustomData` → mutate the object → `replaceCustomData`.
Don't assume APPEND-ing a payload without a key removes it — it won't.

## When to use customData vs a real attribute

- **Real (schema) attributes** — platform-defined, queryable/filterable
  efficiently, typed. Use for first-class data the platform already models.
- **customData** — app-specific extras, audit fields, cross-workflow bookkeeping,
  config. Cheap and flexible, but filtering on deeply-nested `customData` in
  `/query` can be unreliable ([GOTCHAS.md](GOTCHAS.md)) — validate client-side
  when correctness matters.
