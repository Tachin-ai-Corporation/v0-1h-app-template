# Workflows: campaigns, journeys, and steps

Workflows are how 1health models multi-step processes. This is the richest part
of the platform — and where most app logic lives.

Code: [`journey.ts`](../../lib/api/journey.ts),
[`journey-step.ts`](../../lib/api/journey-step.ts),
[`workflow-template.ts`](../../lib/api/workflow-template.ts).

## The hierarchy

```
Campaign  (you know its id, from tenant config)
  ├─ workflowTemplateGroup.published ─▶ WorkflowTemplate  (DESIGN-TIME: the one you author)
  └─ baseWorkflowTemplate ───────────▶ WorkflowTemplate  (CAMPAIGN BASE: a clone of the
       │                                 design-time one; NEW journeys copy from this)
       └─ rootNodes  (the step-tree DEFINITION — a linked list)
            └─ Step definition  ──▶ Step configuration (the field schema)

Journey = an INSTANCE of a template, started from a campaign
  └─ Steps  (the instance's own step list; one is "actionable")
       └─ Step Info  (schema + current values + files + canSubmit)
```

- **Campaign** — the handle you start journeys from. Campaigns **are** listable
  (`POST /api/v3/health/grid/workflow-campaign`) and template groups are findable
  by name — and an app can even **provision its own** template + campaign on a
  fresh tenant. See [PROVISIONING.md](PROVISIONING.md). Resolved campaign ids are
  commonly cached in `Organization.customData.appData.<appId>` to skip lookups on
  later runs.
