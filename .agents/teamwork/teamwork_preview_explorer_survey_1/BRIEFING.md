# BRIEFING — 2026-10-20T06:05:00Z

## Mission
Investigate the AI service (ai/) to trace content generation, Brand Voice evaluation (voice_aligned, voice_score, voice_notes), and platform formatting (Facebook, Instagram, Threads) to determine where and why Brand Voice fields are lost or reset, and propose a concrete fix.

## 🔒 My Identity
- Archetype: explorer
- Roles: codebase explorer, synthesis
- Working directory: d:\SU26\EXE\.agents\teamwork\teamwork_preview_explorer_survey_1
- Original parent: 73e2da17-d8d6-4997-bef5-ff7eb72148d5
- Milestone: exploration

## 🔒 Key Constraints
- Read-only investigation — do NOT implement changes in ai/ or any project source code
- Focus on AI service (ai/), content generation workflow, brand voice evaluation, and platform formatting
- Output comprehensive handoff report at d:\SU26\EXE\.agents\teamwork\teamwork_preview_explorer_survey_1\handoff.md

## Current Parent
- Conversation ID: 73e2da17-d8d6-4997-bef5-ff7eb72148d5
- Updated: 2026-10-20T06:05:00Z

## Investigation State
- **Explored paths**:
  - `ai/CLAUDE.md`, `ai/src/schemas.py`, `ai/src/agents/content_generator.py`, `ai/src/agents/platform_formatter.py`, `ai/src/api/routes.py`, `ai/tests/test_platform_formatter.py`
  - `backend/src/main/java/com/aima/entity/ContentVersion.java`, `backend/src/main/java/com/aima/service/Impl/ContentGenerationWorkerServiceImpl.java`, `backend/src/main/java/com/aima/service/Impl/ContentFormattingWorkerServiceImpl.java`, `backend/src/main/java/com/aima/mapper/ContentItemMapper.java`, `backend/src/main/java/com/aima/mapper/ContentFormattingMapper.java`, `backend/src/main/java/com/aima/dto/ai/FormatContentPayload.java`, `backend/src/main/java/com/aima/dto/ai/ContentVersionPayload.java`, `backend/src/main/java/com/aima/dto/request/ContentVersionUpdateRequest.java`, `backend/src/main/java/com/aima/service/Impl/ContentItemServiceImpl.java`
  - `frontend/src/api/contentCreationService.ts`, `frontend/src/components/create/ContentViewPanel.tsx`, `frontend/src/components/create/BrandVoicePanel.tsx`, `frontend/src/components/create/useBrandVoiceCheck.ts`
- **Key findings**:
  1. Content Generator (`ai/src/agents/content_generator.py`:67-68, `ai/src/schemas.py`:318-323,371) evaluates `brand_voice_check` (`aligned`, `score`, `notes`).
  2. Platform Formatter (`ai/src/agents/platform_formatter.py`:80, `ai/src/schemas.py`:431-470) preserves brand voice in prompt instruction but does NOT output `brand_voice_check` in `ContentVersion`. `FormatContentInput` explicitly omits it.
  3. Backend root cause: In `ContentFormattingWorkerServiceImpl.java` (lines 257-260), when creating the formatted `ContentVersion`, it only copies `script` and `mediaPrompt` from `source`. It fails to copy `voiceAligned`, `voiceScore`, `voiceNotes` (and `imagePrompt`). The old version is soft-deleted, leaving the active formatted version with null Brand Voice fields.
  4. Frontend impact: `toContentVersion` defaults null `voiceScore` to 0, which makes `BrandVoicePanel` render "Chưa kiểm tra" (Unchecked). In `ContentViewPanel.tsx`, `BrandVoicePanel` is rendered without `onRecheck` or `busy`.
  5. API update limitation: `ContentVersionUpdateRequest` and `ContentItemServiceImpl.updateVersion` do not accept or persist Brand Voice fields.
- **Unexplored areas**: None regarding the Brand Voice evaluation lifecycle and platform formatting loss.

## Key Decisions Made
- Confirmed root cause across AI schema contracts, backend workers, mappers, and frontend display logic.
- Synthesized full 5-component handoff report.

## Artifact Index
- DISPATCH.md — Task instructions and incoming messages
- progress.md — Liveness heartbeat and investigation progress
- handoff.md — 5-component handoff report for parent
