# Project: Brand Voice Lifecycle Persistence & Verification

## Architecture
- **AI Service (`ai/`)**: Evaluates initial brand voice (`brand_voice_check`). Platform formatter formats content while preserving voice.
- **Backend Service (`backend/`)**: Spring Boot module (`com.aima`).
  - `ContentVersion`: JPA entity with `voice_aligned`, `voice_score`, `voice_notes` (Flyway baseline V1).
  - `ContentFormattingWorkerServiceImpl`: Inherits brand voice (`voiceAligned`, `voiceScore`, `voiceNotes`) and `imagePrompt` from source to formatted versions (R1) - **IMPLEMENTED & VERIFIED**.
  - `ContentVersionUpdateRequest` & `ContentItemServiceImpl`: Exposes and saves brand voice updates via API across revisions (R2) - **IMPLEMENTED & VERIFIED**.
- **Frontend App (`frontend/`)**: React + TypeScript module.
  - `ContentViewPanel` & `BrandVoicePanel`: Displays % score progress bar, alignment badge, notes, and allows triggering "Kiểm tra lại" (Re-check) (R3) - **IMPLEMENTED & VERIFIED**.
  - `contentCreationService.ts` & `contentGeneration.ts`: Maps DTOs and sends Brand Voice fields in save and recheck flows (R3) - **IMPLEMENTED & VERIFIED**.

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Brand Voice Inheritance in Platform Formatting | Inherit `voiceAligned`, `voiceScore`, `voiceNotes`, and `imagePrompt` from source version to formatted platform versions in `ContentFormattingWorkerServiceImpl` | M1 | ORIGINAL_REQUEST §R1 |
| 2 | Format Worker Inheritance Test | Add unit test assertions in `ContentFormattingLateResultTest` verifying that formatted versions inherit brand voice from source | M1 | ORIGINAL_REQUEST §Acceptance Criteria |
| 3 | Brand Voice Update API DTO Support | Add `voiceAligned`, `voiceScore`, and `voiceNotes` to `ContentVersionUpdateRequest` in backend | M1 | ORIGINAL_REQUEST §R2 |
| 4 | Brand Voice Change Detection & Persistence | Include brand voice fields in `ContentItemServiceImpl.versionContent()` to ensure updates increment revision and persist to DB | M1 | ORIGINAL_REQUEST §R2 |
| 5 | Brand Voice Update API Unit Tests | Verify `ContentVersionMappingTest` correctly maps brand voice update fields | M1 | ORIGINAL_REQUEST §Acceptance Criteria |
| 6 | Frontend Brand Voice Data Contracts | Add `voiceScore`, `voiceAligned`, `voiceNotes` to `ContentVersionUpdateInput` and `BrandVoiceCheck` | M2 | ORIGINAL_REQUEST §R3 |
| 7 | Frontend Brand Voice Real Display | Ensure `toContentVersion` and `BrandVoicePanel` properly display actual % score, alignment badge, and notes without defaulting to "Chưa kiểm tra" | M2 | ORIGINAL_REQUEST §R3 |
| 8 | Frontend Recheck & Save Interaction | Wire `onRecheck` in `ContentViewPanel` to trigger brand voice check and persist updated metrics via `saveVersionEdit` | M2 | ORIGINAL_REQUEST §R3 |
| 9 | Cross-Stack Test & Build Verification | Run backend `./mvnw test-compile`, backend unit tests, frontend `npm run build`, and frontend `npm test` | M3 | ORIGINAL_REQUEST §Acceptance Criteria |
| 10 | Plan & Documentation Update | Update `docs/PLAN.md` with completed Brand Voice persistence tasks | M3 | AGENTS.md §Progress Tracking |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | M1: Backend Module (Inheritance & Update API) | Fix `ContentFormattingWorkerServiceImpl.java`, `ContentVersionUpdateRequest.java`, `ContentItemServiceImpl.java`, `ContentFormattingLateResultTest.java`, `ContentVersionMappingTest.java` | none | DONE |
| 2 | M2: Frontend Module (Display & Recheck/Sync) | Update `contentGeneration.ts`, `contentCreationService.ts`, `BrandVoicePanel.tsx`, `ContentViewPanel.tsx` | M1 | DONE |
| 3 | M3: Integration & Forensic Audit | Run full test suites, forensic integrity audit, verify all acceptance criteria, and update `docs/PLAN.md` | M1, M2 | IN_PROGRESS |

## Interface Contracts
### AI Service ↔ Backend
- `POST /format` takes `FormatRequest` and returns `FormatResponse` (`List<ContentVersion>`).
- Brand Voice inheritance is performed within `backend` (`ContentFormattingWorkerServiceImpl`) by copying from the stored source version (`source.getVoiceAligned()`, `source.getVoiceScore()`, `source.getVoiceNotes()`, `source.getImagePrompt()`).

### Backend ↔ Frontend
- `GET /content-items/{itemId}` returns `ContentItemResponse` with `ContentVersionResponse` containing:
  - `voiceAligned`: Boolean | null
  - `voiceScore`: Integer | null (0-100)
  - `voiceNotes`: String | null
- `PUT /content-items/{itemId}/versions/{versionId}` accepts `ContentVersionUpdateRequest`:
  - `script`: VideoScriptDto
  - `caption`: String
  - `hashtags`: List<String>
  - `cta`: String
  - `mediaPrompt`: String
  - `voiceAligned`: Boolean
  - `voiceScore`: Integer
  - `voiceNotes`: String

## Code Layout
### Backend Files (M1) — DONE
- `backend/src/main/java/com/aima/service/Impl/ContentFormattingWorkerServiceImpl.java`
- `backend/src/main/java/com/aima/dto/request/ContentVersionUpdateRequest.java`
- `backend/src/main/java/com/aima/service/Impl/ContentItemServiceImpl.java`
- `backend/src/test/java/com/aima/content/ContentFormattingLateResultTest.java`
- `backend/src/test/java/com/aima/content/ContentVersionMappingTest.java`

### Frontend Files (M2) — DONE
- `frontend/src/api/contentGeneration.ts`
- `frontend/src/api/contentCreationService.ts`
- `frontend/src/components/create/BrandVoicePanel.tsx`
- `frontend/src/components/create/ContentViewPanel.tsx`

### Project Documentation (M3) — IN PROGRESS
- `docs/PLAN.md`
