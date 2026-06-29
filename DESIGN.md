---
name: AIMA — AI Marketing Assistant
description: Vibrant aurora identity on a calm lavender-white work canvas for solo creators and small businesses.
colors:
  canvas: "#f7f6fd"
  surface: "#ffffff"
  brand-aurora-from: "#46d6ec"
  brand-aurora-mid: "#897ce3"
  brand-aurora-to: "#f083c0"
  accent-violet: "#7c3aed"
  accent-violet-deep: "#6d28d9"
  accent-violet-light: "#8b5cf6"
  ink: "#1b1730"
  ink-strong: "#211c38"
  ink-input: "#241f3a"
  muted: "#5b5670"
  muted-soft: "#6b6680"
  muted-faint: "#8a85a0"
  border: "#efeaf8"
  border-soft: "#ece8f6"
  field-bg: "#fbfaff"
  surface-tint: "#f4f2fb"
  violet-wash: "#f4ecff"
  success: "#16a34a"
  success-bg: "#e8f8ee"
  warning: "#b45309"
  warning-bg: "#fdf0dc"
  danger: "#e23d6e"
  danger-ink: "#d6336c"
  danger-border: "#f3aabf"
  danger-bg: "#fdeef2"
  danger-bg-border: "#f3c9d6"
  warning-label: "#d97706"
  info-amber: "#b08968"
  info-amber-bg: "#fdf6ec"
  violet-ink: "#5b2b9e"
  violet-action: "#7c5cff"
  violetgray-700: "#5b4b86"
  violetgray-500: "#7d6aa3"
  violetgray-400: "#9b7fd6"
  violetgray-350: "#9b94b5"
  violetgray-300: "#a39bbf"
  violetgray-200: "#b3acc6"
  violet-border: "#d6cdf0"
  violet-border-soft: "#e0d5fb"
  violet-border-faint: "#e7d9fb"
  platform-fb: "#1877f2"
  platform-th: "#000000"
typography:
  display:
    fontFamily: "'Plus Jakarta Sans', sans-serif"
    fontSize: "19px"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "normal"
  headline:
    fontFamily: "'Plus Jakarta Sans', sans-serif"
    fontSize: "15px"
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: "normal"
  body:
    fontFamily: "'Be Vietnam Pro', system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.55
    letterSpacing: "normal"
  body-input:
    fontFamily: "'Be Vietnam Pro', system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.4
    letterSpacing: "normal"
  label:
    fontFamily: "'Be Vietnam Pro', system-ui, sans-serif"
    fontSize: "12.5px"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "0.04em"
  section-label:
    fontFamily: "'Be Vietnam Pro', system-ui, sans-serif"
    fontSize: "11px"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "0.08em"
rounded:
  chip: "8px"
  sm: "11px"
  md: "13px"
  card: "20px"
  pill: "999px"
spacing:
  xs: "6px"
  sm: "10px"
  md: "16px"
  lg: "24px"
components:
  button-primary:
    backgroundColor: "{colors.accent-violet}"
    textColor: "{colors.surface}"
    typography: "{typography.headline}"
    rounded: "{rounded.md}"
    padding: "16px 24px"
  button-soft:
    backgroundColor: "{colors.surface-tint}"
    textColor: "{colors.muted}"
    rounded: "{rounded.sm}"
    padding: "9px 14px"
  button-outline:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.accent-violet-deep}"
    rounded: "{rounded.md}"
    padding: "15px 16px"
  input:
    backgroundColor: "{colors.field-bg}"
    textColor: "{colors.ink-input}"
    typography: "{typography.body-input}"
    rounded: "{rounded.md}"
    padding: "14px 15px"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.card}"
    padding: "24px"
  nav-item:
    backgroundColor: "transparent"
    textColor: "{colors.muted}"
    rounded: "{rounded.sm}"
    padding: "11px 13px"
  nav-item-active:
    backgroundColor: "{colors.accent-violet}"
    textColor: "{colors.surface}"
    rounded: "{rounded.sm}"
    padding: "11px 13px"
  platform-chip:
    backgroundColor: "{colors.platform-fb}"
    textColor: "{colors.surface}"
    rounded: "{rounded.chip}"
    size: "26px"
