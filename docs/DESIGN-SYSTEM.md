# 1health Design System

How this app looks, feels, and stays consistent — and how to rebrand it for a
different customer without losing the 1health user experience.

> **Canonical spec (source of truth):**
> <https://tachin-website.web.app/public/1health_design_system.md>
>
> This document is the _implementation_ of that spec for this codebase. When the
> two disagree, the spec wins — update this doc and `app/globals.css` to match.
> See [Keeping in sync](#keeping-in-sync-with-the-spec).

---

## 1. Philosophy

1health is a **healthcare command center**: calm, trustworthy, clinically
precise, operationally reliable. Every design choice serves enterprise trust and
user efficiency over visual novelty.

- The brand is always written lowercase: **`1health`**.
- Composition budget — aim for roughly:
  - **70% neutral** structure (graphite / slate / cloud)
  - **20% healthcare accent** (trust blue / teal / mint)
  - **5% action** (buttons, key CTAs)
  - **5% status** (success / warning / error signals)
- If a screen feels colorful, it's wrong. Color earns its place by carrying
  meaning.

---

## 2. The big idea: same feel, different brand

Different apps (and different customers) may want to **brand differently** —
their own primary color, their own accents — while keeping the **same structure,
spacing, motion, and interaction feel**. The token system is built in three
tiers precisely so you can do that by editing one small block.

```
┌─ Tier 1 · Reference palette ────────────────────────────────┐
│  Raw 1health named colors: --trust-blue, --graphite, ...     │  rarely touched
└──────────────────────────────────────────────────────────────┘
              │  referenced by
┌─ Tier 2 · Brand layer ──────────────────────────────────────┐
│  --brand-primary / --brand-secondary / --brand-tertiary /    │  ◀── REBRAND HERE
│  --brand-highlight                                           │
└──────────────────────────────────────────────────────────────┘
              │  referenced by
┌─ Tier 3 · Semantic tokens ──────────────────────────────────┐
│  --background, --foreground, --primary, --ring, --muted, ... │  light + dark
│  (this is all the components ever read)                      │
└──────────────────────────────────────────────────────────────┘
              │  exposed to Tailwind via @theme inline
        bg-primary  text-muted-foreground  ring-ring  ...
```

**What changes per brand:** the four `--brand-*` hues.
**What stays fixed (the "feel"):** the neutral ramp, spacing grid, type scale,
radius scale, elevation, motion curves, and — importantly — the **functional
status colors** (success/warning/error carry meaning and must be consistent
across every 1health app).

All tokens live in [`app/globals.css`](../app/globals.css).

---

## 3. Rebranding — the 30-second version

Open [`app/globals.css`](../app/globals.css), find **`TIER 2 · Brand layer`**,
and repoint the four variables. Everything else follows.

```css
/* Example: rebrand to a violet-forward customer palette */
--brand-primary:   #6d5ae6; /* primary actions & identity   */
--brand-secondary: #4b39c4; /* secondary emphasis           */
--brand-tertiary:  #b7aef2; /* supporting accent            */
--brand-highlight: #c9c2f7; /* focus glow / highlight source */
```

That's it — buttons, links, focus rings, active-state badges, and chart series 1
all re-skin, while the layout, density, and motion stay identical.

### Going further (optional)

| You want to change… | Edit these tokens |
|---|---|
| Canvas / surface tone | `--background`, `--card`, `--muted` (light) and the same keys under `.dark` |
| Text ink | `--foreground`, `--muted-foreground` |
| The focus glow color | `--glow` (and `--brand-highlight`) |
| Corner roundness globally | `--radius-sm/md/lg/xl` in `@theme inline` |
| Status hues (rarely — they carry meaning) | `--status-success`, `--status-warning`, `--status-error`, … |

> **Do not** hardcode hex values or Tailwind palette classes (`bg-blue-600`,
> `text-green-500`) in components. Always go through a token so a rebrand stays a
> one-file change. Legacy `slate-*` / `green-*` classes have been removed from
> this template for exactly this reason.

### Per-customer theming at runtime (pattern)

The 1health platform exposes each tenant's brand colors (`tenant.primaryColor`,
`tenant.secondaryColor` — see the Settings page). To honor them dynamically,
set the brand tokens as inline CSS variables on a wrapper once the session
loads:

