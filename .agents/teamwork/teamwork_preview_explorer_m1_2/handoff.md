# Handoff Report: Explorer M1.2 (Backend Update API & Entity Dirty Checking)

## 1. Observation

### 1.1. Target Files and Exact Locations

1. **`ContentVersionUpdateRequest.java`**:
   - File path: `d:\SU26\EXE\backend\src\main\java\com\aima\dto\request\ContentVersionUpdateRequest.java`
   - Lines 24-40:
     ```java
     public class ContentVersionUpdateRequest {

         @Schema(description = "Structured video script (timed hook, numbered steps, timed CTA).")
         VideoScriptDto script;

         @Schema(description = "Posted caption for this platform.")
         String caption;

         @Schema(description = "Hashtags for this platform.")
         List<String> hashtags;

         @Schema(description = "Call-to-action.")
         String cta;

         @Schema(description = "TEXT description of the video to film.")
         String mediaPrompt;
     }
     ```
   - Observed missing fields: `voiceAligned`, `voiceScore`, `voiceNotes` are absent.

2. **`ContentVersion.java` (Entity)**:
   - File path: `d:\SU26\EXE\backend\src\main\java\com\aima\entity\ContentVersion.java`
   - Lines 63-70:
     ```java
     // Brand-voice check của AI cho đúng bản nền tảng này (FR-30).
     @Column(name = "voice_aligned")
     Boolean voiceAligned;

     @Column(name = "voice_score")
     Integer voiceScore;

     @Column(name = "voice_notes", columnDefinition = "text")
     String voiceNotes;
     ```
   - Target properties and types on the JPA entity are `Boolean voiceAligned`, `Integer voiceScore`, and `String voiceNotes`.

3. **`ContentVersionResponse.java` (Response DTO)**:
   - File path: `d:\SU26\EXE\backend\src\main\java\com\aima\dto\response\ContentVersionResponse.java`
   - Lines 56-64:
     ```java
     @Schema(description = "FR-30: whether the AI judged this version on-brand.")
     Boolean voiceAligned;

     @Schema(description = "FR-30: brand-voice match score 0-100.")
     Integer voiceScore;

     @Schema(description = "FR-30: short brand-voice notes from the AI.")
     String voiceNotes;
     ```

4. **`ContentItemServiceImpl.java` (Dirty-checking & Service Flow)**:
   - File path: `d:\SU26\EXE\backend\src\main\java\com\aima\service\Impl\ContentItemServiceImpl.java`
   - Lines 220-225 (in `updateVersion`):
     ```java
     List<Object> before = versionContent(version);
     contentItemMapper.updateVersion(request, version);
     if (before.equals(versionContent(version))) {
         ContentItemResponse unchanged = contentItemMapper.toResponse(item);
         return ApiResponse.success("Nội dung không đổi", unchanged);
     }
     ```
   - Lines 234-239:
     ```java
     version.setRevision(version.getRevision() + 1);
     holdService.onContentChanged(item);

     ContentItem saved = contentItemRepository.save(item); // version lưu qua cascade
     ContentItemResponse response = contentItemMapper.toResponse(saved);
     return ApiResponse.success("Cập nhật bản nội dung thành công", response);
     ```
   - Lines 326-329:
     ```java
     private static List<Object> versionContent(ContentVersion version) {
         return Arrays.asList(version.getScript(), version.getFormattedCaption(), version.getFormattedHashtag(),
                 version.getCta(), version.getMediaPrompt());
     }
     ```
   - Observed omission: `versionContent(version)` only packs `script`, `formattedCaption`, `formattedHashtag`, `cta`, and `mediaPrompt`. It does NOT include `voiceAligned`, `voiceScore`, or `voiceNotes`.

