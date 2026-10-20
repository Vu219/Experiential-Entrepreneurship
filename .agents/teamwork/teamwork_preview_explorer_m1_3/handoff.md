# Handoff Report — Explorer M1.3 (Backend Edge Cases & Policy Verification)

## 1. Observation

### 1.1 Brand Voice Guardrail in Post Scheduling
In `backend/src/main/java/com/aima/service/Impl/PostScheduleServiceImpl.java`:
- Lines 253:
  ```java
  requireBrandVoice(user.getId(), version);
  ```
- Lines 737–746:
  ```java
  // Người dùng bật chặn brand voice: bản dưới ngưỡng (hoặc chưa chấm) không lên lịch được.
  private void requireBrandVoice(UUID userId, ContentVersion version) {
      settingsRepository.findById(userId)
              .filter(s -> s.isBrandVoiceBlockingEnabled() && s.getBrandVoiceThreshold() != null)
              .ifPresent(s -> {
                  Integer score = version.getVoiceScore();
                  if (score == null || score < s.getBrandVoiceThreshold()) {
                      throw new AppException(ErrorCode.BRAND_VOICE_BELOW_THRESHOLD);
                  }
              });
  }
  ```
- In `backend/src/main/resources/db/migration/V2__publishing_instants_and_settings.sql` (lines 28–30):
  ```sql
  brand_voice_blocking_enabled boolean NOT NULL DEFAULT false,
  brand_voice_threshold integer CHECK (brand_voice_threshold BETWEEN 0 AND 100),
  CHECK (NOT brand_voice_blocking_enabled OR brand_voice_threshold IS NOT NULL)
  ```
- In `backend/src/main/java/com/aima/exception/ErrorCode.java` (lines 458–459):
  ```java
  BRAND_VOICE_BELOW_THRESHOLD(2132, "Điểm brand voice của bản này thấp hơn ngưỡng bạn đặt — sửa nội dung hoặc chỉnh ngưỡng trong cài đặt đăng bài",
          HttpStatus.BAD_REQUEST),
  ```

