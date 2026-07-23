# Reading data: the query engines

Two mechanisms. Pick the right one:

| Use `/api/v2/query` when… | Use a grid endpoint when… |
|---|---|
| You need a specific entity and its related entities | You're replicating a server-defined table/list view |
| You want to choose exactly which attributes/relationships | You want the pre-flattened rows the platform already assembles |
| Ad-hoc / flexible reads | Paginated lists with simple column filters + sorting |

Code: [`lib/api/query.ts`](../../lib/api/query.ts), [`lib/api/grid.ts`](../../lib/api/grid.ts).

---

## Generic entity query — `POST /api/v2/query`

### Request

```jsonc
{
  "key": "Person",                       // data-object-type string
  "attributes": ["id", "firstName", "customData"],  // projection on the root entity
  "filter": "id==123",                   // RSQL filter (root attributes)
  "relationships": [                     // optional eager-load of related entities
    {
      "key": "Person.PersonHasInsurance.Insurance",  // Source.Edge.Target
      "attributes": ["id", "memberIdNumber"],
      "filter": "status==active",         // optional, scoped to the target entity
      "limit": 50
    }
  ],
  "limit": 1,
  "offset": 0
}
```

Run it with the typed helper:

```ts
import { runQuery, eq } from "@/lib/api"

const res = await runQuery({
  key: "Person",
  attributes: ["id", "firstName", "customData"],
  filter: eq("id", personId),
  limit: 1,
})
```

### RSQL operators

A filter is a string of clauses. Combine them with `and` (joins with `;`) and
`or` (joins with `,`, parenthesized). **Which operators are valid depends on the
attribute's `type`** — use `operatorsForType(type)` from
[schema discovery](SCHEMA-DISCOVERY.md) to drive a type-aware filter UI. Prefer
the builders (they quote correctly) over hand-writing strings.

**Equality & comparison**

| Helper | Produces |
|---|---|
| `eq(a, v)` / `neq(a, v)` | `a==v` / `a!=v` |
| `gt` / `ge` / `lt` / `le` | `a=gt=v` / `a=ge=v` / `a=lt=v` / `a=le=v` |
| `range(a, start, end)` | `a=ge=start;a=le=end` (inclusive) |
| `inList(a, [x, y])` | `a=in=(x,y)` |

**Text**

| Helper | Produces | Meaning |
|---|---|---|
| `ilike(a, term)` | `a=ilike='*term*'` | case-insensitive contains |
| `contains` / `containsI` | `a=c=v` / `a=ic=v` | substring (cs / ci) |
| `notContains` | `a=nc=v` | does not contain |
| `like(a, pat)` | `a=like=pat` | SQL pattern (`%`/`*`) |
| `re` / `nre` | `a=re=pat` / `a=nre=pat` | regex / negated |

**JSON / JSONB**

| Helper | Produces | Meaning |
|---|---|---|
| `jsonContains(a, json)` | `a=c='<json>'` | containment |
| `hasKey` / `hasAnyKey` / `hasAllKeys` | `a=hk='k'` / `a=hak=(k1,k2)` / `a=haak=(...)` | key checks |
| `pathExists` / `pathMatches` | `a=jpe='path'` / `a=jpm='expr'` | JSONPath |

```ts
import { and, eq, ilike, range } from "@/lib/api"

filter: and(eq("organizationId", orgId), ilike("lastName", term))   // orgId AND name~term
filter: range("created", "2026-01-01T00:00:00", "2026-12-31T23:59:59")
```

**Dynamic** (operator chosen at runtime, e.g. from a schema-driven UI):

```ts
import { buildFilter, operatorsForType } from "@/lib/api"

operatorsForType("DATETIME")   // ["==","!=","=gt=","=ge=","=lt=","=le=","range"]
buildFilter("birthDate", "range", "1990-01-01", "1999-12-31")
// => "birthDate=ge='1990-01-01';birthDate=le='1999-12-31'"
```

> `;` = AND, `,` = OR. Timestamps go in as `"YYYY-MM-DDTHH:mm:ss"`. The
> JSONPath/key operators expect single-quoted values — the builders handle it.

