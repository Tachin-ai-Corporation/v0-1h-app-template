# The 1health data model

Everything in 1health is a typed object in a graph. Get these four concepts
right and the rest of the API follows.

## 1. Data object types are string keys

A **type** is identified by a **PascalCase string name**, not a GUID:

```
"Person"   "Organization"   "WorkflowTemplate"   "ContactPoint"   "LabelTag"
```

You pass this string as the `key` to [`/api/v2/query`](QUERY.md) and to GraphQL.
You can either know the name up front (like a SQL table name) or **discover it
at runtime** — `GET /api/v2/type/all` lists every type and its `boKey`. See
[SCHEMA-DISCOVERY.md](SCHEMA-DISCOVERY.md).

Keep the type names your app uses in [`RECORD_TYPES`](../../lib/api/config.ts):

```ts
export const RECORD_TYPES = {
  person: "Person",
  organization: "Organization",
} as const
```

### The type's REST path ≠ its query key

The resource path for CRUD often differs from the query/GraphQL key. Don't
assume `key === path segment`:

| Query key (`/query`) | REST resource path | UI term |
|---|---|---|
| `WorkflowTemplate` | `/api/v2/journey` | "Journey" |
| `LabelTag` | `/api/v2/tag` | "Tag" |

Track the mapping explicitly in [`TYPE_REST_PATH`](../../lib/api/config.ts).

## 2. Instances are numeric ids

A row of a type is identified by a plain integer `id` (a.k.a. `instanceId` in
query responses) — **not** a GUID:

```
Person #48213    Organization #1099    Journey #96719653
```

## 3. Attributes — two meanings

This is the single most important distinction in the whole platform.

### (a) Schema attributes — strings, for `/query`

Field names on a type, written as plain strings in query `attributes` and
`filter`:

```ts
{ key: "Person", attributes: ["id", "firstName", "birthDate", "customData"], filter: "id==123" }
```

- They are **stable** across environments.
- You can **discover** them at runtime — `GET /api/v2/type/key/{type}` returns
  every attribute's `attrKey`, `type`, and enum options (see
  [SCHEMA-DISCOVERY.md](SCHEMA-DISCOVERY.md)) — **or** hardcode the few you use in
  [`ATTRIBUTES`](../../lib/api/config.ts) for a fixed app. Both are fine.

### (b) Dynamic step-field identifiers — GUIDs, resolved at runtime

Configurable form fields on a [workflow step](WORKFLOWS.md) are identified by a
**`fieldIdentifier` GUID**:

```jsonc
{ "label": "Procedure Code", "type": "customField.textEntry",
  "fieldIdentifier": "cd7fe0b7-9fe8-48ad-8821-94f8a7a5522b" }
```

- These GUIDs **differ between demo, prod, and tenants** for the *same* field.
- **Never hardcode them.** Fetch the step's configuration and resolve by the
  stable `label`:

  ```ts
  import { getDynamicFields, resolveFieldsByLabel } from "@/lib/api"
  const fields = getDynamicFields(stepInfo.configuration)
  const ids = resolveFieldsByLabel(fields, { code: "Procedure Code" })
  // ids.code === the GUID for THIS environment
  ```

If you only remember one rule: **schema attributes are stable strings (hardcode
or discover via `/type/key`); step-field identifiers are per-environment GUIDs
you always look up by label.**

## 4. customData — the extension point

Any extensible instance carries a single schemaless JSON field, `customData`.
It's not a separate addressable object — you read it as part of reading its
owner, and patch it via the [bulk custom-data endpoint](CUSTOM-DATA.md).

Namespace anything **your** app owns under `appData.<appId>` so multiple apps
sharing an instance don't clobber each other:

```jsonc
{ "appData": { "<yourAppId>": { "settings": { "theme": "dark" } } } }
```

## Deletion: there isn't a DELETE verb (mostly)

The platform models "delete" as:
- a **flag** in a POST/PUT body (`{ delete: true }`, `idsToUnset: [...]`), or
- **omission-then-resend** for `customData` (read the blob, drop the key,
  `REPLACE`).

`/api/v2/file/{id}` is the rare real `DELETE`. Everything else: don't reach for
`DELETE` — look for the flag. See [GOTCHAS.md](GOTCHAS.md).

## Related reading

- Query the graph → [QUERY.md](QUERY.md)
- Read/write `customData` → [CUSTOM-DATA.md](CUSTOM-DATA.md)
- Workflows & steps → [WORKFLOWS.md](WORKFLOWS.md)
