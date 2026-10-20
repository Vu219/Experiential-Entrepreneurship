# DISPATCH — Explorer M2.3 (ContentViewPanel Wire-Up & State Management)

## Identity
- Role: Frontend Explorer (ContentViewPanel Interactions)
- Working Directory: d:\SU26\EXE\.agents\teamwork\teamwork_preview_explorer_m2_3
- Parent: teamwork_preview_orchestrator_1 (73e2da17-d8d6-4997-bef5-ff7eb72148d5)

## Mission
Analyze and define exact code specifications for Milestone 2:
1. `frontend/src/components/create/ContentViewPanel.tsx`:
   - Inspect line 356 where `<BrandVoicePanel check={shown.brandVoice} />` is rendered.
   - Design the state and handler for `onRecheck`:
     - Provide `busy` state indicator.
     - Call recheck service (`checkBrandVoice` or dedicated hook) with current version text (`caption`, `script`).
     - In edit mode: update `draft.brandVoice` so user sees instant recheck and can save.
     - In view mode: update `versions` state and call `saveVersionEdit` to persist new brand voice metrics immediately into backend DB.
   - Query or provide `threshold` (default 70 or from publishing settings).
2. Check edit and save flow: ensure saving edits persists brand voice data to DB via `saveVersionEdit`.
3. Check `npm run build` and tests to verify zero regressions.

## Mandatory Inputs
- Original Request: `d:\SU26\EXE\.agents\teamwork\ORIGINAL_REQUEST.md` (Read in full before starting!)
- Project Architecture & Plan: `d:\SU26\EXE\PROJECT.md`
- Frontend Rules: `d:\SU26\EXE\frontend\AGENTS.md`, `d:\SU26\EXE\frontend\rule.md`
- Survey Report: `d:\SU26\EXE\.agents\teamwork\teamwork_preview_explorer_survey_3\handoff.md`

## Output
Write full findings, proposed diffs, and verification steps in `handoff.md` in your working directory and message parent when complete.


## 2026-10-20T06:51:13Z
[Message] sender=73e2da17-d8d6-4997-bef5-ff7eb72148d5
You are Explorer M2.3 (ContentViewPanel Wire-Up & State Management).
Your working directory: d:\SU26\EXE\.agents\teamwork\teamwork_preview_explorer_m2_3
MANDATORY: Read d:\SU26\EXE\.agents\teamwork\ORIGINAL_REQUEST.md, d:\SU26\EXE\PROJECT.md, and d:\SU26\EXE\.agents\teamwork\teamwork_preview_explorer_m2_3\DISPATCH.md.
Analyze frontend/src/components/create/ContentViewPanel.tsx. Define the state, recheck handler (handleRecheckVoice), draft/view mode behavior, and props to pass to BrandVoicePanel.
Write your handoff report to d:\SU26\EXE\.agents\teamwork\teamwork_preview_explorer_m2_3\handoff.md and message parent when complete.