### Relationships (graph traversal)

`key` is a dot-path **`SourceType.EdgeName.TargetType`** (all three segments).
Nest `relationships` inside a relationship for multi-hop traversal. Prefer one
query with relationships over N follow-up calls.

### Response — mind the prefixes

```jsonc
{
  "data": [
    {
      "instanceId": 123,                       // numeric root id (always here)
      "attributes": {
        "ROOT.Person.id": 123,                  // root attrs: "ROOT.<Type>.<attr>"
        "ROOT.Person.customData": { "...": "..." }
      },
      "relationships": {
        "Person.PersonHasInsurance.Insurance": [   // keyed by the exact request key
          { "instance": { "attributes": {
              "PersonHasInsurance.Insurance.memberIdNumber": "M12345"
              //  ^ related attrs drop the LEADING source-type segment
          } } }
        ]
      }
    }
  ]
}
```

Two prefix rules (the helpers handle both):
- **Root** attributes → `ROOT.<Type>.<attr>`
- **Related** attributes → `<Edge>.<Target>.<attr>` (the leading `<Source>.` is dropped)

### Extracting values

```ts
import { runQueryRows, getRootAttr, findAttr, getRelated, getRelatedAttr, parseCustomData } from "@/lib/api"

const rows = await runQueryRows({ key: "Person", attributes: ["id", "customData"], filter: eq("id", id), limit: 1 })
const row = rows[0]

// exact-key read (you know the type)
const cd = parseCustomData(getRootAttr(row, "Person", "customData"))

// prefix-agnostic read (recommended default — robust to prefix drift)
const first = findAttr<string>(row, "firstName")

// related entities
for (const ins of getRelated(row, "Person.PersonHasInsurance.Insurance")) {
  const member = getRelatedAttr<string>(ins, "PersonHasInsurance", "Insurance", "memberIdNumber")
}
```

> `parseCustomData` is important: `customData` sometimes comes back as a JSON
> **string** rather than an object.

### Pagination

`/api/v2/query` is **offset-based** (`limit`/`offset`) and exposes **no
`lastPage`/`totalElements`** you can rely on. To fetch everything, loop until a
short page:

```ts
import { runQueryAll } from "@/lib/api"
const all = await runQueryAll({ key: "Organization", attributes: ["id", "name"] }, 100)
```

---

## Grid endpoints — `POST /api/v3/health/grid/<view>`

Pre-flattened rows for a server-defined view (e.g. `journey`). Different request
and response shape from `/query` — **do not** reuse a `/query` mapper here.

### Request / response

```ts
import { runGridQuery } from "@/lib/api"

const res = await runGridQuery<MyRow>("journey", {
  filterBy: [
    { key: "workflowCampaignId", value: campaignId, operator: "equals" }, // scope first
    { key: "status", value: "In Progress", operator: "equals" },
  ],
  orderBy: [{ key: "updated", order: "DESC" }],
  page: 0,
  size: 25,
})
// res.data => { data: MyRow[], pageNumber, pageSize, totalElements, totalPages, lastPage, ... }
```

Operators: `equals` · `contains` · `greaterThan` · `lessThan` · `in`. Rows are
flat (plain field names, no `ROOT.` prefixes).

### Fetch all pages

```ts
import { fetchAllGridPages } from "@/lib/api"
const rows = await fetchAllGridPages<MyRow>(
  "journey",
  { filterBy: [{ key: "workflowCampaignId", value: campaignId, operator: "equals" }], size: 100 },
  (loaded, total) => console.log(`${loaded}/${total}`),
)
```

A grid view is almost always **pre-scoped by an id** — pass it as the first
`filterBy` entry.

---

## Which one, again?

- Point lookup / entity + relationships / custom projection → **`/api/v2/query`**.
- A known list view with column filters + sort + pagination → **grid**.
- Complex reads the platform exposes only via GraphQL (rare) → `POST /api/graphql`
  (a third path; not wrapped here — use `callApiRaw` if you need it).

See also [GOTCHAS.md](GOTCHAS.md) for query-specific traps (prefix drift,
unreliable server-side filters on nested JSON, pagination param inconsistency).