---

# Design System: AIMA — AI Marketing Assistant

## 1. Overview

**Creative North Star: "The Aurora Workbench"**

AIMA is a serious tool wearing a bright, optimistic face. The brand lives in a single signature
gesture — the **aurora gradient** (cyan → violet → pink) — which appears on primary actions, the
active nav item, avatars, and key brand moments. Everything else is a disciplined, low-noise work
canvas: a lavender-tinted near-white (`#f7f6fd`) ground, white cards, quiet violet-gray text. The
color earns attention precisely because it is rare; the canvas stays calm so content, calendars,
and analytics read clearly. This is a workbench, not a billboard.

The system is built for solo creators and small-business owners who are **not** marketing experts.
So it leans friendly and rounded — generous 13–20px radii, soft purple-tinted glows, springy hover
lift — without tipping into toy-like. Density appears only where the user genuinely wants it
(calendar grid, analytics tables); everywhere else, each surface serves the current step of the
content pipeline and defers the rest. The interface should make a one-person marketing team feel
**supported and in control**, never overwhelmed.

It explicitly rejects four neighbors: the cold navy/gray **enterprise-SaaS dashboard** (too
intimidating), the everything-on-screen **marketing-automation suite** (HubSpot/Marketo density),
the interchangeable **generic AI-startup template** (purple-gradient + glassmorphism clone), and
anything **childish or gimmicky** (this manages real money-making channels). The aurora identity
must feel specific and owned, not like a stock AI skin.

**Key Characteristics:**
- One signature gradient (aurora, with `sunset` / `ocean` theme alternates), used as accent, never wallpaper.
- Lavender-white canvas (`#f7f6fd`) + pure-white cards; depth from soft purple glow, not hard shadow.
- Friendly geometry: 13–20px radii, full pills for tags/badges, springy micro-interactions.
- Dual sans pairing on a contrast axis: Plus Jakarta Sans (display) over Be Vietnam Pro (body).
- Bilingual (vi / en) and WCAG 2.1 AA — every animation has a reduced-motion branch.

## 2. Colors

A cool, violet-leaning palette: one vivid aurora gradient and a solid violet accent floating on a
calm lavender-white field, with color reserved for meaning (brand, platform, status).

### Primary
- **Aurora Gradient** (`#46d6ec` → `#897ce3` → `#f083c0`, `linear-gradient(120deg, …)`): the brand
  signature. Drives primary buttons, the active sidebar item, avatar fills, badges, and hero brand
  moments. Injected globally via the `--brand` CSS variable so themes swap in one place. Two
  alternates exist: **Sunset** (`#fb8da0` → `#b47cee` → `#7e86f1`) and **Ocean** (`#5bd8ec` →
  `#6aa1f2` → `#7e86f1`).
- **Accent Violet** (`#7c3aed`, deep `#6d28d9`, light `#8b5cf6`): the solid-color counterpart to the
  gradient. Used for links, secondary-action text, icon strokes, focus accents, and the violet-wash
  pill (`#f4ecff`) on tertiary actions like the admin portal entry.

### Neutral
- **Canvas** (`#f7f6fd`): the app background — a lavender-tinted near-white. The calm ground the
  whole product sits on. (This is a cool violet tint, not the warm cream/sand AI default.)
- **Surface** (`#ffffff`): cards, panels, sidebar, input rows. The reading surface.
- **Surface Tint** (`#f4f2fb`): quiet chips and utility buttons in the topbar/sidebar (search box,
  language toggle, notifications). Nav-hover lands a touch warmer at `#f6f3fc`.
- **Ink** (`#1b1730`, strong `#211c38`, input `#241f3a`): primary text and headings. High-contrast,
  near-black violet.
- **Muted** (`#5b5670` → `#6b6680` → `#8a85a0`): secondary text, captions, inactive nav labels,
  placeholders — darkest to lightest. **Faint** (`#8a85a0`) and `#a59fbb` are for large/secondary
  text only, never body-length prose (see the Legible Muted Rule).