### 1.2 Platform Formatting Worker Missing Copy
In `backend/src/main/java/com/aima/service/Impl/ContentFormattingWorkerServiceImpl.java`:
- Lines 251–263:
  ```java
  ContentVersion source = contentVersionRepository.findById(sourceVersionId).orElse(null);

  List<ContentVersion> created = new ArrayList<>();
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
  `source.getVoiceAligned()`, `source.getVoiceScore()`, `source.getVoiceNotes()`, and `source.getImagePrompt()` are omitted.

### 1.3 Change Detection in Version Update
In `backend/src/main/java/com/aima/service/Impl/ContentItemServiceImpl.java`:
- Lines 220–225:
  ```java
  List<Object> before = versionContent(version);
  contentItemMapper.updateVersion(request, version);
  if (before.equals(versionContent(version))) {
      ContentItemResponse unchanged = contentItemMapper.toResponse(item);
      return ApiResponse.success("Nội dung không đổi", unchanged);
  }
  ```
- Lines 326–329:
  ```java
  private static List<Object> versionContent(ContentVersion version) {
      return Arrays.asList(version.getScript(), version.getFormattedCaption(), version.getFormattedHashtag(),
              version.getCta(), version.getMediaPrompt());
  }
  ```
  `versionContent` does NOT compare `voiceAligned`, `voiceScore`, or `voiceNotes`.

### 1.4 Caller Safety & MapStruct Conventions
In `backend/src/main/java/com/aima/mapper/ContentItemMapper.java`:
- Lines 81–85:
  ```java
  @BeanMapping(nullValuePropertyMappingStrategy = NullValuePropertyMappingStrategy.IGNORE)
  @Mapping(target = "script", source = "script", qualifiedByName = "writeScript")
  @Mapping(target = "formattedCaption", source = "caption")
  @Mapping(target = "formattedHashtag", source = "hashtags", qualifiedByName = "joinHashtags")
  void updateVersion(ContentVersionUpdateRequest request, @MappingTarget ContentVersion version);
  ```
- In `backend/src/main/java/com/aima/service/Impl/AiAssistServiceImpl.java` (lines 191–196):
  ```java
  contentItemService.updateVersion(email, target.itemId(), target.versionId(), ContentVersionUpdateRequest.builder()
          .caption(request.getCaption().strip())
          .hashtags(request.getHashtags() == null ? List.of() : request.getHashtags().stream()
                  .map(t -> t == null ? "" : t.strip().replaceFirst("^#+", ""))
                  .filter(t -> !t.isEmpty()).distinct().toList())
          .build());
  ```
  Caller omits `voiceAligned`, `voiceScore`, and `voiceNotes`.

### 1.5 Test Suite Verification Commands
Ran `./mvnw test-compile` (success, exit 0).
Ran `./mvnw test -Dtest=ContentVersionMappingTest` (4 tests run, 0 failures, exit 0).
Ran `./mvnw test -Dtest=ContentFormattingLateResultTest` (2 tests run, 0 failures, exit 0).
Ran `./mvnw test -Dtest=ContentItemServiceImplTest` (8 tests run, 0 failures, exit 0).
Ran `./mvnw test -Dtest="com.aima.content.*Test"` (16 classes, 77 tests run, 0 failures, 2 skipped, exit 0).

---

## 2. Logic Chain

1. **Guardrail Unblocking Mechanism**:
   - From Obs 1.1, `PostScheduleServiceImpl.requireBrandVoice` checks `score == null || score < threshold`.
   - When users enable `brandVoiceBlockingEnabled` in publishing settings with a threshold (e.g., 70), any `ContentVersion` where `voiceScore == null` triggers `AppException(ErrorCode.BRAND_VOICE_BELOW_THRESHOLD)`.
   - From Obs 1.2, `ContentFormattingWorkerServiceImpl` created formatted versions with `voiceScore = null`. As a direct consequence, every formatted post created for a brand-voice-guarded user was blocked from scheduling, regardless of original voice quality.
   - By inheriting `source.getVoiceScore()`, `source.getVoiceAligned()`, and `source.getVoiceNotes()`, formatted versions retain the evaluated score. If `score >= threshold`, `requireBrandVoice` passes cleanly.

2. **Source Null Checks and Safe Edge Cases**:
   - Case A (`source == null`): Handled safely by existing `if (source != null)`. No NPE occurs; fields remain `null`.
   - Case B (`source != null`, but voice fields are `null`): Inherited as `null`. If user has blocking enabled, scheduling blocks with `BRAND_VOICE_BELOW_THRESHOLD` as intended; if blocking disabled, scheduling proceeds.
   - Case C (`source != null`, voice fields populated): Inherited with exact values. Brand voice guardrail and `ContentItemRepository` voice-based sorting work accurately.
   - Case D ("Định dạng lại" / Re-formatting): `ContentFormattingWorkerServiceImpl` lines 191–193 resolves `sourceId = active.getSourceVersionId() != null ? active.getSourceVersionId() : active.getId()`. Hence, subsequent formatting calls always refer back to the root source version, avoiding degradation.

3. **Change Detection & Revision Incrementing**:
   - From Obs 1.3, `ContentItemServiceImpl.updateVersion` performs a no-op check `before.equals(versionContent(version))`. If equal, it returns `"Nội dung không đổi"` immediately without saving to the database and without bumping `revision`.
   - If a client updates only brand voice fields (`voiceAligned`, `voiceScore`, `voiceNotes`) after a recheck, and `versionContent` does not include them, the update is dropped silently!
   - Therefore, `versionContent` must include `version.getVoiceAligned()`, `version.getVoiceScore()`, and `version.getVoiceNotes()`.
   - `Arrays.asList()` safely handles null elements in Java, and `List.equals()` delegates to `Objects.equals()`.

4. **Caller Safety & Side Effects**:
   - From Obs 1.4, `ContentItemMapper.updateVersion` is annotated with `@BeanMapping(nullValuePropertyMappingStrategy = NullValuePropertyMappingStrategy.IGNORE)`.
   - Callers such as `AiAssistServiceImpl` (Obs 1.4) or clients making partial updates that do not provide `voiceScore`/`voiceAligned`/`voiceNotes` (sending `null`) will NOT overwrite existing values on the version.
   - Mappers (`ContentItemMapper.toVersionResponse`, `ContentFormattingMapper.toContentVersionResponse`) map matching property names by default without needing duplicate manual definitions.

---

## 3. Caveats

- **No Caveats**: All edge cases, null checks, JPA mappings, and side effects across `ContentFormattingWorkerServiceImpl`, `ContentItemServiceImpl`, `PostScheduleServiceImpl`, and `AiAssistServiceImpl` were inspected and verified against existing test suites.

---

## 4. Conclusion

1. **`ContentFormattingWorkerServiceImpl.java`**:
   Add inheritance inside `if (source != null)` (lines 257–260):
   ```java
   version.setScript(source.getScript());
   version.setMediaPrompt(source.getMediaPrompt());
   version.setImagePrompt(source.getImagePrompt());
   version.setVoiceAligned(source.getVoiceAligned());
   version.setVoiceScore(source.getVoiceScore());
   version.setVoiceNotes(source.getVoiceNotes());
   ```

2. **`ContentVersionUpdateRequest.java`**:
   Add fields:
   ```java
   @Schema(description = "Whether the edited version aligns with the brand voice.")
   Boolean voiceAligned;

   @Schema(description = "Brand-voice match score (0-100).", example = "85")
   Integer voiceScore;

   @Schema(description = "Feedback notes on brand voice alignment.")
   String voiceNotes;
   ```

3. **`ContentItemServiceImpl.java`**:
   Update `versionContent` (line 326–329):
   ```java
   private static List<Object> versionContent(ContentVersion version) {
       return Arrays.asList(version.getScript(), version.getFormattedCaption(), version.getFormattedHashtag(),
               version.getCta(), version.getMediaPrompt(),
               version.getVoiceAligned(), version.getVoiceScore(), version.getVoiceNotes());
   }
   ```

4. **Tests to update / extend**:
   - In `ContentFormattingLateResultTest.java`: Add assertions that the replacement version inherits `voiceAligned`, `voiceScore`, `voiceNotes`, and `imagePrompt`.
   - In `ContentVersionMappingTest.java`: Add unit tests asserting `ContentVersionUpdateRequest` maps brand voice fields and that partial updates preserve existing brand voice fields when omitted.

---

## 5. Verification Method

The worker can independently verify the implementation using the following commands in `backend/`:

1. **Compilation Check**:
   ```powershell
   ./mvnw test-compile
   ```
2. **Specific Unit Tests**:
   ```powershell
   ./mvnw test -Dtest=ContentVersionMappingTest
   ./mvnw test -Dtest=ContentFormattingLateResultTest
   ./mvnw test -Dtest=ContentItemServiceImplTest
   ./mvnw test -Dtest=SchedulePolicyIntegrationTest
   ```
3. **Comprehensive Content Module Test Suite**:
   ```powershell
   ./mvnw test -Dtest="com.aima.content.*Test"
   ```
   *Expected outcome*: 77 tests run, 0 failures, 0 errors.

4. **Invalidation Conditions**:
   - If `versionContent` does not include voice fields, saving updated brand voice alone returns `"Nội dung không đổi"` and fails to update the DB.
   - If `ContentVersionUpdateRequest` lacks voice fields or `ContentFormattingWorkerServiceImpl` fails to copy them, `voiceScore` will remain `null` on formatted versions, causing `SchedulePolicyIntegrationTest` or live brand voice scheduling to throw `BRAND_VOICE_BELOW_THRESHOLD`.
