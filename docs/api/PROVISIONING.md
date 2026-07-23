# Workflow provisioning & self-bootstrap

Some apps only work if a specific workflow **template** exists in the tenant.
Rather than requiring manual setup per client, an app can **provision itself on
any account** — by name, idempotently. This is the "define" side of workflows
(creating templates & campaigns), complementing [WORKFLOWS.md](WORKFLOWS.md)
(the "run" side).

Code: [`workflow-provisioning.ts`](../../lib/api/workflow-provisioning.ts),
[`campaign.ts`](../../lib/api/campaign.ts),
[`partnerships.ts`](../../lib/api/partnerships.ts).

## Concepts

| Term | Meaning |
|---|---|
| **Template group** | A named definition with `published` and/or `draft` version pointers. |
| **Published template** | A shared/**catalog** version, cloneable into any tenant. |
| **Draft template** | A tenant-local copy; must be published before a campaign can use it. |
| **Campaign** | The running instance users' journeys attach to. |

## The four template layers (where you edit matters)

A workflow template is **not one object** — it's **cloned down through four
layers**, and each layer's config is copied to the next **at creation time**. So
*which layer you edit* decides *what scope* the change has. This is the single
most important thing to understand before editing any template config.

```
GLOBAL SHARED   (published catalog)          cross-tenant, cloneable
      │  clone → into a tenant
TENANT TEMPLATE (template group)             one per tenant; has draft/published
      │  clone → when a campaign is created
CAMPAIGN BASE   (the campaign's template)    one per campaign
      │  clone → when a journey is created
PER-JOURNEY     (journey instance template)  one per journey
```

A journey instance is itself a `WorkflowTemplate` in the graph (see
[WORKFLOWS.md](WORKFLOWS.md)) — that's this bottom layer. Config flows
**downward at creation**; editing a layer only affects instances created **after**
the edit. Already-created lower instances keep the copy they were born with.

| Edit at this layer… | …changes | …does NOT change |
|---|---|---|
| **Global shared** (catalog) | future tenant clones | existing tenant templates |
| **Tenant template** | future campaigns created from it | existing campaigns¹ |
| **Campaign base** | future journeys created in that campaign | journeys already created |
| **Per-journey** | that one journey only | everything else |

¹ Existing campaigns can be **rolled forward** to the latest tenant-template
version if you want them to pick up the change (a platform update action), but
they don't inherit it automatically.

**Rule of thumb: edit at the lowest layer that covers the scope you intend.**

- One-off change for a single journey → edit the **journey** template.
- New default for everything a campaign creates from now on → edit the
  **campaign base**.
- New default across all future campaigns in the tenant → edit the **tenant
  template** (and optionally roll existing campaigns forward).

### Editing template config (vs. provisioning it)

- **Provisioning** (clone + publish) uses the endpoints in this doc (`/clone`,
  `PUT …/workflow-template/{id}?setAsPublished=true`).
- The template's **config** — its steps, fields, and settings — lives in the
  node/step configuration (`GET …/workflow-template/{id}/step/{stepId}/configuration`;
  see [WORKFLOWS.md](WORKFLOWS.md) and [DYNAMIC-STEPS.md](DYNAMIC-STEPS.md)). You
  edit it **on the template at the layer whose scope you want**: the campaign
  base for "all future journeys in this campaign," or a single journey's template
  for "just this one."

### Application: notification / webhook / email config

A common feature is letting a user set notification preferences (email
recipients, a webhook URL, alerts on download/rejection) from a
container/campaign screen. **Behind the scenes this is workflow-template config
on the campaign's base template — not a separate settings store.** Because it
lives on the campaign base:

- changing it updates the default for **all future journeys** in that campaign;
- a per-journey override touches **only that journey's** template;
- promoting it to the tenant template makes it the default for **all future
  campaigns**.

So "notification settings" is really "template config, edited at the campaign
layer." Concretely, they're **step subscriptions** — `notifications` (email) and
`webhooks` arrays on a step's configuration DTO. Verified against live 1health
captures and implemented in [`lib/api/step-config.ts`](../../lib/api/step-config.ts):

**Read** (2 calls) — campaign → step, then the step's config:

```ts
import { resolveCampaignSteps, fetchStepConfiguration } from "@/lib/api"

const s = await resolveCampaignSteps(campaignId)             // POST /query → templateId + steps
const step = s.data!.childSteps.find((x) => x.name === "…")  // pick the step that carries config
const cfg = await fetchStepConfiguration(s.data!.templateId, step!.id)
cfg.data!.notifications // StepNotification[]
cfg.data!.webhooks      // StepWebhook[]
```

`resolveCampaignSteps` traverses `WorkflowTemplate → root step → child step` and
returns the base `templateId` + step list; *which* step holds the config is
app-specific (pick by name). The read is **template+step-scoped**:
`GET …/workflow-template/{templateId}/step/{stepId}/configuration`.

**Write** — `PUT …/workflow-template-step/{stepId}/configuration`:

```ts
import { setStepNotificationEmails, setStepWebhook } from "@/lib/api"

await setStepNotificationEmails(step.id, cfg.data!.notifications ?? [], ["ops@acme.com"],
  { emailSubject: "New file", emailMessage: "…" })

await setStepWebhook(step.id, cfg.data!.webhooks ?? [], {
  endpointUrl: "https://example.com/hooks/1health",
  header: { "X-Api-Key": "…" },
  failureNotificationEmails: ["alerts@acme.com"],
})   // pass null to remove
```

Watch the asymmetry and the payload rules:

- The **write path is step-scoped** (no `templateId`), and the body is
  **multipart** — `rawData[0].data` = a JSON **partial** DTO. Only the top-level
  keys you send are updated; the server preserves the rest — so save
  `notifications` and `webhooks` in **separate** PUTs.
- **Email:** recipients are `additionalEmails: string[]`; `emailSubject`/
  `emailMessage` are **flat strings**; the backend validates sibling scalars
  (`notifyPatient`, `notifyCustomer`, `sendCompletionLink`, `smsMessage`,
  `completionButtonLabel`) on write — the helper round-trips them. One
  notification row per step config.
- **Webhook:** `header` is a **plain object** (`{name: value}`), not an array;
  `failureNotificationEmails` **is** an array; `method` = `POST`; `whenToExecute`
  = `["On Step Completion"]`; remove = PUT `{ "webhooks": [] }`.
- Both **omit `id`** on write (server reuses it) and preserve unknown fields via
  round-trip — the same "lookup current, change only what's needed" rule used
  across the API.

**Which layer?** Editing this on the **campaign base** step sets the default for
that campaign's future journeys; editing a **single journey's** step config
scopes to that one journey — exactly the [table above](#the-four-template-layers-where-you-edit-matters).

## The one call you usually want

`ensureWorkflow` runs the whole idempotent flow and hands back a usable campaign
id:

```ts
import { ensureWorkflow } from "@/lib/api"

const res = await ensureWorkflow({
  templateName: "myapp",                     // finds or clones the catalog template
  campaignName: `MyApp – ${partnerName}`,
  reuseExistingCampaign: true,               // don't create a duplicate campaign
  share: { partnerOrgId },                   // optional: share with a partner org
  campaign: { description: "…", labelTagIds: [] },
  onProgress: (p) => setStatus(p.message),   // finding → creating → activating → sharing → done
})

if (res.success) startJourney(res.campaignId!)
else showError(res.error)
```

## What it does (the bootstrap flow)

Each step is **check-then-act**, so re-running is safe:

```
1. Find local template group by name ───────────── exists? → use it
      GET /workflow-template-group/list?name=…            │ no ↓
2. Find published (catalog) group by name                 │
      GET /workflow-template-group/published/list?name=…  │
3. Clone it into the tenant                               │
      POST /workflow-template-group/{publishedId}/clone   │
4. Ensure a published version exists ◀────────────────────┘
      GET  /workflow-template-group/{groupId}   → {published, draft}
      if only draft:
        GET /workflow-template/{draftId}         → {rootNodes, stickyNotes}
        PUT /workflow-template/{draftId}?setAsPublished=true   (cleaned nodes)
5. Create a campaign      POST /workflow-campaign
6. Activate the campaign  POST /workflow-campaign/{id}/run?batchSize=33
7. (optional) Share       POST /workflow-campaign/{id}/share
```

`ensureTemplateGroup(name)` does steps 1–4 alone if you only need the group id;
the campaign helpers ([`campaign.ts`](../../lib/api/campaign.ts)) do 5–7.

## Endpoints

| Purpose | Method + path |
|---|---|
| Find local group by name | `GET /api/v2/health/workflow-template-group/list?page&size&name=` |
| Find published (catalog) group | `GET /api/v2/health/workflow-template-group/published/list?…name=` |
| Clone published → tenant | `POST /api/v2/health/workflow-template-group/{publishedId}/clone` |
| Group detail (`published`/`draft`) | `GET /api/v2/health/workflow-template-group/{groupId}` |
| Draft node config | `GET /api/v2/health/workflow-template/{draftId}` |
| Publish draft | `PUT /api/v2/health/workflow-template/{draftId}?setAsPublished=true` |
| Create campaign | `POST /api/v2/health/workflow-campaign` |
| Activate campaign | `POST /api/v2/health/workflow-campaign/{id}/run?batchSize=33` |
| Share campaign | `POST /api/v2/health/workflow-campaign/{id}/share` |
| List campaigns | `POST /api/v3/health/grid/workflow-campaign` |
| Fetch one campaign | `GET /api/v2/health/workflow-campaign/{id}` |
| List partner orgs | `GET /api/v2/organization/partnership?partnershipStatus=Approved&…` |

## Publishing: the clean-node round-trip

The publish endpoint wants a **minimal** node shape, but the draft GET returns a
rich one. So you read the draft, strip each node (recursively) to the
publishable fields, and PUT it back. `getDraftTemplateConfig` does this for you —
it returns nodes reduced to `{ id, nodeId, availableStepId, name, type, metadata,
node? }` with `id`/`nodeId` coerced to strings, which is exactly what
`publishDraftTemplate` needs.

## Campaign create / activate / share

```ts
import { createCampaign, activateCampaign, shareCampaignWithPartner } from "@/lib/api"

const c = await createCampaign({ name, workflowTemplateGroupId: groupId })  // startDate defaults to now
await activateCampaign(c.data!.id)                    // REQUIRED before use ("run")
await shareCampaignWithPartner(c.data!.id, partnerOrgId)  // Read access to a partner org
```

- **Create is not automatic-use** — a campaign must be **activated** (`run`)
  before journeys can attach.
- **Share** grants a partner org access: `{ targetAccessEntity: "Partner
  Organization", targetEntityId, shareAccess: "Read" }`. Resolve `partnerOrgId`
  via [`fetchPartnerships`](../../lib/api/partnerships.ts).

## Idempotency

| Step | Idempotent? |
|---|---|
| Find local group → skip clone | ✅ |
| Find published version → skip publish | ✅ |
| Create campaign | ❌ — **check first** (`findCampaignByName`) or pass `reuseExistingCampaign: true` |

Campaign creation makes a new campaign every call. To avoid duplicates, either
set `reuseExistingCampaign: true` on `ensureWorkflow`, or call
`findCampaignByName(name)` yourself before creating.

## "Which campaign?" — two strategies

Both are valid; they compose:

1. **Bootstrap-by-name (this doc).** Look up / provision by template name at
   runtime. Zero pre-config — works on a fresh client account. Best when the app
   must self-install.
2. **Cache ids in `customData`.** After resolving/creating once, store the
   campaign/template ids under `Organization.customData.appData.<appId>` (see
   [CUSTOM-DATA.md](CUSTOM-DATA.md)) and read them on subsequent runs to skip the
   lookups. Best for steady-state performance.

The common pattern: **bootstrap once, then cache the ids** — `ensureWorkflow`
provisions, and you persist `res.campaignId` / `res.workflowTemplateGroupId` into
`appData` for next time.

## Best practices

1. **Cache resolved ids** (in memory and/or `customData`) to avoid repeat lookups.
2. **Check for an existing campaign** before creating (`reuseExistingCampaign` /
   `findCampaignByName`) — creation isn't idempotent.
3. **Use descriptive campaign names** with context (partner, date) so
   name-based lookup and dedup are reliable.
4. **Give progress feedback** — `onProgress` emits `finding → cloning →
   publishing → creating → activating → sharing → done`; surface it during the
   multi-second first-run bootstrap.
5. **Handle `SESSION_EXPIRED`** (thrown by `authFetch`) by re-authenticating and
   retrying.

## Error cases

| Error | Cause | Resolution |
|---|---|---|
| `No published template group named "…"` | Catalog template not shared to tenant | Have 1health publish/share the template |
| Clone failed | Permissions | Check tenant permissions |
| Publish failed | Invalid node payload | Verify the draft's `rootNodes` structure |
| Activate failed | Template not published | Ensure the publish step ran |