- **Border** (`#efeaf8`, soft `#ece8f6` / `#eee9f6`): hairline card and panel dividers. Field
  borders run slightly stronger at `#e7e2f2` (1.5px).
- **Field BG** (`#fbfaff`): the faint violet-white fill inside inputs, distinguishing them from
  pure-white cards.

### Tertiary (status & platform)
- **Success** (`#16a34a`, on `#e8f8ee` / border `#cdeed8`): confirmations, "posted" / "copied".
- **Review / Pending Amber** (`#b45309` on `#fdf0dc`): the "needs review" / awaiting-approval state — review-queue count badges and attention prompts. The mid-tone `#d97706` is the status-pill label variant; use the darker `#b45309` for small text on the amber tint to hold AA.
- **Danger** (`#e23d6e`, with `#d6336c` / `#e25c84` siblings, error border `#f3aabf`): validation
  errors, sign-out, failed states. The notification dot is `#ec4899`. **One danger family, one ink
  for text.** `#e23d6e` is the nominal danger hue, used for fills, borders, and the `#fdeef2` error
  wash (border `#f3c9d6`) — not for small text, where it only reaches ~4.1:1. All danger **text and
  icons** (validation/API errors, destructive labels, the required-field asterisk) render in the
  darker **danger-ink `#d6336c`**, which clears AA on white (4.6:1); the primary destructive confirm
  is solid `#d6336c` with white text. **Never** reintroduce a generic `#dc2626`-style red — it's
  outside the family. (Error text on the `#fdeef2` tint still sits near ~4.1:1 — a known item for the
  contrast audit, since a fully-AA ink on that wash would fall outside the documented family.)
- **Platform Colors** (never invented, never themed): Facebook `#1877f2`, Instagram
  `linear-gradient(135deg,#f9ce34,#ee2a7b,#6228d7)`, Threads `#000000`. Used only on platform chips.

### Named Rules
**The Rare Aurora Rule.** The aurora gradient is an accent, not a surface. It carries primary
actions, the single active nav item, and brand glyphs — never a full page or card background. Its
rarity is what makes it read as "the brand." When in doubt, the answer is the calm canvas.

**The Legible Muted Rule.** Muted violet-grays exist as a ramp for a reason. `#5b5670`/`#6b6680` are
the floor for anything users actually read; `#8a85a0` and lighter are reserved for large text,
single-word labels, and decorative captions. Never set body-length or placeholder text in the
faintest grays "for elegance" — bump toward `#5b5670` to hold WCAG 2.1 AA (4.5:1).

**The Owned-Platform Rule.** Platform brand colors are fixed constants from `theme.ts`
(`PLATFORM_BG`). Never hand-pick a "close enough" Facebook blue or re-tint them to match a theme.

## 3. Typography

**Display Font:** Plus Jakarta Sans (with `sans-serif` fallback)
**Body Font:** Be Vietnam Pro (with `system-ui, sans-serif` fallback)

**Character:** A two-sans pairing on a real contrast axis — Plus Jakarta Sans is geometric and
slightly architectural for headings and page titles; Be Vietnam Pro is a warm, highly legible
humanist sans (with full Vietnamese diacritics) for everything users read and type. The pairing
feels modern and friendly without novelty. This is a product UI: sizes are a fixed rem/px scale,
not fluid clamps.

### Hierarchy
- **Display / Page Title** (Plus Jakarta Sans, 700, 19px): the topbar page heading. Larger marketing
  headings on the landing page scale up from here but stay within product restraint.
- **Headline** (Plus Jakarta Sans / Be Vietnam Pro, 700, 15px): card titles, section headings,
  primary button text.
- **Title** (Be Vietnam Pro, 700, 14px): list-row titles, nav labels, dense headings.
- **Body** (Be Vietnam Pro, 400, 14–15px, line-height ~1.55): paragraph and form text. Cap prose at
  65–75ch; tables and dense data may run wider.
- **Label** (Be Vietnam Pro, 700, 12.5px, letter-spacing 0.04em): field labels above inputs.
- **Section Label** (Be Vietnam Pro, 700, 11px, letter-spacing 0.08em, color `#a59fbb`): the quiet
  "MAIN" / "ADMIN" group label in the sidebar. This is the *only* sanctioned tracked micro-label —
  it is a single structural device, not a per-section eyebrow.