5. **`ContentItemMapper.java` and Generated `ContentItemMapperImpl.java`**:
   - File path: `d:\SU26\EXE\backend\src\main\java\com\aima\mapper\ContentItemMapper.java`
   - Lines 80-86:
     ```java
     // FR-33 trên bản nền tảng (B2) — cùng ngữ nghĩa partial update.
     @BeanMapping(nullValuePropertyMappingStrategy = NullValuePropertyMappingStrategy.IGNORE)
     @Mapping(target = "script", source = "script", qualifiedByName = "writeScript")
     @Mapping(target = "formattedCaption", source = "caption")
     @Mapping(target = "formattedHashtag", source = "hashtags", qualifiedByName = "joinHashtags")
     void updateVersion(ContentVersionUpdateRequest request, @MappingTarget ContentVersion version);
     ```
   - Generated implementation (`backend/target/generated-sources/annotations/com/aima/mapper/ContentItemMapperImpl.java`, lines 176-196):
     ```java
     @Override
     public void updateVersion(ContentVersionUpdateRequest request, ContentVersion version) {
         if ( request == null ) {
             return;
         }

         if ( request.getScript() != null ) {
             version.setScript( writeScript( request.getScript() ) );
         }
         if ( request.getCaption() != null ) {
             version.setFormattedCaption( request.getCaption() );
         }
         if ( request.getHashtags() != null ) {
             version.setFormattedHashtag( joinHashtags( request.getHashtags() ) );
         }
         if ( request.getCta() != null ) {
             version.setCta( request.getCta() );
         }
         if ( request.getMediaPrompt() != null ) {
             version.setMediaPrompt( request.getMediaPrompt() );
         }
     }
     ```
   - MapStruct behavior: Properties with identical names (`cta`, `mediaPrompt`) are automatically mapped if non-null under `NullValuePropertyMappingStrategy.IGNORE`. Adding `voiceAligned`, `voiceScore`, `voiceNotes` to `ContentVersionUpdateRequest` requires no additional explicit `@Mapping` annotations in `ContentItemMapper.java`.

6. **`ContentVersionMappingTest.java`**:
   - File path: `d:\SU26\EXE\backend\src\test\java\com\aima\content\ContentVersionMappingTest.java`
   - Lines 110-125 (`updateVersionIsPartial`):
     ```java
     @Test
     void updateVersionIsPartial() {
         ContentVersion version = mapper.toGeneratedVersion(sampleResult());
         mapper.updateVersion(ContentVersionUpdateRequest.builder()
                 .caption("Caption đã sửa tay")
                 .hashtags(List.of("moi"))
                 .build(), version);

         assertEquals("Caption đã sửa tay", version.getFormattedCaption());
         assertEquals("moi", version.getFormattedHashtag());
         // field bỏ trống giữ nguyên
         assertEquals("Da xỉn màu, lỗ chân lông to?",
                 mapper.parseScript(version.getScript()).getHook().getContent());
         assertEquals("Theo dõi kênh nhé!", version.getCta());
         assertNull(version.getPlatformName(), "mapper không tự gán platform — worker gán");
     }
     ```

### 1.2. Baseline Verification Commands & Results

1. `./mvnw test-compile` (cwd: `backend`):
   - Result: Exit code 0, `BUILD SUCCESS` in 2.485 s.
2. `./mvnw test -Dtest=ContentVersionMappingTest`:
   - Result: Exit code 0, 4 tests run, 0 failures, 0 errors in 0.416 s.
3. `./mvnw test -Dtest=ContentItemServiceImplTest`:
   - Result: Exit code 0, 8 tests run, 0 failures, 0 errors in 20.99 s.

---

## 2. Logic Chain

1. **Brand Voice Data Gap in Update Contract**:
   - Observation: `ContentVersionUpdateRequest.java` only exposes `script`, `caption`, `hashtags`, `cta`, `mediaPrompt`.
   - Reason: When the frontend or API caller attempts to update Brand Voice fields (e.g. after a re-check or manual edit in `ContentViewPanel`), those fields cannot currently be sent in `ContentVersionUpdateRequest`.
   - Deduction: Adding `Boolean voiceAligned`, `Integer voiceScore`, and `String voiceNotes` to `ContentVersionUpdateRequest` satisfies Requirement R2 and contract specification in `PROJECT.md` §3.

