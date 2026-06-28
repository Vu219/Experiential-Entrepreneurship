# Product

## Register

product

## Users

Individual content creators, micro-businesses, and small businesses (SMEs) who run their own
marketing. They are **not** marketing experts and have little time: a solo founder, a shop owner,
a freelance creator. Their context is "I need a steady stream of on-brand social content across
Facebook, Instagram, and Threads, but I can't afford an agency or a full marketing team."

The job to be done: configure a brand once, then let the AI research trends, generate and format
content per platform, schedule and publish it, and report back on what worked — with the user
staying in control (review, edit, approve, handle failures) without having to think like a marketer.

## Product Purpose

AIMA (AI Marketing Assistant) automates the full multi-platform content pipeline:
Brand Profile → Content Strategy → Trend Research → Generate Content → Format per platform →
Schedule → Auto Publish → Analytics → Optimize Strategy.

The product exists to remove the expertise and time barrier to consistent social marketing.
Success looks like: a user sets up their brand and strategy, and the app reliably produces,
schedules, and publishes content that performs — surfacing analytics and folding them back into
better future strategy — while making failures (token expiry, platform rejection, posting errors)
obvious and recoverable. Scope is deliberately narrow: Facebook → Instagram → Threads, no
image/video generation (media prompts only), no custom content filter.

## Brand Personality

**Friendly, capable, optimistic.** The voice is warm and encouraging — it speaks to people who
aren't marketers and never makes them feel behind. It is quietly confident: the AI does the heavy
lifting and the user trusts it, but the interface never brags. Energy comes from a vibrant,
forward-looking color identity (the aurora/sunset/ocean gradients), balanced by calm, legible
surfaces so the app feels like a credible business tool, not a toy. Emotional goal: a solo creator
should feel **supported and in control**, not overwhelmed.

## Anti-references

- **Corporate enterprise SaaS** (cold navy/gray, jargon-dense dashboards): too intimidating for
  non-expert solo users.
- **Cluttered marketing-automation suites** (every feature on screen at once, HubSpot/Marketo
  density): keep surfaces focused on the current task, not a control panel of everything.
- **Generic AI-startup template** (interchangeable purple-gradient + glassmorphism clone look):
  the gradient identity must feel specific and owned, not like a stock AI-SaaS skin.
- **Childish / over-playful** (cartoonish, gimmicky, toy-like): friendliness must not cost
  credibility — this manages real money-making channels.

## Design Principles

1. **Supported, not overwhelmed.** Every screen serves the current step of the pipeline. Surface
   what the user needs to decide now; defer the rest. Density only where the user genuinely wants it
   (calendar, analytics).
2. **The AI does the work, the user stays in control.** Automation is the value, but review, edit,
   approve, and recover-from-failure paths are always visible and never buried. Trust is earned by
   transparency about status (the post state machine) and errors.
3. **Vibrant identity, calm surfaces.** The brand lives in the gradient accents and key moments;
   the working canvas stays quiet and legible so content and data read clearly. Color carries
   meaning (platform, status), not decoration.
4. **Earned familiarity over novelty.** Standard product affordances (nav, tables, forms, modals
   used sparingly) so the tool disappears into the task. Consistency screen-to-screen beats clever.
5. **Honest about state.** Async AI/posting work, scheduling, failures, and platform rejections are
   first-class UI: clear statuses, friendly error messages, obvious next actions — never a spinner
   with no explanation.

## Accessibility & Inclusion

Target **WCAG 2.1 AA**. Body text ≥4.5:1 contrast (≥3:1 for large text), including placeholder and
muted text; visible `:focus-visible` styles on all interactive elements; full `prefers-reduced-motion`
alternatives for every animation/transition (the codebase already follows this). Bilingual UI
(Vietnamese / English) via the shared i18n dictionary — all display strings localized. Color is
never the sole carrier of meaning (status and platform also use labels/icons).