### Named Rules
**The One-Eyebrow Rule.** Tiny uppercase tracked labels appear in exactly one role: the sidebar
section divider. Do not scatter `letter-spacing` all-caps kickers above content sections — that
reads as template scaffolding, not voice.

## 4. Elevation

Surfaces are **flat at rest; depth is an ambient purple glow that intensifies on interaction.**
Shadows are never hard drop-shadows — they are soft, wide, heavily negative-spread glows tinted
toward the brand's violet (`rgba(80,40,140,…)` for cards, `rgba(139,92,246,…)` for active/brand
elements). At rest a card barely lifts off the canvas; on hover it rises and the glow deepens. This
is what makes the UI feel friendly and alive rather than stacked and heavy.

### Shadow Vocabulary
- **Card Rest** (`box-shadow: 0 18px 38px -34px rgba(80,40,140,.5)`): the default card glow. Huge
  negative spread keeps it a faint halo, not a drop shadow.
- **Card Lift / `.lift-card:hover`** (`0 30px 50px -28px rgba(80,40,140,.55)`, `translateY(-6px)`):
  the hover response for interactive cards.
- **Brand / Primary Button** (`0 16px 30px -12px rgba(139,92,246,.6)`): the colored glow under
  gradient buttons; `.btn-grad:hover` lifts to `0 22px 40px -16px rgba(139,92,246,.7)`.
- **Active Nav Item** (`0 12px 24px -14px rgba(139,92,246,.8)`): grounds the one gradient-filled nav
  item.
- **Glass Topbar** (`background: rgba(255,255,255,.86)` + `backdrop-filter: blur(8px)`): the sticky
  header is the one sanctioned glass surface — functional (content scrolls under it), not decorative.

### Named Rules
**The Flat-at-Rest Rule.** If a resting surface needs a visible hard shadow to separate from the
canvas, the contrast or border is wrong — fix that first. Shadows here respond to state (hover,
active, brand emphasis); they don't establish a permanent stacking theatre. Audit test: if it looks
like a 2014 Material card with a dark, tight `0 2px 4px` shadow, it's wrong for AIMA.

## 5. Components

The feel across the board: **soft, lifted, friendly.** Generous radii, gentle purple glow, springy
hover. Approachable, but still a credible business tool.

### Buttons
- **Shape:** rounded (13px for full-width form buttons / 11px for compact / 10–12px for nav-scale).
  Tags and badges go full pill (999px).
- **Primary:** the aurora gradient (`var(--brand)`), white text, `letter-spacing: .05em`, padding
  16px, soft violet glow. Hover via the `.btn-grad` class — `translateY(-3px) scale(1.03)` plus a
  deeper glow and a touch of `saturate/brightness`. Active presses back to `scale(0.99)`.
- **Outline / Secondary:** white fill, 1.5px border (`#e8e4f1` / `#d7d2e3`), violet-deep text.
  `.btn-outline:hover` washes to `#faf7ff`, shifts border to `#b79df0`, text to `#6d28d9`.
- **Soft / Utility:** `#f4f2fb` fill, muted text, 10px radius — the quiet topbar/sidebar buttons.
  `.btn-soft:hover` deepens to `#f1ecfc` with a small lift.

### Cards / Containers
- **Corner Style:** 20px (the `cardStyle` primitive). Inner promo/upgrade panels use 16px.
- **Background:** pure white (`#ffffff`) on the lavender canvas. Occasional tinted promo panels use a
  faint gradient (`linear-gradient(150deg,#f6f2ff,#fcf1fc)`).
- **Border:** 1px `#efeaf8` hairline.
- **Shadow Strategy:** Card Rest glow at rest; `.lift-card` for interactive cards (see Elevation).
- **Internal Padding:** 24px (`lg`).

### Inputs / Fields
- **Style:** an icon + input row wrapped in a 1.5px border (`#e7e2f2`), 13px radius, `#fbfaff` fill.
  The text input itself is borderless/outline-none inside the wrapper; label sits above (Label
  style). Padding 14px vertical.
