# Handoff Report — Explorer M2.1 (Frontend Data Contracts & Service Mapping)

## 1. Observation

### 1.1 API Client Contract: `frontend/src/api/contentGeneration.ts`
- **Existing Definition of `ContentVersionResponse`** (lines 66–82):
  ```ts
  export interface ContentVersionResponse {
    id: string;
    platformName: Platform;
    formattedCaption: string | null;
    formattedHashtags: string[];
    mediaFormat: string | null;
    script: VideoScriptResponse | null;
    cta: string | null;
    mediaPrompt: string | null;
    imagePrompt: string | null;
    voiceAligned: boolean | null;
    voiceScore: number | null;
    voiceNotes: string | null;
    status: ContentVersionStatus;
    scheduleStatus?: VersionScheduleStatus | null;
  }
  ```
  *Finding*: `voiceAligned`, `voiceScore`, and `voiceNotes` are already defined on the wire response from the backend.

- **Existing Definition of `ContentVersionUpdateInput`** (lines 261–267):
  ```ts
  // FR-33: chỉnh sửa thủ công MỘT bản nền tảng — partial update, field bỏ qua giữ nguyên.
  export interface ContentVersionUpdateInput {
    script?: VideoScriptResponse;
    caption?: string;
    hashtags?: string[];
    cta?: string;
    mediaPrompt?: string;
  }
  ```
  *Finding*: `ContentVersionUpdateInput` lacks `voiceScore`, `voiceAligned`, and `voiceNotes`. As a result, any brand voice metrics collected or updated on the frontend cannot be passed to `updateContentVersion` (lines 270–280).

### 1.2 Backend DTO and Mapping Alignment
- **Backend DTO**: `backend/src/main/java/com/aima/dto/request/ContentVersionUpdateRequest.java` (lines 41–48):
  ```java
  @Schema(description = "FR-30: whether the AI or reviewer judged this version on-brand.")
  Boolean voiceAligned;

  @Schema(description = "FR-30: brand-voice match score 0-100.")
  Integer voiceScore;

  @Schema(description = "FR-30: short brand-voice notes from the AI or reviewer.")
  String voiceNotes;
  ```
- **Backend Mapping**: `backend/src/main/java/com/aima/mapper/ContentItemMapper.java` (lines 81–85):
  ```java
  @BeanMapping(nullValuePropertyMappingStrategy = NullValuePropertyMappingStrategy.IGNORE)
  @Mapping(target = "script", source = "script", qualifiedByName = "writeScript")
  @Mapping(target = "formattedCaption", source = "caption")
  @Mapping(target = "formattedHashtag", source = "hashtags", qualifiedByName = "joinHashtags")
  void updateVersion(ContentVersionUpdateRequest request, @MappingTarget ContentVersion version);
  ```
  *Finding*: MapStruct uses `NullValuePropertyMappingStrategy.IGNORE`. If `voiceScore`, `voiceAligned`, or `voiceNotes` are `null` (or omitted from the JSON request), existing DB values remain unchanged. If non-null values are sent, MapStruct updates the entity, and `ContentItemServiceImpl.versionContent` detects the change and increments the revision.

### 1.3 Domain Types: `frontend/src/api/contentCreationService.ts`
- **Existing Definition of `BrandVoiceCheck`** (lines 85–91):
  ```ts
  /** Kết quả "Kiểm tra brand voice" — % phù hợp + nhận xét từng khía cạnh. */
  export interface BrandVoiceCheck {
    score: number; // 0–100
    tone: string;
    wording: string;
    message: string;
    summary: string;
  }
  ```
  *Finding*: `BrandVoiceCheck` does not have an `aligned` field. Any boolean alignment verdict from the backend (`voiceAligned`) is discarded during conversion.

