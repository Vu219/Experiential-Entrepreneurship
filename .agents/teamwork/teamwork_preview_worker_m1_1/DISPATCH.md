# DISPATCH — Worker M1.1 (Backend Module Implementation)

## Identity
- Role: Backend Worker
- Working Directory: d:\SU26\EXE\.agents\teamwork\teamwork_preview_worker_m1_1
- Parent: teamwork_preview_orchestrator_1 (73e2da17-d8d6-4997-bef5-ff7eb72148d5)

## Exclusive File Ownership
You have EXCLUSIVE write ownership of the following backend files:
- `backend/src/main/java/com/aima/service/Impl/ContentFormattingWorkerServiceImpl.java`
- `backend/src/main/java/com/aima/dto/request/ContentVersionUpdateRequest.java`
- `backend/src/main/java/com/aima/service/Impl/ContentItemServiceImpl.java`
- `backend/src/test/java/com/aima/content/ContentFormattingLateResultTest.java`
- `backend/src/test/java/com/aima/content/ContentVersionMappingTest.java`

Do NOT touch any other source files.

## Mission
Implement the Brand Voice inheritance in platform formatting and update API persistence for Milestone 1 according to ORIGINAL_REQUEST.md (§R1, §R2) and Explorer findings.

## Mandatory Inputs to Read
1. Original Request: `d:\SU26\EXE\.agents\teamwork\ORIGINAL_REQUEST.md` (Read in full before starting!)
2. Project Guide & Rules: `d:\SU26\EXE\AGENTS.md` and `d:\SU26\EXE\backend\AGENTS.md`
3. Explorer Reports:
   - `d:\SU26\EXE\.agents\teamwork\teamwork_preview_explorer_m1_1\handoff.md`
   - `d:\SU26\EXE\.agents\teamwork\teamwork_preview_explorer_m1_2\handoff.md`
   - `d:\SU26\EXE\.agents\teamwork\teamwork_preview_explorer_m1_3\handoff.md`

## Required Implementations
1. **`ContentFormattingWorkerServiceImpl.java`**:
   In `savePlatformResult()` (lines 257-260), inside `if (source != null)`, copy:
   ```java
   version.setScript(source.getScript());
   version.setMediaPrompt(source.getMediaPrompt());
   version.setImagePrompt(source.getImagePrompt());
   version.setVoiceAligned(source.getVoiceAligned());
   version.setVoiceScore(source.getVoiceScore());
   version.setVoiceNotes(source.getVoiceNotes());
   ```
2. **`ContentVersionUpdateRequest.java`**:
   Add the 3 fields:
   ```java
   @Schema(description = "FR-30: whether the AI or reviewer judged this version on-brand.")
   Boolean voiceAligned;

   @Schema(description = "FR-30: brand-voice match score 0-100.")
   Integer voiceScore;

   @Schema(description = "FR-30: short brand-voice notes from the AI or reviewer.")
   String voiceNotes;
   ```
3. **`ContentItemServiceImpl.java`**:
   In `versionContent(ContentVersion version)` (around line 326), include `version.getVoiceAligned()`, `version.getVoiceScore()`, and `version.getVoiceNotes()`.
4. **`ContentFormattingLateResultTest.java`**:
   Update `fixture()` with sample voice fields and `imagePrompt`, update `replacementVersionTakesOverAScheduleCreatedDuringFormatting()`, and add dedicated test `formattedVersionInheritsBrandVoiceAndImagePromptFromSource()`.
5. **`ContentVersionMappingTest.java`**:
   Add assertions in `updateVersionIsPartial()` and add unit tests verifying update request mappings for brand voice fields.

## Verification Commands (Run in `backend/`)
- `./mvnw test-compile` -> Must succeed with 0 errors.
- `./mvnw test -Dtest=ContentFormattingLateResultTest` -> All tests pass.
- `./mvnw test -Dtest=ContentVersionMappingTest` -> All tests pass.
- `./mvnw test -Dtest=ContentItemServiceImplTest` -> All tests pass.
- `./mvnw test -Dtest="com.aima.content.*Test"` -> All tests pass.

## Mandatory Integrity Warning
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

## Output
Write your full report including exact diffs and test results to `handoff.md` in your working directory and message parent when complete.

## 2026-10-20T06:14:10Z
You are Worker M1.1 (Backend Module Implementation).
Your working directory: d:\SU26\EXE\.agents\teamwork\teamwork_preview_worker_m1_1
MANDATORY: Read d:\SU26\EXE\.agents\teamwork\ORIGINAL_REQUEST.md, d:\SU26\EXE\PROJECT.md, and d:\SU26\EXE\.agents\teamwork\teamwork_preview_worker_m1_1\DISPATCH.md before writing any code.
Read the Explorer reports:
- d:\SU26\EXE\.agents\teamwork\teamwork_preview_explorer_m1_1\handoff.md
- d:\SU26\EXE\.agents\teamwork\teamwork_preview_explorer_m1_2\handoff.md
- d:\SU26\EXE\.agents\teamwork\teamwork_preview_explorer_m1_3\handoff.md

You have EXCLUSIVE write ownership of:
- backend/src/main/java/com/aima/service/Impl/ContentFormattingWorkerServiceImpl.java
- backend/src/main/java/com/aima/dto/request/ContentVersionUpdateRequest.java
- backend/src/main/java/com/aima/service/Impl/ContentItemServiceImpl.java
- backend/src/test/java/com/aima/content/ContentFormattingLateResultTest.java
- backend/src/test/java/com/aima/content/ContentVersionMappingTest.java

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Implement the requested changes, run the verification commands (./mvnw test-compile, ./mvnw test -Dtest=ContentFormattingLateResultTest, ./mvnw test -Dtest=ContentVersionMappingTest, ./mvnw test -Dtest="com.aima.content.*Test") in backend/, and write your completion report to d:\SU26\EXE\.agents\teamwork\teamwork_preview_worker_m1_1\handoff.md.
When finished, send a message to parent with your completion status and reference your handoff.md.