2. **Automatic Mapping Mechanism**:
   - Observation: MapStruct interface `ContentItemMapper` uses `@BeanMapping(nullValuePropertyMappingStrategy = NullValuePropertyMappingStrategy.IGNORE)`. Properties with matching names like `cta` and `mediaPrompt` are mapped automatically without `@Mapping` lines.
   - Deduction: Adding matching fields `voiceAligned`, `voiceScore`, and `voiceNotes` to `ContentVersionUpdateRequest` will cause MapStruct to automatically generate null-safe setters:
     ```java
     if ( request.getVoiceAligned() != null ) { version.setVoiceAligned( request.getVoiceAligned() ); }
     if ( request.getVoiceScore() != null ) { version.setVoiceScore( request.getVoiceScore() ); }
     if ( request.getVoiceNotes() != null ) { version.setVoiceNotes( request.getVoiceNotes() ); }
     ```
   - Zero changes to `ContentItemMapper.java` are required, preserving surgical cleanliness.

3. **Dirty-Checking & Revision Increment Failure**:
   - Observation: In `ContentItemServiceImpl.updateVersion()`, the system checks:
     `List<Object> before = versionContent(version);`
     `contentItemMapper.updateVersion(request, version);`
     `if (before.equals(versionContent(version))) { return ApiResponse.success("Nội dung không đổi", unchanged); }`
   - Observation: `versionContent()` only compares:
     `Arrays.asList(version.getScript(), version.getFormattedCaption(), version.getFormattedHashtag(), version.getCta(), version.getMediaPrompt())`.
   - Defect: If a user sends a PUT request updating solely Brand Voice metrics (`voiceAligned`, `voiceScore`, `voiceNotes`), `before.equals(versionContent(version))` evaluates to `true`! The method exits immediately with `"Nội dung không đổi"`. The changes are NEVER saved to the database, and `version.setRevision(...)` is NEVER incremented.
   - Deduction: Adding `version.getVoiceAligned()`, `version.getVoiceScore()`, and `version.getVoiceNotes()` to `versionContent()` ensures that any alteration to Brand Voice metrics triggers dirty detection, revision increment (`version.setRevision(version.getRevision() + 1)`), cascade saving via `contentItemRepository.save(item)`, and review hold synchronization.

4. **Preservation of No-op Behavior**:
   - Observation: `List.equals()` handles `null` elements safely and performs element-wise `.equals()`.
   - Deduction: If a caller sends null for voice fields (or identical values), `before.equals(versionContent(version))` remains `true`, avoiding spurious revision increments or unneeded database updates.

5. **Test Assertions in `ContentVersionMappingTest`**:
   - Observation: `ContentVersionMappingTest.updateVersionIsPartial()` tests partial updates using `sampleResult()` (which has `aligned=true, score=91, notes="Đúng giọng"`).
   - Deduction:
     - Adding assertions to `updateVersionIsPartial()` ensures that omitted voice fields remain unchanged.
     - Adding a dedicated test `updateVersionMapsBrandVoiceFields()` verifies that explicitly passed `voiceAligned`, `voiceScore`, and `voiceNotes` overwrite entity fields properly.
     - Adding `updateVersionAllowsPartialBrandVoiceUpdate()` verifies individual field partial replacement.

---

## 3. Caveats

1. **Validation Constraints**:
   - Neither `ContentItemUpdateRequest` nor `ContentVersionUpdateRequest` enforce `@NotNull` or `@Min`/`@Max` because every field is an optional partial update. `voiceScore` is a standard `Integer` (0-100). If range enforcement is ever needed at API boundary, `@Min(0) @Max(100)` can be added with appropriate jakarta validation, but currently existing request DTOs keep it optional.
2. **Review Status Impact**:
   - In `ContentItemServiceImpl.updateVersion()`, when dirty checking detects a change, it invokes `holdService.onContentChanged(item)`. If the post was previously `APPROVED`, any content change (including Brand Voice updates) reverts it to `NEED_REVIEW` to preserve editorial review integrity. This is intended system behavior.
3. **No Direct Scope Beyond M1.2**:
   - Frontend integration (M2) and worker inheritance (M1.1) are handled by separate agents/milestones. However, our proposed DTO contract exactly aligns with the frontend `ContentVersionUpdateInput` planned for M2.

---