- **Focus:** border color shifts (transition `border .2s`); keep a visible `:focus-visible` state on
  the wrapper. Checkboxes use `accent-color: #8b5cf6`.
- **Error:** border goes to `#f3aabf`, message in `#e23d6e` below the field (min-height reserved so
  layout doesn't jump).

### Navigation (Sidebar)
- **Style:** white sidebar, collapsible (260px ⇄ 76px on desktop, horizontal scroll row on mobile),
  sticky full-height. Items are 12px-radius rows, 14px/600 labels.
- **Active:** filled with the aurora gradient, white text/icon, grounding glow. Exactly one active
  item at a time.
- **Hover (inactive):** framer-motion spring — lifts `y:-2`, nudges `x:+3`, `scale:1.03`, background
  to `#f6f3fc`. `whileTap` settles to `scale:0.98`.
- **Section label:** the quiet tracked "MAIN" / "ADMIN" divider (Section Label style).

### Platform Chip (signature component)
A rounded square (8px radius, ~26px) filled with the platform's brand color/gradient, carrying the
real brand glyph in white (Facebook / Instagram / Threads only). `aria-hidden` on the glyph; the
chip never invents a color and never appears for out-of-scope platforms (no TikTok / YouTube /
LinkedIn as posting targets).

### Loader (signature component)
A custom bouncing-ball loader (`.loader`) tinted with `var(--brand)`, used for auth/profile/data
waits (`fullScreen` centers it). Preferred over generic spinners; for content-area loads, favor
skeletons.

## 6. Do's and Don'ts

### Do:
- **Do** drive brand color from `var(--brand)` and platform color from `PLATFORM_BG` — never hardcode
  a gradient string or a platform hex inline.
- **Do** keep the aurora gradient to accents: primary buttons, the single active nav item, avatars,
  badges, brand glyphs. The calm `#f7f6fd` canvas is the default.
- **Do** keep surfaces flat at rest and let depth come from the soft purple glow on hover/active
  (`rgba(80,40,140,…)` / `rgba(139,92,246,…)` families).
- **Do** set readable text in `#1b1730`/`#211c38`, and secondary text no lighter than `#5b5670` to
  hold WCAG 2.1 AA. Reserve `#8a85a0`+ for large or single-word labels.
- **Do** pair Plus Jakarta Sans (display) with Be Vietnam Pro (body), and add new display strings in
  both `vi` and `en`.
- **Do** give every animation a `@media (prefers-reduced-motion: reduce)` branch and keep a visible
  `:focus-visible` ring on interactive elements.
- **Do** reuse the primitives — `Card`/`cardStyle`, `Icon`/`GradIcon`, `Loader`, `PlatformTag` and the
  `.btn-grad` / `.btn-outline` / `.btn-soft` / `.lift-card` classes — before authoring new style.

### Don't:
- **Don't** drift toward the **cold enterprise-SaaS dashboard** (navy/gray, hard shadows, jargon-dense
  panels). The canvas is warm-friendly lavender, not corporate slate.
- **Don't** build the **everything-on-screen marketing-automation** density (HubSpot/Marketo). Each
  surface serves the current pipeline step; defer the rest.
- **Don't** let the look collapse into the **generic AI-startup template** — decorative glassmorphism
  everywhere, the gradient as wallpaper, or interchangeable purple-glow cards. The aurora must feel
  owned; glass is for the topbar only.
- **Don't** go **childish or gimmicky** — no bouncy/elastic easing, no cartoon illustration, no
  oversized novelty. Use ease-out curves; this manages real revenue channels.
- **Don't** over-round: cards top out at 20px, form controls at 13–14px. Full pills are for
  tags/badges only, not cards or inputs.
- **Don't** pair a 1px border with a wide soft drop shadow as decoration, or use hard `0 2px 4px`
  Material shadows. Pick the brand glow or a hairline border, not a ghost-card of both.
- **Don't** add tracked all-caps eyebrows above content sections. The only tracked micro-label is the
  sidebar section divider.
- **Don't** introduce platforms or platform colors outside Facebook → Instagram → Threads.
