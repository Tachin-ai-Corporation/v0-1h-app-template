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
| `APPEND` | Deep-merges into existing `customData` (preserves sibling keys). **Default choice.** |
| `REPLACE` | Overwrites the entire blob. |

```ts
import { appendCustomData, replaceCustomData, updateCustomData } from "@/lib/api"

// merge (keeps everything else)
await appendCustomData(orgId, { lastSyncedAt: "2026-07-23T00:00:00Z" })

// overwrite the whole blob
await replaceCustomData(orgId, { onlyThis: true })

// low-level (one or many instances at once)
await updateCustomData([
  { instanceId: orgId, customData: { a: 1 }, operation: "APPEND" },
  { instanceId: personId, customData: { b: 2 }, operation: "APPEND" },
])
```

## Namespacing: `appData.<appId>`

If the instance might be shared with other 1health apps, put your data under
`appData.<yourAppId>` so you never clobber another app's keys:

```ts
import { appendCustomData, appData } from "@/lib/api"

await appendCustomData(orgId, appData(appId, { settings: { theme: "dark" } }))
// => customData.appData["<appId>"].settings.theme = "dark"
```

`appId` is your application's own namespace key (commonly `NEXT_PUBLIC_APP_ID`,
defaulting to `"1"`) — **not** a 1health object-type or attribute id.

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