- **A campaign points at TWO templates** (both on its GET —
  `GET /api/v2/health/workflow-campaign/{id}`): `workflowTemplateGroup.published`
  is the **design-time** template you author; `baseWorkflowTemplate` is the
  **campaign base** — a *clone* minted for this campaign that its journeys copy
  from (`baseWorkflowTemplate.designTimeWorkflowTemplateId` points back to the
  design-time id). They're different ids. `previousBaseWorkflowTemplates[]` is the
  roll-forward history. This is the [four-layer clone model](PROVISIONING.md#the-four-template-layers-where-you-edit-matters)
  seen from a campaign — pick the layer by what you're doing:
  `resolveTemplate()` → design-time (what you edit); `resolveCampaignTemplates()`
  → the base clone (what a campaign's journeys actually run).
- **Journey** — the running instance. Quirk: in the [query engine](QUERY.md) a
  journey is typed **`"WorkflowTemplate"`** (same name as the definition) —
  distinguish by the attributes present (`workflowCampaignId`, `status`,
  `customData`), not by the type name.
- **Step** — typed `"WorkflowTemplateStep"`. Steps are a (possibly branching)
  **sequence**, not a free DAG. Treat a journey as a state machine exposing
  "current step" + "next step", not a graph to traverse.

> **Editing a template's config?** Templates are cloned down **four layers**
> (global shared → tenant template → campaign base → per-journey); *which layer
> you edit* determines the scope of the change. This matters for anything stored
> in template config — including notification/webhook/email settings. See
> [PROVISIONING.md § the four template layers](PROVISIONING.md#the-four-template-layers-where-you-edit-matters).

## Discovering a step's field schema

Two ways, depending on whether you have a running journey yet:

```ts
// (a) From the template (schema only, no instance data) — before a journey exists:
import { resolveTemplate, fetchStepConfiguration, getDynamicFields } from "@/lib/api"
const t = await resolveTemplate(campaignId)                     // campaign → group → template
const cfg = await fetchStepConfiguration(t.data!.workflowTemplateId, stepDefId)
const fields = getDynamicFields(cfg.data)

// (b) From the journey instance (schema + current values) — the common case:
import { fetchStepInfo, getDynamicFields } from "@/lib/api"
const info = await fetchStepInfo(journeyId, stepId)
const fields = getDynamicFields(info.data?.configuration)
```

Each field is a [`DynamicField`](../../lib/api/types.ts): `{ label, type,
fieldIdentifier, value?, options?, requiredToSave?, requiredToComplete?, … }`.
**Resolve fields by `label`; never hardcode `fieldIdentifier`** — see
[DATA-MODEL.md § Attributes](DATA-MODEL.md#attributes-two-meanings).

## Retrieving a template's step-tree (dynamically)

`GET /api/v2/health/workflow-template/{id}` returns the template's `rootNodes` —
the step-tree definition as a linked list (each node nests its successor via
`.node`). Use it to walk a campaign's steps *without* a running journey (e.g. to
render a config UI or resolve a step id by name):

```ts
import {
  resolveCampaignTemplates, fetchWorkflowTemplate, flattenTemplateNodes,
  fetchStepConfiguration, getDynamicFields,
} from "@/lib/api"

// 1. Which template do this campaign's journeys actually run? → the CAMPAIGN BASE clone.
const refs = await resolveCampaignTemplates(campaignId)
const templateId = refs.data!.baseWorkflowTemplateId!   // not the design-time id

// 2. Fetch its definition and linearize the node chain.
const tpl = await fetchWorkflowTemplate(templateId)
const steps = flattenTemplateNodes(tpl.data?.rootNodes)  // [{ id, name, key, availableStepId }, …]

// 3. Any step's field schema (before a journey exists):
const cfg = await fetchStepConfiguration(templateId, steps[1].id)
const fields = getDynamicFields(cfg.data)
```

> `flattenTemplateNodes` follows the single-successor `.node` chain (the common
> linear case). Branching/decision templates need their own traversal — inspect
> `key` / `metadata.nodeType`. `metadata` is canvas-only (position/style); ignore
> it for logic.
>
> **Which template id?** `resolveTemplate()` → design-time (the version you
> author/publish); `resolveCampaignTemplates()` → the campaign base clone (what a
> campaign's live journeys copy from). Reading the *live* config for a running
> campaign means the base clone.

## Journey lifecycle

```ts
import {
  createJourney, fetchJourneySteps, findActionableStep, fetchStepInfo,
  submitStepFields, resolveFieldsByLabel, getDynamicFields,
} from "@/lib/api"

// 1. Start a journey from a (config-resolved) campaign id.
const created = await createJourney(campaignId)
const journeyId = created.data!.id

// 2. Load its steps and find the actionable one.
const steps = await fetchJourneySteps(journeyId)
const step = findActionableStep(steps.data)!   // the step with canSubmit === true

// 3. Load that step's live fields + current values.
const info = await fetchStepInfo(journeyId, step.id)
const fields = getDynamicFields(info.data?.configuration)

// 4. Submit it (see recipes below). Submitting the actionable step ADVANCES the journey.
const ids = resolveFieldsByLabel(fields, { note: "Clinical Note" })
await submitStepFields(journeyId, step.id, fields, { [ids.note!]: "All clear" })

// 5. Re-fetch to see the new actionable step; repeat until journey.status is terminal.
```

There is **no separate "complete" call** — a valid submit of the actionable step
marks it done and advances the journey server-side. `requiredToSave` fields can
be saved as a draft; `requiredToComplete` fields block advancement until present.

You can also **seed the first step at creation** to skip a round trip:

```ts
await createJourney(campaignId, [{ key: "Choose member", data: { personId } }])
```

## Submitting steps — three recipes

All three POST to `…/journey/{journeyId}/step/{stepId}/submit`. Pick by what the
step looks like:

### Recipe A — plain JSON (built-in steps)

Some steps (entity pickers, id entry) take a fixed, well-known body — no dynamic
fields:

```ts
import { submitStep } from "@/lib/api"
await submitStep(journeyId, stepId, { personId: 123 })
```

### Recipe B — dynamic fields, no file  ← the common case

**The rule: echo *every* field back, mutate only the one(s) you changed.** It's
read-all → mutate → write-all, sent as `multipart` with `?attachment` (required
even without a file). `buildStepMetadata` (used internally) does the echo:

```ts
import { submitStepFields, resolveFieldsByLabel } from "@/lib/api"

const ids = resolveFieldsByLabel(fields, { action: "Select Action" })
await submitStepFields(journeyId, stepId, fields, { [ids.action!]: "Generate Notification PDF" })
```

Forgetting to pass the full `fields` array (so other fields get dropped) is the
most common bug — always hand it the fields you fetched.

### Recipe C — dynamic fields + a file

The file rides in its own multipart part, tagged with the file field's id:

```ts
import { submitStepWithFile, resolveFieldsByLabel } from "@/lib/api"

const ids = resolveFieldsByLabel(fields, { evidence: "Upload Evidence" })
await submitStepWithFile(journeyId, stepId, fields, ids.evidence!, file, /* other changes */ {})
```

Removing an uploaded file uses the same endpoint via `deleteStepFile(...)`
(delete-by-flag).

> Prefer the [`DynamicStepForm`](DYNAMIC-STEPS.md) component — it detects field
> types, renders inputs, and calls the right recipe for you.

## After submitting

Submits don't optimistically mutate anything client-side. Re-fetch to observe
the advance:

- **Synchronous writes** → `fetchJourneySteps` / `fetchStepInfo` again.
- **Async server-side work** (e.g. document/notification generation) → poll a
  lightweight endpoint (often the journey's `customData`) until a status field
  changes, then refetch once.

## Journey-level operations

```ts
import { updateJourneyStatus, assignUsersToJourneys, listJourneys } from "@/lib/api"

await listJourneys<MyRow>({ filterBy: [{ key: "workflowCampaignId", value: campaignId, operator: "equals" }] })
await updateJourneyStatus([journeyId], "On Hold")   // status strings are app/config-defined
await assignUsersToJourneys([journeyId], [userId])  // note: array-wrapped body
```

## Campaign dashboard (KPIs)

A campaign-level rollup of its journeys' counts by status — the numbers behind
the campaign detail screen. The `total[]` array mixes per-status buckets with a
`"Total"` bucket; `dashboardCountsByStatus` flattens it to a `{ status: number }`
map.

```ts
import { fetchCampaignDashboard, dashboardCountsByStatus } from "@/lib/api"

const dash = await fetchCampaignDashboard(campaignId)             // { calendar: "week", journeyTags: [], steps: [] }
const counts = dashboardCountsByStatus(dash.data)
// → { "In Progress": 7, Completed: 81, Cancelled: 684, "On Hold": 0, Total: 772 }

// Optional filters: narrow to label-tag ids and/or step ids, change the calendar bucket.
await fetchCampaignDashboard(campaignId, { calendar: "month", journeyTags: [tagId], steps: [stepId] })
```

## Attachments & comments

```ts
import { fetchJourneyDocuments, uploadStepAttachment, downloadFile, deleteFile } from "@/lib/api"
import { fetchJourneyComments, postJourneyComment } from "@/lib/api"

await fetchJourneyDocuments(journeyId)         // all files, grouped by step
await uploadStepAttachment(stepId, file)       // free-standing step attachment
const dl = await downloadFile(fileId)          // { blob, filename }

await postJourneyComment(journeyId, "Called PCP office.")  // body wraps an array
await fetchJourneyComments(journeyId)
```

Two file mechanisms coexist: a step's `fileUpload` **dynamic field** (Recipe C,
through step submit) vs. a **free-standing attachment** (`uploadStepAttachment`).
They surface in different places — see [GOTCHAS.md](GOTCHAS.md).

## Building the UI

Rendering a step's fields and submitting them is fully generic — see
[DYNAMIC-STEPS.md](DYNAMIC-STEPS.md) and the `DynamicStepForm` component.