```tsx
<div
  style={{
    "--brand-primary": tenant.primaryColor ?? undefined,
    "--brand-secondary": tenant.secondaryColor ?? undefined,
  } as React.CSSProperties}
>
  {children}
</div>
```

Because Tier 3 reads Tier 2 through `var()`, the whole subtree re-skins with no
component changes. (Validate contrast when you do this — see
[Accessibility](#10-accessibility).)

---

## 4. Color

### Reference palette (Tier 1)

**Cool neutrals — structure (~70%)**

| Token | Hex | Role |
|---|---|---|
| `--graphite` | `#202833` | Primary ink; dark-mode canvas |
| `--charcoal` | `#313b47` | Secondary surfaces |
| `--slate` | `#566373` | Muted text |
| `--mist` | `#aeb8c4` | Muted text on dark |
| `--cloud` | `#e6ebf0` | Light borders; dark-mode ink |

**Healthcare / platform accents (~20%)**

| Token | Hex | Role |
|---|---|---|
| `--trust-blue` | `#246b8f` | Default `--brand-primary` |
| `--network-teal` | `#1f9a9b` | Default `--brand-secondary` |
| `--care-mint` | `#5fc7b2` | Default `--brand-tertiary` |
| `--signal-aqua` | `#8fd8e6` | Default `--brand-highlight`; glow |
| `--clinical-ice` | `#e8f7fa` | Light accent / hover surface |

**Action / emphasis (~5%, sparingly — never decorative)**

| Token | Hex | | Token | Hex |
|---|---|---|---|---|
| `--pulse` | `#d84f45` | | `--amber` | `#d6a83a` |
| `--coral` | `#e8786f` | | `--glow-amber` | `#f5e6b8` |
| `--blush` | `#f2c8c3` | | | |

**Functional status (~5%, consistent across all apps)**

| Token | Hex | Meaning |
|---|---|---|
| `--status-success` | `#3baa78` | Success / healthy / active |
| `--status-info` | `#2f80a8` | Informational / links |
| `--status-warning` | `#d6a83a` | Caution / attention |
| `--status-error` | `#d84f45` | Error / expired / destructive |
| `--status-neutral` | `#7a8696` | Inactive / n-a |

### Semantic tokens (Tier 3) → Tailwind utilities

These are what you actually use in components. Each maps to a utility such as
`bg-card`, `text-foreground`, `border-border`, `ring-ring`.

| Utility base | Light | Dark | Use for |
|---|---|---|---|
| `background` | `#f4f7fa` | graphite | Page canvas |
| `foreground` | graphite | cloud | Body text |
| `card` / `popover` | `#ffffff` | `#29333f` | Raised surfaces |
| `primary` | brand-primary | brand-primary | Primary buttons, key CTAs |
| `secondary` | `#eaeff4` | charcoal | Secondary buttons |
| `muted` / `muted-foreground` | `#edf1f5` / slate | charcoal / mist | Info panels, meta text |
| `accent` / `accent-foreground` | clinical-ice / graphite | `#2a3c46` / clinical-ice | Hover surfaces |
| `border` / `input` | `#e1e8ef` | `#3a4552` | Hairlines, field borders |
| `ring` | brand-primary | signal-aqua | Focus rings |
| `destructive` | error | error | Destructive actions |
| `link` | info | signal-aqua | Text links |

### Status utilities

For status chips, banners, and inline signals. Each status has a **base hue**
(for fills / borders / icons) and a **`-strong`** variant (AA-readable text,
auto-adjusted for light vs dark):

```
bg-success   text-success-strong   border-success/25
bg-warning   text-warning-strong
bg-info      text-info-strong
bg-error     text-error-strong
```

The **soft chip** recipe (default for status): soft translucent background +
strong text.

```html
<span class="rounded-full bg-success/12 px-2.5 py-0.5 text-caption text-success-strong">
  Active
</span>
```

The `<Badge>` component already ships `success` / `warning` / `info` variants
that do this — prefer those.

### Charts

Use `chart-1 … chart-5` (trust-blue → teal → mint → amber → coral). This ordered
healthcare palette keeps dashboards on-brand and avoids the rainbow effect.

---

## 5. Typography

**Typeface:** Inter (loaded via `next/font/google` in
[`app/layout.tsx`](../app/layout.tsx), wired to `font-sans`). Weights: Regular
400 · Medium 500 · SemiBold 600 · Bold 700.

**Type scale** — use the named utilities; size, line-height, and weight come
baked in:

| Utility | Size | Line height | Weight | Use |
|---|---|---|---|---|
| `text-display` | 56px | 64px | 700 | Hero / marketing only |
| `text-h1` | 40px | 48px | 700 | Page title |
| `text-h2` | 32px | 40px | 600 | Section title |
| `text-h3` | 24px | 32px | 600 | Subsection |
| `text-h4` | 20px | 28px | 600 | Card / group heading |
| `text-body-lg` | 18px | 28px | 400 | Lead paragraph |
| `text-body` | 16px | 24px | 400 | Default body |
| `text-body-sm` | 14px | 20px | 400 | Secondary text |
| `text-caption` | 12px | 16px | 400 | Metadata, labels |

```html
<h1 class="text-h1">Patients</h1>
<p class="text-body text-muted-foreground">Body copy in slate.</p>
<span class="text-caption uppercase tracking-wide text-muted-foreground">Tenant ID</span>
```

**Rules**

- One `h1` (page title) per screen.
- **No all-caps except short metadata labels** (like the `Tenant ID` example
  above). Never all-caps a sentence or a button.
- Numeric IDs, tokens, and codes use `font-mono`.

---

## 6. Spacing

An **8px grid**. Tailwind's spacing scale (1 unit = 4px) maps directly onto the
spec's steps — use the standard `p-*` / `gap-*` / `m-*` utilities:

| Spec step | px | Tailwind | Typical use |
|---|---|---|---|
| space-1 | 4 | `1` | Icon ↔ label |
| space-2 | 8 | `2` | Tight stacks |
| space-3 | 12 | `3` | Chip / small padding |
| space-4 | 16 | `4` | Default gap, control padding |
| space-5 | 24 | `6` | Card padding, group gap |
| space-6 | 32 | `8` | Section spacing |
| space-7 | 48 | `12` | Large section breaks |
| space-8 | 64 | `16` | Page rhythm |
| space-9 | 96 | `24` | Hero whitespace |

Whitespace is intentional — prefer breathing room over density.

---

## 7. Radius

| Utility | Value | Applied to |
|---|---|---|
| `rounded-sm` | 6px | Small inline elements |
| `rounded-md` | 10px | **Buttons, inputs** |
| `rounded-lg` | 16px | **Cards, dialogs** |
| `rounded-xl` | 24px | Large feature panels |
| `rounded-full` | pill | **Status chips / badges** |
| icon mask | 22% | App icons (`--radius: 22%` in the spec) |

---

## 8. Elevation & shadow

Two families, both theme-aware:

| Utility | Value | Use |
|---|---|---|
| `shadow-sm` | subtle 1–3px | **Resting cards** ("subtle shadows") |
| `shadow-md` | `0 4px 16px /.18` (elevation 1) | Raised / hovered surfaces |
| `shadow-lg` | `0 8px 28px /.24` (elevation 2) | **Dialogs, popovers, toasts** |
| `shadow-xl` | `0 16px 48px /.32` (elevation 3) | Peak overlays |
| `shadow-glow` | aqua glow | Focus / active emphasis only |

The `md`/`lg`/`xl` values are the spec's canonical elevation shadows. Cards rest
at `shadow-sm` and lift on interaction; keep shadows quiet on light surfaces.

---

## 9. Motion

Premium, purposeful, never bouncy-for-fun.

| Token / utility | Curve | Use |
|---|---|---|
| `ease-premium` | `cubic-bezier(0.16, 1, 0.3, 1)` | Entrances (panels, modals, pop-in) — the 1health signature |
| `ease-standard` | `cubic-bezier(0.4, 0, 0.2, 1)` | Hovers, color/opacity transitions, presses |

**Duration guide (from the spec):**

| Interaction | Duration |
|---|---|
| Button press | 80–120ms |
| Hover response | 120–180ms |
| Tooltip / menu | 120–160ms |
| Panel / card entrance | 180–240ms |
| Modal entrance | 220–280ms |
| Page transition | 240–360ms |
| Loading shimmer | 900–1400ms loop |

```html
<div class="transition-transform duration-200 ease-premium">…</div>
```

- Subtle **glow only on focus/active** — never ambient.
- **Reduced motion is respected globally**: `globals.css` collapses animations
  and transitions under `prefers-reduced-motion: reduce`. Don't fight it.

---

## 10. Accessibility

Target **WCAG 2.1 AA minimum**.

- Body/status text meets AA contrast. The `-strong` status variants exist so
  status text is readable on both themes — use them for text, reserve base hues
  for fills, borders, and icons.
- Never signal state with **color alone** — pair with an icon or label (e.g. the
  token badges read "Active" / "Expired", not just green/red).
- Focus is always visible: components use a `ring-ring` focus-visible ring.
  Don't remove it.
- If you inject per-tenant brand colors at runtime, re-check that
  `--primary-foreground` (white by default) still contrasts against the new
  `--brand-primary`.

---

## 11. Component guidelines

**Buttons** — one primary action per view. Primary = `--primary` (brand). Use
`variant="secondary"` / `"outline"` / `"ghost"` for everything else. Never place
two competing primary buttons side by side.

**Cards** — `rounded-lg`, `shadow-sm` at rest, one clear purpose each. Group
related info; don't exceed ~5 content groups per screen.

**Inputs** — `rounded-md`, visible border, brand focus ring. Always pair with a
`<Label>`.

**Badges / status chips** — pill-shaped. Solid `default`/`secondary` for
emphasis; soft `success`/`warning`/`info` for status.

**Dialogs** — `rounded-lg`, `shadow-lg`, `ease-premium` entrance, dimmed
overlay. One decision per dialog.

**Empty states** — every empty state needs three things: **what** it is, **why**
it's empty, and the **next action**.

---

## 12. Cognitive-load standards

The command-center feel comes as much from restraint as from styling:

- **One** primary goal per screen.
- **≤ 5** content groups per screen.
- **≤ 7** primary navigation items.
- **Progressive disclosure** for advanced/rare features — don't front-load them.

---

## 13. Critical constraints (the "never" list)

- ❌ No rainbow dashboards — stay in the healthcare palette.
- ❌ No all-caps except short metadata labels.
- ❌ No competing primary actions.
- ❌ No decorative red — red means error/destructive, nothing else.
- ❌ No ambient glow — glow is for focus/active only.
- ❌ No hardcoded hex or `bg-*-500` palette classes in components — use tokens.
- ✅ Respect reduced motion. ✅ Meet WCAG 2.1 AA. ✅ Keep the brand lowercase.

---

## 14. Dark mode

A full command-center dark theme ships with the system (graphite canvas, cloud
ink, aqua focus glow). It's **class-based and off by default**.

Enable it globally by adding `dark` to the root element in
[`app/layout.tsx`](../app/layout.tsx):

```tsx
<html lang="en" className={`${inter.variable} dark`} suppressHydrationWarning>
```

Or wire a toggle that adds/removes `dark` on `document.documentElement`. Because
every semantic token has a `.dark` value, components need no changes.

---

## 15. Keeping in sync with the spec

The canonical spec lives at
<https://tachin-website.web.app/public/1health_design_system.md> and is
referenced at the top of [`app/globals.css`](../app/globals.css).

When the spec changes:

1. Re-read the spec.
2. Update the **Tier 1 reference palette** and any changed scales in
   `app/globals.css` (keep the Tier 2 / Tier 3 structure intact).
3. Update the tables in this document.
4. Rebuild and eyeball the Settings + Auth pages in light and dark.

Keeping brand hues in Tier 2 means spec updates and customer rebrands never
collide: the spec owns Tier 1 and the scales; customers own Tier 2.

---

## Quick reference

```
Rebrand ............ edit --brand-primary/secondary/tertiary/highlight in globals.css
Surfaces ........... bg-background · bg-card · bg-muted
Text ............... text-foreground · text-muted-foreground
Type ............... text-h1 … text-caption
Primary action ..... bg-primary text-primary-foreground   (<Button>)
Status ............. <Badge variant="success|warning|info"> or bg-*/12 text-*-strong
Radius ............. buttons/inputs rounded-md · cards rounded-lg · chips rounded-full
Elevation .......... cards shadow-sm · dialogs shadow-lg · focus shadow-glow
Motion ............. entrances ease-premium · interactions ease-standard
Dark mode .......... add `dark` class to <html>
```
