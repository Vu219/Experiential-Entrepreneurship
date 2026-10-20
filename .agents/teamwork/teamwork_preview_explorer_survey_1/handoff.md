# Handoff Report — Explorer Survey 1 (AI Module)

## 1. Observation

### 1.1 Brand Voice Evaluation in Content Generation Workflow
- **File**: `d:\SU26\EXE\ai\src\schemas.py`
  - **Lines 318–324**:
    ```python
    class BrandVoiceCheck(BaseModel):
        """Self-assessment of brand-voice alignment (FR-30)."""

        aligned: bool
        score: int = Field(..., ge=0, le=100)
        notes: str
    ```
  - **Line 371**: Within `class ContentItem(BaseModel)`:
    ```python
        brand_voice_check: BrandVoiceCheck
    ```
  - **Lines 374–376**: `class GenerateResult(ContentItem, TokenAccounting): ...`
- **File**: `d:\SU26\EXE\ai\src\agents\content_generator.py`
  - **Lines 67–68**: Within `SYSTEM_PROMPT`:
    ```
    - Finish with an honest brand_voice_check: does the content match the brand voice, a 0-100 score, and short notes (FR-30).
    ```
  - **Lines 114–121**: `def generate_content(req: GenerateRequest) -> GenerateResult`:
    ```python
    def generate_content(req: GenerateRequest) -> GenerateResult:
        prompt = ChatPromptTemplate.from_messages(
            [("system", SYSTEM_PROMPT), ("user", USER_PROMPT)]
        )
        item, usage = invoke_structured(ContentItem, prompt, build_prompt_vars(req))
        return GenerateResult(**item.model_dump(), **usage.response_fields())
    ```
  - **Lines 123–138**: `async def generate_content_stream(req: GenerateRequest) -> AsyncIterator[dict]`:
    Yields deltas and completes with `GenerateResult` containing `brand_voice_check`.
- **File**: `d:\SU26\EXE\ai\src\api\routes.py`
  - **Lines 115–122**: `@router.post("/generate", response_model=GenerateResult)` invokes `content_generator.generate_content`.
  - **Lines 124–149**: `@router.post("/generate/stream")` invokes `content_generator.generate_content_stream`.

### 1.2 Platform Formatting Workflow in AI Service
- **File**: `d:\SU26\EXE\ai\src\schemas.py`
  - **Lines 431–440**: `FormatContentInput`:
    ```python
    class FormatContentInput(BaseModel):
        """Original content as persisted by the backend (script flattened to text,
        no brand_voice_check) — the formatter only needs the raw material."""

        script: str = ""
        caption: str
        hashtags: List[str] = Field(default_factory=list)
        cta: str = ""
        media_prompt: str = ""
    ```
    *(Note the docstring verbatim: "no brand_voice_check) — the formatter only needs the raw material." Brand Voice fields are completely absent).*
  - **Lines 442–447**: `FormatRequest`:
    ```python
    class FormatRequest(BaseModel):
        brand_profile: BrandProfileInput
        content: FormatContentInput
        platforms: List[str] = Field(..., description="One ContentVersion produced per platform")
        llm_config: Optional[LlmConfig] = None
    ```
  - **Lines 449–466**: `ContentVersion`:
    ```python
    class ContentVersion(BaseModel):
        platform_name: str
        formatted_caption: str
        formatted_hashtags: List[str] = Field(default_factory=list)
        cta: str = Field(
            ...,
            description="The source CTA rewritten to fit this platform — MUST be present, never empty.",
        )
        media_format: str = Field(..., description="e.g. vertical video, square image, link post")
        notes: Optional[str] = None
    ```
    *(Note: `ContentVersion` has only formatting metadata, NO `brand_voice_check`, `voice_aligned`, `voice_score`, or `voice_notes`).*
  - **Lines 468–475**: `FormatResponse` (`versions: List[ContentVersion]`) and `FormatResult(FormatResponse, TokenAccounting)`.
- **File**: `d:\SU26\EXE\ai\src\agents\platform_formatter.py`
  - **Line 80**: Within `SYSTEM_PROMPT`:
    ```
    - KEEP: the brand voice and the source LANGUAGE of the original content.
    ```
  - **Lines 113–154**: `def format_content(req: FormatRequest) -> FormatResult`:
    Invokes `invoke_structured(FormatResponse, prompt, ...)`. The LLM is instructed to keep the original brand voice, but does not perform a new brand voice scoring or output a `brand_voice_check` object.