- **Existing Mapping Function `toContentVersion`** (lines 432–454):
  ```ts
  function toContentVersion(v: ContentVersionResponse): ContentVersion {
    return {
      id: v.id,
      platform: v.platformName,
      status: v.status,
      scheduleStatus: v.scheduleStatus ?? null,
      script: toScript(v.script),
      caption: v.formattedCaption ?? "",
      hashtags: (v.formattedHashtags ?? []).map((h) => (h.startsWith("#") ? h : `#${h}`)),
      cta: v.cta ?? "",
      mediaPrompt: v.mediaPrompt ?? "",
      imageUrl: null,
      brandVoice: {
        score: v.voiceScore ?? 0,
        summary: v.voiceNotes ?? "",
        tone: "",
        wording: "",
        message: "",
      },
      createdAt: new Date().toISOString(),
    };
  }
  ```
  *Finding*:
  1. `v.voiceAligned` is completely ignored and dropped.
  2. If `v.voiceScore` is `null` (e.g. unexamined version), it defaults to `0`. If downstream code were to map `aligned` to `false` when `score === 0`, it would mask the valid unexamined state (`null`) as "failed/unaligned".

- **Existing Save Function `saveVersionEdit`** (lines 328–340):
  ```ts
  export async function saveVersionEdit(
    itemId: string,
    version: ContentVersion,
  ): Promise<{ item: ContentListItem; versions: ContentVersion[] }> {
    const r = await updateContentVersion(itemId, version.id, {
      script: toScriptPayload(version.script),
      caption: version.caption,
      hashtags: version.hashtags.map((h) => h.replace(/^#+/, "")),
      cta: version.cta,
      mediaPrompt: version.mediaPrompt,
    });
    return { item: toContentListItem(r), versions: (r.versions ?? []).map(toContentVersion) };
  }
  ```
  *Finding*: `saveVersionEdit` forwards only `script`, `caption`, `hashtags`, `cta`, and `mediaPrompt`. None of `version.brandVoice` (`score`, `aligned`, `summary`) are passed in the `updateContentVersion` payload.

---

## 2. Logic Chain

1. **Root Cause of Brand Voice Loss on Edit**:
   - In `ContentViewPanel.tsx`, editing a post version updates local state `draft`.
   - When the user clicks "Lưu", `saveVersionEdit(item.id, draft)` is invoked.
   - `saveVersionEdit` passes an object to `updateContentVersion`, but omits `voiceScore`, `voiceAligned`, and `voiceNotes` because `ContentVersionUpdateInput` didn't declare them.
   - Consequently, the backend `PUT /content-items/{itemId}/versions/{versionId}` never receives brand voice data, and any rechecked or existing brand voice metrics are either ignored or unpersisted.

2. **Root Cause of Missing Alignment Status**:
   - When the backend generates content or evaluates brand voice, it sets `voiceAligned` (Boolean) on `ContentVersion`.
   - `ContentVersionResponse` contains `voiceAligned: boolean | null`.
   - However, `BrandVoiceCheck` had no `aligned` property, and `toContentVersion` never mapped `v.voiceAligned`.
   - The frontend was forced to infer alignment dynamically from `score >= threshold`. If the backend had evaluated alignment or if a custom alignment was returned, it was lost.

3. **Risk of Masking Valid States ("Avoid mapping null to 0")**:
   - In `ContentVersionResponse`, a version that has NEVER been checked has `voiceScore: null` and `voiceAligned: null`.
   - In `toContentVersion`, `v.voiceScore ?? 0` produces `0`. Throughout the frontend UI (`BrandVoicePanel.tsx:14`, `contentCreationService.ts:135`), `score === 0` signifies "Chưa kiểm tra" (Unchecked).
   - If downstream code maps `aligned: v.voiceAligned ?? false`, then an unexamined post becomes `aligned: false` ("Cần xem lại" / Needs review), masking the true `null` ("Chưa kiểm tra") state!
   - Similarly, in `saveVersionEdit`: if an unexamined version (`score === 0` and `aligned == null`) transmits `voiceScore: 0` and `voiceAligned: false` to the backend, the backend database will overwrite `null` with `0` and `false`!
   - Therefore, in `saveVersionEdit`, brand voice fields must only be transmitted when brand voice was actually evaluated (`score > 0` or `aligned != null`). When unexamined, they should remain `undefined` so that Axios/fetch omits them from the JSON body and backend MapStruct preserves the existing DB state (`IGNORE`).

---

## 3. Caveats

1. **Subagent Scope Boundaries**:
   - M2.1 is strictly responsible for `frontend/src/api/contentGeneration.ts` and `frontend/src/api/contentCreationService.ts`.
   - Component rendering in `BrandVoicePanel.tsx` is investigated by Explorer M2.2.
   - UI wire-up, recheck handler, and edit/view mode in `ContentViewPanel.tsx` are investigated by Explorer M2.3.
2. **Backend MapStruct `IGNORE` Strategy**:
   - In `backend/src/main/java/com/aima/mapper/ContentItemMapper.java`, `nullValuePropertyMappingStrategy = NullValuePropertyMappingStrategy.IGNORE`. Omitting fields (sending `undefined` in TS, which serializes without the key in JSON) ensures existing database values are retained.
3. **Mock Brand Voice Endpoint**:
   - `checkBrandVoice` in `contentCreationService.ts` currently mocks latency and score (`mockBrandVoice`). When `checkBrandVoice` is updated, it should also include `aligned: check.score >= 70` to match the extended `BrandVoiceCheck`.

---

## 4. Conclusion & Proposed Code Changes

### 4.1 Changes in `frontend/src/api/contentGeneration.ts`

**Location**: Lines 261–267.
**Action**: Extend `ContentVersionUpdateInput` to include `voiceScore?: number; voiceAligned?: boolean; voiceNotes?: string;`.

#### Before:
```ts
// FR-33: chỉnh sửa thủ công MỘT bản nền tảng — partial update, field bỏ qua giữ nguyên.
export interface ContentVersionUpdateInput {
  script?: VideoScriptResponse;
  caption?: string;
  hashtags?: string[];
  cta?: string;
  mediaPrompt?: string;
}
```

#### After:
```ts
// FR-33: chỉnh sửa thủ công MỘT bản nền tảng — partial update, field bỏ qua giữ nguyên.
export interface ContentVersionUpdateInput {
  script?: VideoScriptResponse;
  caption?: string;
  hashtags?: string[];
  cta?: string;
  mediaPrompt?: string;
  voiceAligned?: boolean;
  voiceScore?: number;
  voiceNotes?: string;
}
```

---

### 4.2 Changes in `frontend/src/api/contentCreationService.ts`

#### A. Extend `BrandVoiceCheck` (Lines 85–91)
**Action**: Add `aligned?: boolean | null;`.

##### Before:
```ts
/** Kết quả "Kiểm tra brand voice" — % phù hợp + nhận xét từng khía cạnh. */
export interface BrandVoiceCheck {
  score: number; // 0–100
  tone: string;
  wording: string;
  message: string;
  summary: string;
}
```

##### After:
```ts
/** Kết quả "Kiểm tra brand voice" — % phù hợp + nhận xét từng khía cạnh. */
export interface BrandVoiceCheck {
  score: number; // 0–100
  aligned?: boolean | null;
  tone: string;
  wording: string;
  message: string;
  summary: string;
}
```

---

#### B. Update `toContentVersion` (Lines 432–454)
**Action**: Map `voiceScore`, `voiceNotes`, and `voiceAligned`. Avoid mapping `null` to `false` or masking valid states.

##### Before:
```ts
function toContentVersion(v: ContentVersionResponse): ContentVersion {
  return {
    id: v.id,
    platform: v.platformName,
    status: v.status,
    scheduleStatus: v.scheduleStatus ?? null,
    script: toScript(v.script),
    caption: v.formattedCaption ?? "",
    hashtags: (v.formattedHashtags ?? []).map((h) => (h.startsWith("#") ? h : `#${h}`)),
    cta: v.cta ?? "",
    mediaPrompt: v.mediaPrompt ?? "",
    // Ảnh chưa sinh (tính năng chưa làm); imagePrompt backend đã lưu, đón cho lượt sau.
    imageUrl: null,
    brandVoice: {
      score: v.voiceScore ?? 0,
      summary: v.voiceNotes ?? "",
      tone: "",
      wording: "",
      message: "",
    },
    createdAt: new Date().toISOString(),
  };
}
```

##### After:
```ts
function toContentVersion(v: ContentVersionResponse): ContentVersion {
  return {
    id: v.id,
    platform: v.platformName,
    status: v.status,
    scheduleStatus: v.scheduleStatus ?? null,
    script: toScript(v.script),
    caption: v.formattedCaption ?? "",
    hashtags: (v.formattedHashtags ?? []).map((h) => (h.startsWith("#") ? h : `#${h}`)),
    cta: v.cta ?? "",
    mediaPrompt: v.mediaPrompt ?? "",
    // Ảnh chưa sinh (tính năng chưa làm); imagePrompt backend đã lưu, đón cho lượt sau.
    imageUrl: null,
    brandVoice: {
      score: v.voiceScore ?? 0,
      aligned: v.voiceAligned ?? (v.voiceScore != null && v.voiceScore > 0 ? v.voiceScore >= 70 : null),
      summary: v.voiceNotes ?? "",
      tone: "",
      wording: "",
      message: "",
    },
    createdAt: new Date().toISOString(),
  };
}
```
*Design Note*: If `v.voiceAligned` is `null` and `v.voiceScore` is `null` (or 0), `aligned` evaluates to `null` (preserving "Chưa kiểm tra"). If `v.voiceAligned` is explicitly `true` or `false`, that value is preserved. If `v.voiceScore` is present but `voiceAligned` is null, it falls back to `>= 70`.

---

#### C. Update `saveVersionEdit` (Lines 328–340)
**Action**: Forward `voiceScore`, `voiceAligned`, and `voiceNotes` when valid, avoiding transmitting 0/false when brand voice is null/unexamined.

##### Before:
```ts
export async function saveVersionEdit(
  itemId: string,
  version: ContentVersion,
): Promise<{ item: ContentListItem; versions: ContentVersion[] }> {
  const r = await updateContentVersion(itemId, version.id, {
    script: toScriptPayload(version.script),
    caption: version.caption,
    hashtags: version.hashtags.map((h) => h.replace(/^#+/, "")),
    cta: version.cta,
    mediaPrompt: version.mediaPrompt,
  });
  return { item: toContentListItem(r), versions: (r.versions ?? []).map(toContentVersion) };
}
```

##### After:
```ts
export async function saveVersionEdit(
  itemId: string,
  version: ContentVersion,
): Promise<{ item: ContentListItem; versions: ContentVersion[] }> {
  const hasVoice =
    (version.brandVoice?.score !== undefined && version.brandVoice.score > 0) ||
    (version.brandVoice?.aligned !== undefined && version.brandVoice.aligned !== null);

  const r = await updateContentVersion(itemId, version.id, {
    script: toScriptPayload(version.script),
    caption: version.caption,
    hashtags: version.hashtags.map((h) => h.replace(/^#+/, "")),
    cta: version.cta,
    mediaPrompt: version.mediaPrompt,
    voiceScore: hasVoice ? version.brandVoice.score : undefined,
    voiceAligned: hasVoice
      ? (version.brandVoice.aligned ?? (version.brandVoice.score >= 70))
      : undefined,
    voiceNotes: hasVoice && version.brandVoice.summary ? version.brandVoice.summary : undefined,
  });
  return { item: toContentListItem(r), versions: (r.versions ?? []).map(toContentVersion) };
}
```

---

#### D. (Optional Enhancement) Update `checkBrandVoice` (Lines 653–656)
**Action**: Populate `aligned` in the mock brand voice result.

##### Before:
```ts
export async function checkBrandVoice(input: CheckBrandVoiceInput): Promise<BrandVoiceCheck> {
  await delay(900);
  return mockBrandVoice(lang(), (input.script.hook.content.length + input.caption.length) % 4);
}
```

##### After:
```ts
export async function checkBrandVoice(input: CheckBrandVoiceInput): Promise<BrandVoiceCheck> {
  await delay(900);
  const check = mockBrandVoice(lang(), (input.script.hook.content.length + input.caption.length) % 4);
  return {
    ...check,
    aligned: check.score >= 70,
  };
}
```

---

## 5. Verification Method

### 5.1 Static Verification & TypeScript Compilation
1. In directory `frontend/`:
   ```bash
   npm run build
   ```
2. Verify `tsc` produces 0 type errors and `vite build` finishes successfully.

### 5.2 Unit Test Execution
1. In directory `frontend/`:
   ```bash
   npm run test
   ```
2. Verify all 95 tests pass without regressions (`pass 95`, `fail 0`).

### 5.3 Behavioral & Data Flow Verification
1. Call `toContentVersion({ ...mockVersion, voiceScore: 88, voiceAligned: true, voiceNotes: "Good" })`:
   - Verify `result.brandVoice.score === 88`
   - Verify `result.brandVoice.aligned === true`
   - Verify `result.brandVoice.summary === "Good"`
2. Call `toContentVersion({ ...mockVersion, voiceScore: null, voiceAligned: null, voiceNotes: null })`:
   - Verify `result.brandVoice.score === 0`
   - Verify `result.brandVoice.aligned === null`
   - Verify `result.brandVoice.summary === ""`
3. Call `saveVersionEdit("item-1", { ...version, brandVoice: { score: 85, aligned: true, summary: "Matches voice" } })`:
   - Verify payload sent to `updateContentVersion` includes `{ voiceScore: 85, voiceAligned: true, voiceNotes: "Matches voice" }`.
4. Call `saveVersionEdit("item-1", { ...version, brandVoice: { score: 0, aligned: null, summary: "" } })`:
   - Verify payload sent to `updateContentVersion` does NOT include `voiceScore`, `voiceAligned`, or `voiceNotes` (they are `undefined`, omitted from JSON), thus preserving backend DB state.

### 5.4 Invalidation Conditions
- If `npm run build` fails due to property mismatch or missing fields.
- If saving version edits resets `voice_score` or `voice_aligned` to `0`/`false` on unexamined versions.
- If editing a version with brand voice drops the score/alignment from the backend database.
