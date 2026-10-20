# Orchestration Plan — Brand Voice Persistence & Verification

## Objective
Implement and verify end-to-end Brand Voice lifecycle persistence, display, and recheck capabilities according to ORIGINAL_REQUEST.md (R1, R2, R3) across AI formatting, Spring Boot backend, and React frontend.

## Phases and Milestones

### Phase 0: Multi-Track Survey & Investigation (COMPLETED)
- 3 Explorers investigated AI, Backend, and Frontend modules.
- Root cause for R1: `ContentFormattingWorkerServiceImpl.java` failed to copy `voiceAligned`, `voiceScore`, `voiceNotes`, and `imagePrompt` from source.
- Root cause for R2: `ContentVersionUpdateRequest` and `versionContent()` lacked Brand Voice fields.
- Root cause for R3: `ContentViewPanel` didn't wire `onRecheck`, `toContentVersion` mapped null to 0 ("Chưa kiểm tra"), and `saveVersionEdit` omitted brand voice fields.
- `PROJECT.md` created with Feature Inventory and Interface Contracts.

### Milestone 1: Backend Module — Brand Voice Inheritance & Update API (R1 & R2)
- Target files:
  - `backend/src/main/java/com/aima/service/Impl/ContentFormattingWorkerServiceImpl.java`
  - `backend/src/main/java/com/aima/dto/request/ContentVersionUpdateRequest.java`
  - `backend/src/main/java/com/aima/service/Impl/ContentItemServiceImpl.java`
  - `backend/src/test/java/com/aima/content/ContentFormattingLateResultTest.java`
  - `backend/src/test/java/com/aima/content/ContentVersionMappingTest.java`
- Iteration Cycle:
  - Explorers (3) -> Worker (1) -> Reviewers (2) -> Challengers (2) -> Forensic Auditor (1) -> Gate.

### Milestone 2: Frontend Module — Brand Voice Display & Recheck/Sync (R3)
- Target files:
  - `frontend/src/api/contentGeneration.ts`
  - `frontend/src/api/contentCreationService.ts`
  - `frontend/src/components/create/BrandVoicePanel.tsx`
  - `frontend/src/components/create/ContentViewPanel.tsx`
- Iteration Cycle:
  - Explorers (3) -> Worker (1) -> Reviewers (2) -> Challengers (2) -> Forensic Auditor (1) -> Gate.

### Milestone 3: End-to-End Integration, Final Verification & Forensic Audit
- Full verification of acceptance criteria across all tiers.
- Run `./mvnw test-compile` and unit tests.
- Run `npm run build` and tests.
- Final forensic audit.
- Update `docs/PLAN.md`.
- Completion report to Sentinel.