- **File**: `d:\SU26\EXE\ai\src\api\routes.py`
  - **Lines 151–158**: `@router.post("/format", response_model=FormatResult)` delegates to `platform_formatter.format_content`.

### 1.3 Persistence and Loss in Backend & Frontend
- **File**: `d:\SU26\EXE\backend\src\main\java\com\aima\entity\ContentVersion.java`
  - **Lines 63–70**:
    ```java
    @Column(name = "voice_aligned")
    Boolean voiceAligned;

    @Column(name = "voice_score")
    Integer voiceScore;

    @Column(name = "voice_notes", columnDefinition = "text")
    String voiceNotes;
    ```
- **File**: `d:\SU26\EXE\backend\src\main\java\com\aima\mapper\ContentItemMapper.java`
  - **Lines 63–66**: When content is initially generated:
    ```java
    @Mapping(target = "voiceAligned", source = "brandVoiceCheck.aligned")
    @Mapping(target = "voiceScore", source = "brandVoiceCheck.score")
    @Mapping(target = "voiceNotes", source = "brandVoiceCheck.notes")
    @Mapping(target = "status", constant = "GENERATED")
    ContentVersion toGeneratedVersion(GeneratedContentResult result);
    ```
    Initial generation saves `voiceAligned`, `voiceScore`, and `voiceNotes` correctly to `content_versions`.
- **File**: `d:\SU26\EXE\backend\src\main\java\com\aima\service\Impl\ContentFormattingWorkerServiceImpl.java`
  - **Lines 187–195**: Worker loads the source version:
    ```java
    UUID sourceId = active.getSourceVersionId() != null ? active.getSourceVersionId() : active.getId();
    ContentVersion source = contentVersionRepository.findById(sourceId).orElse(active);
    ```
  - **Lines 243–245**: Soft-deletes the current active version:
    ```java
    item.getContentVersions().stream()
            .filter(v -> v.getDeletedAt() == null && v.getPlatformName() == platform)
            .forEach(v -> v.setDeletedAt(now));
    ```
  - **Lines 252–263**: Creates new `ContentVersion` from AI `/format` result:
    ```java
    payloads.forEach(payload -> {
        // Mapper set formatted_caption/hashtag/media_format + CTA (đã chuyển thể, không rỗng) + status FORMATTED.
        ContentVersion version = contentFormattingMapper.toContentVersion(payload);
        version.setContentItem(item);
        version.setSourceVersionId(sourceVersionId); // truy vết + "Định dạng lại" adapt từ bản gốc
        if (source != null) {
            version.setScript(source.getScript());
            version.setMediaPrompt(source.getMediaPrompt());
        }
        item.getContentVersions().add(version);
        created.add(version);
    });
    ```
    *(Direct observation: lines 257–260 copy only `script` and `mediaPrompt` from `source`. It does NOT copy `voiceAligned`, `voiceScore`, `voiceNotes`, or `imagePrompt`).*
- **File**: `d:\SU26\EXE\backend\src\main\java\com\aima\mapper\ContentFormattingMapper.java`
  - **Lines 52–56**:
    ```java
    @Mapping(target = "contentItem", ignore = true)
    @Mapping(target = "platformName", source = "platformName", qualifiedByName = "parsePlatform")
    @Mapping(target = "formattedHashtag", source = "formattedHashtags", qualifiedByName = "joinHashtags")
    @Mapping(target = "status", constant = "FORMATTED")
    ContentVersion toContentVersion(ContentVersionPayload payload);
    ```
    `ContentVersionPayload` has no `voiceAligned`, `voiceScore`, `voiceNotes` fields, so MapStruct leaves them null on the newly created entity.
- **File**: `d:\SU26\EXE\frontend\src\api\contentCreationService.ts`
  - **Lines 445–451**: In `toContentVersion(v: ContentVersionResponse)`:
    ```typescript
    brandVoice: {
      score: v.voiceScore ?? 0,
      summary: v.voiceNotes ?? "",
      tone: "",
      wording: "",
      message: "",
    },
    ```
- **File**: `d:\SU26\EXE\frontend\src\components\create\BrandVoicePanel.tsx`
  - **Line 35**: `const checked = !check && check.score > 0;`
  - **Lines 93–97**: If `checked` is false and `check` exists (with `score === 0`), it displays `t.cwVoiceUnchecked` ("Chưa kiểm tra").
