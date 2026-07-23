# Schema discovery (types, attributes, relationships)

**The 1health platform is introspectable at runtime.** You do not have to know
type names, attribute keys, or relationship edges ahead of time — you can fetch
them. This powers generic tooling (a query builder, an admin UI, an
export mapper) and lets you build `/query` requests with zero hardcoded strings.

Code: [`lib/api/schema.ts`](../../lib/api/schema.ts).

> This corrects an earlier note in these docs that said schema attributes have
> "no discovery endpoint." They do — the two endpoints below.

## Endpoints

| Endpoint | Method | Returns |
|---|---|---|
| `/api/v2/type/all` | GET | every data object type (summaries) |
| `/api/v2/type/key/{typeName}` | GET | one type's full definition: attributes + relationships |

```ts
import { fetchAllTypes, fetchTypeDetails } from "@/lib/api"

const all = await fetchAllTypes()               // ApiResponse<TypeSummary[]>
const person = await fetchTypeDetails("Person")  // ApiResponse<TypeDefinition> (cached)
```

## Shapes

**`TypeSummary`** (from `/type/all`)

| Field | Meaning |
|---|---|
| `boKey` | **the type key** — use this as a query's `key` |
| `name` | display name (may contain spaces) |
| `instancesCount` | how many rows exist |
| `id`, `description` | metadata |

**`TypeDefinition`** (from `/type/key/{name}`) adds `attributes[]` and
`relationships[]`.

**`TypeAttribute`**

| Field | Meaning |
|---|---|
| `attrKey` | **the string you put in `attributes` / `filter`** |
| `type` | `TEXT` · `STRING` · `INTEGER` · `DECIMAL` · `BOOLEAN` · `DATE` · `DATETIME` · `TIMESTAMP` · `VALUE_LIST` · `JSON` · `JSONB` … |
| `attributeValues[]` | enum options (present for `VALUE_LIST`) — `{ id, name }` |
| `isRequired`, `defaultValue`, `minLength`, `maxLength` | validation metadata |

**`TypeRelationship`**

| Field | Meaning |
|---|---|
| `relKey` | **the exact edge segment** for the relationship path — never hand-construct it |
| `direction` | `FORWARD` or `BACKWARDS` (relationships are traversable both ways) |
| `fromBoClassName` / `toBoClassName` | the two ends (display names; strip spaces for keys) |
| `name`, `reverseRelKey`, `inward`, `outward` | display / reverse metadata |

## Two things the metadata won't tell you directly

1. **Baseline attributes.** Every entity has `id`, `created`, `updated` — these
   are **not** in `attributes[]`. Prepend `BASELINE_ATTRIBUTES` when building a
   field picker.
2. **`boKey` vs `name`.** Use `boKey` (no spaces) as the query `key` and as path
   segments. Display names may have spaces; strip them (`name.replace(/\s+/g,"")`)
   — the helpers do this for you.

## Building a relationship path from metadata

The relationship `key` in a query is `{FromType}.{relKey}.{ToType}`. Resolve the
target end by direction and let the helper assemble it — **never fabricate the
`relKey`** by concatenating type names:

```ts
import { fetchTypeDetails, relationshipPath, getRelationshipTargetType } from "@/lib/api"

const person = (await fetchTypeDetails("Person")).data!
const rel = person.relationships.find((r) => r.name === "Insurance")!

relationshipPath("Person", rel)          // e.g. "Person.PersonHasInsurance.Insurance"
getRelationshipTargetType(rel)           // "Insurance"  (honors FORWARD/BACKWARDS)
```

## Type-aware filtering

Which operators are valid depends on the attribute's `type`. `operatorsForType`
gives you the right set (drive a filter dropdown off it), and
[`buildFilter`](QUERY.md#rsql-operators) serializes a chosen operator + value:

```ts
import { operatorsForType, buildFilter } from "@/lib/api"

operatorsForType("DATETIME")  // ["==","!=","=gt=","=ge=","=lt=","=le=","range"]
operatorsForType("VALUE_LIST") // ["==","!=","=c=","=nc=", ... ,"=in="]

buildFilter("birthDate", "range", "1990-01-01", "1999-12-31")
// => "birthDate=ge='1990-01-01';birthDate=le='1999-12-31'"
```

## Putting it together — a fully dynamic query

```ts
import { fetchTypeDetails, runQuery, buildFilter } from "@/lib/api"

const def = (await fetchTypeDetails("Person")).data!
const attrKeys = def.attributes.map((a) => a.attrKey)          // discovered projection

const res = await runQuery({
  key: def.boKey,
  attributes: ["id", ...attrKeys.slice(0, 5)],
  filter: buildFilter("lastName", "=ilike=", "*smith*"),
  limit: 25,
})
```

## Caching, dedup, lazy loading

`fetchTypeDetails` caches each `TypeDefinition` in-memory and dedupes concurrent
requests for the same type, so calling it repeatedly is cheap. Two patterns to
keep it fast:

- **Prefetch in parallel** when you know the types up front:
  `await prefetchTypeDetails(["Person", "Organization", "Insurance"])`.
- **Lazy-load relationships**: only call `fetchTypeDetails(targetType)` when a
  user actually expands a relationship — don't walk the whole graph eagerly.

`getCachedTypeDetails(name)` reads the cache synchronously; `clearTypeCache()`
forces a refresh.

## Discover vs. hardcode

Both are legitimate:

- **Discover** — for generic/dynamic tooling, admin UIs, or when you don't want
  to track schema by hand. It's a couple of cached GETs.
- **Hardcode** — for a fixed app, pin the handful of `attrKey`s you use in
  [`ATTRIBUTES`](../../lib/api/config.ts) to skip the round trip. Attribute keys
  are stable across environments, so this is safe.

## Relation to workflow step fields

This covers **schema attributes** of data object types. Workflow **step fields**
are a *different* runtime-discovered thing — per-environment `fieldIdentifier`
GUIDs fetched from a step's configuration and matched by `label`. See
[WORKFLOWS.md § Discovering a step's field schema](WORKFLOWS.md#discovering-a-steps-field-schema)
and [DATA-MODEL.md § Attributes](DATA-MODEL.md#attributes-two-meanings). Both are
discoverable; they just use different endpoints and different id kinds.