## 4. Conclusion & Surgical Implementation Specification

### 4.1. Surgical Code Change Proposals

#### Target File 1: `backend/src/main/java/com/aima/dto/request/ContentVersionUpdateRequest.java`

Lines 38-40:
```diff
--- a/backend/src/main/java/com/aima/dto/request/ContentVersionUpdateRequest.java
+++ b/backend/src/main/java/com/aima/dto/request/ContentVersionUpdateRequest.java
@@ -38,4 +38,13 @@ public class ContentVersionUpdateRequest {
     @Schema(description = "TEXT description of the video to film.")
     String mediaPrompt;
+
+    @Schema(description = "FR-30: whether the AI or reviewer judged this version on-brand.")
+    Boolean voiceAligned;
+
+    @Schema(description = "FR-30: brand-voice match score 0-100.")
+    Integer voiceScore;
+
+    @Schema(description = "FR-30: short brand-voice notes from the AI or reviewer.")
+    String voiceNotes;
 }
```

#### Target File 2: `backend/src/main/java/com/aima/service/Impl/ContentItemServiceImpl.java`

Lines 326-329:
```diff
--- a/backend/src/main/java/com/aima/service/Impl/ContentItemServiceImpl.java
+++ b/backend/src/main/java/com/aima/service/Impl/ContentItemServiceImpl.java
@@ -326,4 +326,5 @@ public class ContentItemServiceImpl implements ContentItemService {
     private static List<Object> versionContent(ContentVersion version) {
         return Arrays.asList(version.getScript(), version.getFormattedCaption(), version.getFormattedHashtag(),
-                version.getCta(), version.getMediaPrompt());
+                version.getCta(), version.getMediaPrompt(),
+                version.getVoiceAligned(), version.getVoiceScore(), version.getVoiceNotes());
     }
```

#### Target File 3: `backend/src/test/java/com/aima/content/ContentVersionMappingTest.java`

Lines 118-124 and adding new test cases:
```diff
--- a/backend/src/test/java/com/aima/content/ContentVersionMappingTest.java
+++ b/backend/src/test/java/com/aima/content/ContentVersionMappingTest.java
@@ -118,6 +118,9 @@ class ContentVersionMappingTest {
         assertEquals("moi", version.getFormattedHashtag());
         // field bỏ trống giữ nguyên
         assertEquals("Da xỉn màu, lỗ chân lông to?",
                 mapper.parseScript(version.getScript()).getHook().getContent());
         assertEquals("Theo dõi kênh nhé!", version.getCta());
+        assertEquals(Boolean.TRUE, version.getVoiceAligned());
+        assertEquals(91, version.getVoiceScore());
+        assertEquals("Đúng giọng", version.getVoiceNotes());
         assertNull(version.getPlatformName(), "mapper không tự gán platform — worker gán");
     }
+
+    @Test
+    void updateVersionUpdatesBrandVoiceFields() {
+        ContentVersion version = mapper.toGeneratedVersion(sampleResult());
+        mapper.updateVersion(ContentVersionUpdateRequest.builder()
+                .voiceAligned(false)
+                .voiceScore(65)
+                .voiceNotes("Cần điều chỉnh tông giọng cho tự nhiên hơn")
+                .build(), version);
+
+        assertEquals(Boolean.FALSE, version.getVoiceAligned());
+        assertEquals(65, version.getVoiceScore());
+        assertEquals("Cần điều chỉnh tông giọng cho tự nhiên hơn", version.getVoiceNotes());
+        // Các trường khác giữ nguyên
+        assertEquals("Chỉ 3 bước mỗi ngày, da bạn đổi khác bất ngờ.", version.getFormattedCaption());
+        assertEquals("skincare,toigian", version.getFormattedHashtag());
+        assertEquals("Theo dõi kênh nhé!", version.getCta());
+    }
+
+    @Test
+    void updateVersionAllowsPartialBrandVoiceUpdate() {
+        ContentVersion version = mapper.toGeneratedVersion(sampleResult());
+        mapper.updateVersion(ContentVersionUpdateRequest.builder()
+                .voiceScore(95)
+                .build(), version);
+
+        assertEquals(Boolean.TRUE, version.getVoiceAligned());
+        assertEquals(95, version.getVoiceScore());
+        assertEquals("Đúng giọng", version.getVoiceNotes());
+    }
```