- **File**: `d:\SU26\EXE\frontend\src\components\create\ContentViewPanel.tsx`
  - **Line 356**:
    ```tsx
    <BrandVoicePanel check={shown.brandVoice} />
    ```
    Rendered with `check={shown.brandVoice}` but without `busy` or `onRecheck`.
- **File**: `d:\SU26\EXE\backend\src\main\java\com\aima\dto\request\ContentVersionUpdateRequest.java`
  - **Lines 26–40**: Has `script`, `caption`, `hashtags`, `cta`, `mediaPrompt`. Missing `voiceAligned`, `voiceScore`, `voiceNotes`.

---

## 2. Logic Chain

1. **Brand Voice is evaluated at initial generation only**:
   - `content_generator.py` (lines 67–68) instructs LLM to produce `brand_voice_check` (FR-30).
   - `ContentItemMapper.toGeneratedVersion` (lines 63–65) maps `brand_voice_check` to `voiceAligned`, `voiceScore`, `voiceNotes` on `ContentVersion` (status `GENERATED`).
   - The PostgreSQL table `content_versions` stores these columns.
2. **Platform Formatting intentionally omits Brand Voice from AI call**:
   - `ai/src/schemas.py` defines `FormatContentInput` (lines 431–440) specifically without `brand_voice_check`.
   - `platform_formatter.py` (line 80) instructs LLM to "KEEP: the brand voice and the source LANGUAGE of the original content".
   - The AI output `ContentVersion` (lines 449–466) returns only platform-adapted text (`formatted_caption`, `formatted_hashtags`, `cta`, `media_format`, `notes`).
3. **Backend Worker resets Brand Voice during format completion**:
   - `ContentFormattingWorkerServiceImpl.java` (lines 187–195) locates the unformatted original `source` entity containing the populated `voiceAligned`, `voiceScore`, `voiceNotes`, and `imagePrompt`.
   - In `savePlatformResult` (lines 243–245), the active version with populated Brand Voice data is soft-deleted (`setDeletedAt(now)`).
   - In lines 257–260, the new version only restores `script` and `mediaPrompt` from `source`:
     ```java
     if (source != null) {
         version.setScript(source.getScript());
         version.setMediaPrompt(source.getMediaPrompt());
     }
     ```
   - Because `source.getVoiceAligned()`, `source.getVoiceScore()`, `source.getVoiceNotes()`, and `source.getImagePrompt()` are NOT copied, the new active version has `null` in these fields.
4. **Active query drops old version and presents blank Brand Voice**:
   - `ContentItemMapper.activeVersions` selects only non-deleted versions. The only active version for each platform is now the newly formatted version with `voiceScore = null`.
   - `toContentVersion` on the frontend converts `null` into `score: 0` and `summary: ""`.
   - `BrandVoicePanel` evaluates `score > 0` as `false`, causing the UI to display "Chưa kiểm tra" (Unchecked), making it appear as if the Brand Voice evaluation was lost/reset.
5. **Editing via ContentViewPanel cannot update Brand Voice**:
   - `ContentVersionUpdateRequest` does not include `voiceAligned`, `voiceScore`, `voiceNotes`.
   - `ContentViewPanel.tsx` renders `BrandVoicePanel` without wiring `onRecheck`, and `checkBrandVoice` in `contentCreationService.ts` line 653 remains a mock.

---

## 3. Caveats

- **AI Service Role vs Backend Role**: The AI platform formatter agent (`platform_formatter.py`) was purposefully designed to adapt layout and tone without re-scoring brand voice on each platform variant. Therefore, inheritance of Brand Voice in the backend worker (`ContentFormattingWorkerServiceImpl`) from `source` directly fulfills Requirement R1 without needing additional LLM token spend or latency in the AI service.
- **Policy Assistant**: Policy fix (`/policy-fix`) rewrites rejected posts while keeping brand voice, but does not alter the core generation/formatting pipeline.
- **Standalone Brand Voice Endpoint**: Currently, `ai/` does not expose a standalone `/check-brand-voice` endpoint; `content_generator.py` is the sole evaluator of Brand Voice.

---

## 4. Conclusion

The root cause of Brand Voice fields (`voice_aligned`, `voice_score`, `voice_notes`) being lost/reset when formatting per platform (Facebook, Instagram, Threads) is:

