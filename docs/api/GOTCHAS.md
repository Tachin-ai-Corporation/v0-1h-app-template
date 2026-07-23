# Platform gotchas

The non-obvious behaviors that will bite you. Code defensively around these —
the helpers in `lib/api/` already handle most, but you'll hit the rest when you
go beyond them.

## Identifiers & naming

- **"Attribute" is overloaded.** Schema attributes are strings you hardcode;
  step-field identifiers are per-environment GUIDs you resolve by `label`. Never
  hardcode a `fieldIdentifier`. → [DATA-MODEL.md](DATA-MODEL.md#attributes-two-meanings)
- **`fieldIdentifier` GUIDs differ across demo/prod/tenants** for the *same*
  field. Always resolve by `label` at runtime.
- **Type key ≠ REST path ≠ UI term.** `WorkflowTemplate` (query key) =
  `/api/v2/journey` (REST) = "Journey" (UI). Keep the mapping explicit.
- **A journey instance is typed `"WorkflowTemplate"`** in the query engine — same
  name as the definition. Distinguish by attributes present, not type name.
- **Numeric `instanceId` vs GUID `fieldIdentifier`** — two unrelated id systems
  that both get called "identifier." Don't mix them.

## Query responses

- **Root attributes are prefixed `ROOT.<Type>.<attr>`** even though you only
  asked for `<attr>`. A naive `attrs["name"]` returns `undefined`. Use
  `getRootAttr` / `findAttr`.
- **Related attributes drop the leading source segment:** request key
  `X.Edge.Y` → response prefix `Edge.Y.<attr>`. Use `getRelatedAttr`.
- **Prefix formatting isn't perfectly consistent** across call sites — prefer
  suffix matching (`findAttr`) when unsure.
- **`customData` may come back as a JSON string**, not an object. Always
  `parseCustomData`.
- **`/api/v2/query` exposes no reliable `totalElements`/`lastPage`.** Detect the
  last page by `rows.length < pageSize` (`runQueryAll` does this).
- **Server-side filters on deeply-nested `customData` can be unreliable** — a
  filter may "match" rows it shouldn't. Re-validate client-side when correctness
  matters.

## Pagination

- **Param naming is inconsistent** across endpoints: the journey grid wants
  `page` + `limit` + `size` (all three); the comment grid wants `page` + `size`.
  Check per endpoint (the wrappers send what each needs).

## Workflows & steps

- **No "complete" call** — submitting the actionable (`canSubmit`) step advances
  the journey. `requiredToSave` vs `requiredToComplete` gate save-draft vs
  advance.
- **Dynamic-field submits must echo ALL fields**, mutating only what changed
  (read-all → mutate → write-all). Dropping a field can silently blank it
  server-side. `buildStepMetadata` handles the echo.
- **`?attachment` is required for ANY dynamic-fields submit** — even with no
  file. The distinguishing factor is payload *shape* (flat JSON vs `{metadata}`),
  not file presence.
- **`GET /api/v2/journey/{id}` sometimes returns an array**, sometimes a bare
  object. `fetchJourney` unwraps; do the same if you call it raw.
- **Journey status spelling is inconsistent** (`"Complete"` vs `"Completed"`
  across endpoints). Normalize before comparing.
- **Due dates are per-STEP, not per-journey.** The grid summary surfaces a
  derived `nextWorkflowStepDueDate` for convenience — that's read-only; write to
  the step.
- **Assignment/comment bodies are array-wrapped** even for one item:
  `assign-users` → `[{ journeyIds, userIds }]`; comment → `{ comments: [{ content }] }`.
- **Two file mechanisms:** a step's `fileUpload` dynamic field (submitted through
  step submit, Recipe C) vs. a free-standing attachment
  (`/health/type/.../relation/.../file/upload`). They appear in different places
  (`GET …/step/{id}/info` field vs `GET …/documents`).
- **Campaigns & template groups ARE listable / provisionable** (an earlier draft
  wrongly said otherwise). `POST /api/v3/health/grid/workflow-campaign` lists
  campaigns; `GET /api/v2/health/workflow-template-group/list?name=` finds groups;
  `…/published/list?name=` lists the shareable catalog. An app can find-or-clone
  its own workflow by name — see [PROVISIONING.md](PROVISIONING.md). Real caveats:
  **campaign creation is not idempotent** (check by name first), and there's no
  single "all campaigns for my app" call without a name/template filter. (Data
  object *types* are also discoverable — [SCHEMA-DISCOVERY.md](SCHEMA-DISCOVERY.md).)
- **Activation is required.** A newly created campaign must be `run`
  (`POST …/workflow-campaign/{id}/run`) before journeys can attach.
- **Publishing needs a cleaned node payload.** The draft GET returns rich nodes;
  the publish PUT wants a stripped shape (`getDraftTemplateConfig` handles it).
- **Which template layer you edit determines scope.** Templates clone down
  global → tenant → campaign base → per-journey, copying config at *creation*
  time. Editing a layer only affects instances created **after** the edit — a
  campaign-base edit changes future journeys (not existing ones); a tenant-template
  edit changes future campaigns (existing ones must be rolled forward explicitly).
  This is exactly how "notification/webhook/email settings" behave — they're
  template config at the campaign layer. See [PROVISIONING.md](PROVISIONING.md#the-four-template-layers-where-you-edit-matters).
- **Step-config read and write use different paths.** Read is template-scoped
  (`GET …/workflow-template/{templateId}/step/{stepId}/configuration`); write is
  step-scoped (`PUT …/workflow-template-step/{stepId}/configuration`) with a
  **multipart, partial** body (`rawData[0].data` = only the keys you're changing;
  the rest is preserved). Notifications and webhooks are saved in separate PUTs.
  Webhook `header` is a plain object (not an array); email `additionalEmails` is
  the recipient list; omit `id` on write. See [PROVISIONING.md](PROVISIONING.md#application-notification--webhook--email-config).

## Deletion

- **No general HTTP `DELETE`.** Deletion is a flag in a POST/PUT body
  (`{ delete: true }`, `idsToUnset`) or omission-then-`REPLACE` for `customData`.
  (`/api/v2/file/{id}` is the rare genuine DELETE.)

## Transport & environment

- **Always go through `authFetch`** (Bearer + refresh) and resolve the base URL
  per call. A raw `fetch` to a 1health endpoint will fail auth.
- **API version prefix is not uniform** — mostly `v2`, grid/list is `v3`,
  GraphQL has none. Don't derive paths from a single version constant.
- **API timestamps often have no timezone suffix.** Treat them as UTC (append
  `Z`) before parsing, or they'll misparse as local time.
- **A third read path exists (`POST /api/graphql`)** with its own request/response
  shape — don't conflate it with `/api/v2/query`. Use `callApiRaw` if you need it.

## Data hygiene

- **Delimited blobs in `customData`** (pipe-separated header/data row strings,
  etc.) have **non-stable column order** — resolve columns by header *name*,
  never by fixed index.
