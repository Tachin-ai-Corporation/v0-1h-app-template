# Building step UIs (dynamically)

A workflow step's fields are **data, not code** — they come from the step's
configuration at runtime (labels, types, options, per-env GUIDs). So you render
them generically instead of hand-coding a form per step.

Component: [`components/workflow/dynamic-step-form.tsx`](../../components/workflow/dynamic-step-form.tsx).

## The generic renderer

`DynamicStepForm` takes a step's live `StepInfo`, renders one input per dynamic
field (dispatching on `field.type`), tracks values, validates
`requiredToComplete`, and submits via the correct [recipe](WORKFLOWS.md#submitting-steps-three-recipes)
(fields-only vs. fields+file).

```tsx
"use client"
import { useEffect, useState } from "react"
import { fetchStepInfo, type StepInfo } from "@/lib/api"
import { DynamicStepForm } from "@/components/workflow/dynamic-step-form"

export function StepPanel({ journeyId, stepId }: { journeyId: number; stepId: number }) {
  const [info, setInfo] = useState<StepInfo | null>(null)
  const load = () => fetchStepInfo(journeyId, stepId).then((r) => setInfo(r.data ?? null))
  useEffect(() => { load() }, [journeyId, stepId])

  if (!info) return <p>Loading…</p>
  return (
    <DynamicStepForm
      journeyId={journeyId}
      stepId={stepId}
      stepInfo={info}
      submitLabel="Save & continue"
      onSubmitted={load}   // re-fetch after submit to reflect the advance
    />
  )
}
```

That's the whole pattern: fetch → render → submit → refetch. No per-step code.

## How it maps `field.type` → widget

| `field.type` | Rendered as | Submitted value |
|---|---|---|
| `customField.textEntry` (and unknown types) | text input | string |
| `customField.date` | date input | ISO date string |
| `customField.select.dropdown` | `<select>` from `options` | option value |
| `customField.select.checkboxes` | checkbox group from `options` | `string[]` |
| `fileUpload` / `customField.fileUpload` | file input | file (Recipe C) |
| `customText` | read-only help text | — (no input) |

### Adding a new field type

Add a `case` to `renderField` in `dynamic-step-form.tsx`. Because submission
always echoes the full field set and mutates by `fieldIdentifier`, you only need
to render the input and store its value in `values[fieldIdentifier]`.

## Why data-driven (and not the "one component per step" approach)

Production 1health apps have historically dispatched on step **display-name
strings** and hand-built each widget. That works but is fragile:

- renaming a step in the workflow builder silently breaks the UI;
- every step re-implements find-field-by-label + echo-all-fields + submit;
- field widgets are duplicated.

Driving the UI off `field.type` + `fieldIdentifier` (as `DynamicStepForm` does)
removes all three problems. Reach for a bespoke component only when a step needs
genuinely custom UX (e.g. an embedded search, a multi-file review checklist) —
and even then, keep it a **controlled shell**: the parent owns the submit call,
the child only collects input and calls back.

## Post-submit behavior

- **Synchronous** steps: call `onSubmitted` → refetch step info / journey steps.
- **Async** steps (server generates a document/notification after submit): poll a
  lightweight endpoint (often the journey `customData`) until a status field
  flips, then refetch once — don't poll the full step-info endpoint per tick.

See [WORKFLOWS.md § After submitting](WORKFLOWS.md#after-submitting).

## Beyond the fields: journey chrome

Assignment, due dates, status changes, tags, comments, and attachments are
**journey-level** concerns, independent of step-body rendering. Build them as
separate components parameterized by `journeyId` (see the journey-level helpers
in [`journey.ts`](../../lib/api/journey.ts) and
[`attachments.ts`](../../lib/api/attachments.ts) /
[`comments.ts`](../../lib/api/comments.ts)).
