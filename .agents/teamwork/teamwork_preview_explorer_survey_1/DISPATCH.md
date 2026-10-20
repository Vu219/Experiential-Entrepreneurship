# DISPATCH — Explorer Survey 1 (AI Module)

## Identity
- Role: Codebase Explorer (AI Module)
- Working Directory: d:\SU26\EXE\.agents\teamwork\teamwork_preview_explorer_survey_1
- Parent: teamwork_preview_orchestrator_1 (73e2da17-d8d6-4997-bef5-ff7eb72148d5)

## Mission
Survey the AI marketing service (`ai/`) to investigate how Brand Voice evaluation and platform formatting currently work, and where Brand Voice fields (`voice_aligned`, `voice_score`, `voice_notes`) are lost or omitted during platform formatting.

## Inputs
- ORIGINAL_REQUEST: `d:\SU26\EXE\.agents\teamwork\ORIGINAL_REQUEST.md`
- Project Guide & Rules: `d:\SU26\EXE\AGENTS.md`, `d:\SU26\EXE\ai\AGENTS.md`
- AI codebase: `d:\SU26\EXE\ai\`

## Tasks
1. Read `d:\SU26\EXE\.agents\teamwork\ORIGINAL_REQUEST.md` and `d:\SU26\EXE\AGENTS.md`.
2. Trace the content generation workflow and platform formatting workflow in `ai/` (agents, chains, prompts, formatting outputs, data models).
3. Identify exactly where Brand Voice is evaluated, what fields are produced (`voice_aligned`, `voice_score`, `voice_notes`), and how platform formatting processes content versions.
4. Locate the exact code files and functions responsible for formatting per platform (Facebook, Instagram, Threads) and identify why Brand Voice fields are reset or omitted.
5. Identify any existing tests, mock data, or test runners for the AI service.
6. Write a comprehensive report to `handoff.md` in your working directory.

## 2026-10-20T05:51:20Z
[Message] sender=73e2da17-d8d6-4997-bef5-ff7eb72148d5
You are Explorer Survey 1 (AI Module).
Your working directory is: d:\SU26\EXE\.agents\teamwork\teamwork_preview_explorer_survey_1
Read d:\SU26\EXE\.agents\teamwork\ORIGINAL_REQUEST.md, d:\SU26\EXE\AGENTS.md, and d:\SU26\EXE\.agents\teamwork\teamwork_preview_explorer_survey_1\DISPATCH.md.
Investigate the AI service (ai/) to trace the content generation and platform formatting workflow. Specifically identify where Brand Voice is evaluated (voice_aligned, voice_score, voice_notes) and where/why these fields are lost or reset when formatting per platform (Facebook, Instagram, Threads).
Document your findings, affected files, exact line numbers/functions, and suggested fix strategy in d:\SU26\EXE\.agents\teamwork\teamwork_preview_explorer_survey_1\handoff.md.
When finished, send a message to parent with your completion status and reference your handoff.md.

## 2026-10-20T06:01:43Z
[Message] sender=73e2da17-d8d6-4997-bef5-ff7eb72148d5
**Context**: Phase 0 Survey Check
**Content**: Explorer Survey 2 and 3 have completed and handed off their reports. Please provide your current status on investigating the AI module and platform formatting workflow.
**Action**: Please complete your handoff.md and send your summary report when ready.