#### Recommended Addition: `backend/src/test/java/com/aima/content/ContentItemServiceImplTest.java`

To directly verify service-level dirty checking, revision incrementing, and persistence:
```java
    @Test
    void brandVoiceEditUpdatesDirtyCheckingAndIncrementsRevision() {
        ContentItem item = item(ContentItemStatus.FORMATTED, ReviewStatus.NONE);
        ContentVersion version = version(item);
        int initialRevision = version.getRevision();

        // 1. Cập nhật brand voice fields
        ContentItemResponse updated = service.updateVersion(email, item.getId(), version.getId(),
                ContentVersionUpdateRequest.builder()
                        .voiceAligned(true)
                        .voiceScore(88)
                        .voiceNotes("Tông giọng rất tốt")
                        .build()).getResult();

        ContentVersionResponse updatedVersion = updated.getVersions().getFirst();
        assertEquals(Boolean.TRUE, updatedVersion.getVoiceAligned());
        assertEquals(88, updatedVersion.getVoiceScore());
        assertEquals("Tông giọng rất tốt", updatedVersion.getVoiceNotes());

        // 2. Kiểm tra trong DB: revision tăng, dữ liệu lưu bền vững
        ContentVersion reloaded = contentVersionRepository.findById(version.getId()).orElseThrow();
        assertEquals(initialRevision + 1, reloaded.getRevision());
        assertEquals(Boolean.TRUE, reloaded.getVoiceAligned());
        assertEquals(88, reloaded.getVoiceScore());
        assertEquals("Tông giọng rất tốt", reloaded.getVoiceNotes());

        // 3. Cập nhật lại với cùng giá trị -> No-op ("Nội dung không đổi"), revision không tăng
        ApiResponse<ContentItemResponse> noop = service.updateVersion(email, item.getId(), version.getId(),
                ContentVersionUpdateRequest.builder()
                        .voiceAligned(true)
                        .voiceScore(88)
                        .voiceNotes("Tông giọng rất tốt")
                        .build());
        assertEquals("Nội dung không đổi", noop.getMessage());
        ContentVersion afterNoop = contentVersionRepository.findById(version.getId()).orElseThrow();
        assertEquals(initialRevision + 1, afterNoop.getRevision(), "Revision không tăng khi nội dung không đổi");
    }
```

---

## 5. Verification Method

To verify these changes after implementation:

1. **Compilation Check**:
   ```bash
   cd backend
   ./mvnw test-compile
   ```
   - Expectation: Compiles cleanly with exit code 0.
   - Verification: `target/generated-sources/annotations/com/aima/mapper/ContentItemMapperImpl.java` includes null-checked assignments for `voiceAligned`, `voiceScore`, and `voiceNotes`.

2. **Mapper Unit Tests**:
   ```bash
   cd backend
   ./mvnw test -Dtest=ContentVersionMappingTest
   ```
   - Expectation: Tests run: 6 (4 original + 2 new), Failures: 0, Errors: 0.

3. **Service & Dirty-Checking Unit Tests**:
   ```bash
   cd backend
   ./mvnw test -Dtest=ContentItemServiceImplTest
   ```
   - Expectation: All tests pass, verifying that brand voice updates trigger revision increments and save to database.

4. **Integration Test Suite**:
   ```bash
   cd backend
   ./mvnw test -Dtest=SchedulePolicyIntegrationTest,ContentFormattingLateResultTest
   ```
   - Expectation: All dependent tests continue to pass with 0 regressions.

5. **Invalidation Conditions**:
   - If MapStruct generates mapping warnings or fails to map `voiceAligned`/`voiceScore`/`voiceNotes`, check that field names and types in `ContentVersionUpdateRequest` match `ContentVersion` precisely (`Boolean`, `Integer`, `String`).
   - If `updateVersion` fails to detect Brand Voice changes, verify that all three fields are present in `ContentItemServiceImpl.versionContent()`.