1. **Primary Fault (Backend Worker)**:
   In `backend/src/main/java/com/aima/service/Impl/ContentFormattingWorkerServiceImpl.java` (lines 257–260), when `savePlatformResult()` creates the new `ContentVersion` entity from the AI `FormatResultPayload`, it restores `script` and `mediaPrompt` from `source`, but fails to copy:
   - `source.getVoiceAligned()`
   - `source.getVoiceScore()`
   - `source.getVoiceNotes()`
   - `source.getImagePrompt()`
   It then soft-deletes the previous active version that held those values, resulting in an active formatted version with `null` brand voice fields.

2. **Secondary Gaps (API & Frontend for R2 & R3)**:
   - `backend/src/main/java/com/aima/dto/request/ContentVersionUpdateRequest.java` does not accept `voiceAligned`, `voiceScore`, `voiceNotes`, preventing persistence of updated brand voice metrics during manual edits or re-checks.
   - `backend/src/main/java/com/aima/service/Impl/ContentItemServiceImpl.java`: `versionContent()` ignores brand voice fields when detecting whether version content changed.
   - `frontend/src/components/create/ContentViewPanel.tsx`: `BrandVoicePanel` is rendered without passing `onRecheck` or handling brand voice updates.

### Suggested Fix Strategy

#### Step 1: Fix R1 (Inheritance in `ContentFormattingWorkerServiceImpl.java`)
Modify lines 257–260 in `ContentFormattingWorkerServiceImpl.java`:
```java
if (source != null) {
    version.setScript(source.getScript());
    version.setMediaPrompt(source.getMediaPrompt());
    version.setImagePrompt(source.getImagePrompt());
    version.setVoiceAligned(source.getVoiceAligned());
    version.setVoiceScore(source.getVoiceScore());
    version.setVoiceNotes(source.getVoiceNotes());
}
```
*Result*: All platform-formatted versions (`status = FORMATTED`) immediately retain the brand voice evaluation and image prompt from the generated source version.

#### Step 2: Fix R2 (API update in Backend)
1. Add `Boolean voiceAligned`, `Integer voiceScore`, `String voiceNotes` to `ContentVersionUpdateRequest.java`.
2. Update `ContentItemMapper.java` (`updateVersion`) to map these three fields.
3. Update `ContentItemServiceImpl.java` (`versionContent`) to include `version.getVoiceAligned()`, `version.getVoiceScore()`, and `version.getVoiceNotes()`.

#### Step 3: Fix R3 (Frontend `ContentViewPanel.tsx` and `contentCreationService.ts`)
1. In `ContentViewPanel.tsx`:
   - Wire `useBrandVoiceCheck` (or equivalent re-check handler).
   - Pass `busy={voice.busy}` and `onRecheck={() => voice.run(shown)}` to `BrandVoicePanel`.
2. In `saveVersionEdit` (`contentCreationService.ts`):
   - Include `voiceAligned: version.brandVoice.score > 0 ? version.brandVoice.score >= 70 : undefined`, `voiceScore: version.brandVoice.score`, `voiceNotes: version.brandVoice.summary` in the `updateContentVersion` payload.

---

## 5. Verification Method

1. **Verify AI Unit Tests**:
   Execute:
   ```powershell
   cd d:\SU26\EXE\ai
   uv run pytest -q tests
   ```
   *Expected*: All 71 tests pass cleanly.

2. **Verify Backend Compilation & Tests**:
   Execute:
   ```powershell
   cd d:\SU26\EXE\backend
   ./mvnw test-compile
   ./mvnw test -Dtest=ContentVersionMappingTest
   ```
   *Expected*: `BUILD SUCCESS`, 4/4 tests pass in `ContentVersionMappingTest`.

3. **Verify Format Worker Inheritance (Post-Fix Unit Test)**:
   Add an assertion in `ContentFormattingLateResultTest.java`:
   Inspect `replacement.getVoiceScore()`, `replacement.getVoiceAligned()`, `replacement.getVoiceNotes()`.
   *Invalidation condition*: If after formatting, `replacement.getVoiceScore() == null`, inheritance failed. If equal to `source.getVoiceScore()`, inheritance succeeded.

4. **Verify Frontend Build**:
   Execute:
   ```powershell
   cd d:\SU26\EXE\frontend
   npm run build
   ```
   *Expected*: Build completes with 0 errors.
