# Handoff Report — Explorer Survey 3 (Frontend Module)

## 1. Observation

### 1.1 Component Locations and UI Hierarchy
- **Parent Container**: `frontend/src/components/create/ContentList.tsx`
  - Lines 220–228: When `viewing` is active, replaces table with `<ContentViewPanel item={viewing.item} startInEdit={viewing.edit} onClose={closeViewing} onChanged={refresh} />`.
- **Primary Detail Component**: `frontend/src/components/create/ContentViewPanel.tsx`
  - Lines 67–79: `export default function ContentViewPanel({ item, onClose, onChanged, startInEdit = false })`.
  - Lines 307–331: Sticky two-tier header with title, status badges (`StatusBadge`), AI chip, action buttons.
  - Lines 337–365: Two-column grid (`stacked ? '1fr' : '1.2fr .9fr'`):
    - **Left Column**: `<PlatformTabs>` (line 340), `<VersionTabs>` (line 343: `script` | `content` | `media`), and either `editForm` (lines 206–247) or read-only views (`ScriptView`, `ContentFieldsView`, `MediaPromptView` in `VersionContent.tsx`, lines 347–350).
    - **Right Column**: `<SourceInfoCard info={srcInfo} />` (line 355), `<BrandVoicePanel check={shown.brandVoice} />` (line 356), and sticky `<PostImagePreview>` (lines 361–363).
- **Brand Voice Panel Component**: `frontend/src/components/create/BrandVoicePanel.tsx`
  - Lines 18–32:
    ```tsx
    export default function BrandVoicePanel({
      check,
      busy = false,
      baselineScore,
      onRecheck,
      threshold = DEFAULT_VOICE_THRESHOLD,
      collapsible = false,
    }: {
      check: BrandVoiceCheck | null;
      busy?: boolean;
      baselineScore?: number;
      onRecheck?: () => void;
      threshold?: number;
      collapsible?: boolean;
    })
    ```
  - Lines 35–37:
    ```tsx
    const checked = !!check && check.score > 0;
    const aligned = checked && check.score >= threshold;
    const dropped = checked && baselineScore !== undefined && baselineScore > 0 && check.score < baselineScore;
    ```
  - Lines 50–54: Badge rendering when `checked` is true:
    ```tsx
    const badge = checked ? (
      <span style={{ background: verdict.bg, color: verdict.color, borderRadius: 9, padding: '4px 12px', fontSize: 13, fontWeight: 800 }}>
        {verdict.text} ({check.score}%)
      </span>
    ) : null;
    ```
  - Lines 56–65: Action button rendering:
    ```tsx
    const actionBtn = onRecheck && (
      <button
        onClick={onRecheck}
        disabled={busy}
        className="btn-soft"
        ...
      >
        <Icon icon={RefreshCw} size={12} stroke={C.primary} />{checked ? t.cwVoiceRecheck : t.cwVoiceCheck}
      </button>
    );
    ```
  - Lines 93–97: Fallback when `check` exists but `check.score === 0` (or `checked` is false):
    ```tsx
    : check ? (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12.5, color: C.textMuted }}>
        <span style={{ background: C.surfaceMuted, color: C.textSecondary, borderRadius: 9, padding: '4px 12px', fontSize: 12.5, fontWeight: 700 }}>{t.cwVoiceUnchecked}</span>
      </div>
    )
    ```
    which displays verbatim: `"Chưa kiểm tra"` (`cwVoiceUnchecked`).

### 1.2 TypeScript Interfaces and Data Flow
- **DTOs from API**: `frontend/src/api/contentGeneration.ts`
  - Lines 66–82:
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
    Here `voiceAligned`, `voiceScore`, and `voiceNotes` are present on the wire from the backend.
- **Frontend Domain Interfaces**: `frontend/src/api/contentCreationService.ts`
  - Lines 85–91:
    ```ts
    export interface BrandVoiceCheck {
      score: number; // 0–100
      tone: string;
      wording: string;
      message: string;
      summary: string;
    }
    ```
    Note: `voiceAligned` is **absent** from `BrandVoiceCheck`.
  - Lines 94–113:
    ```ts
    export interface ContentVersion {
      id: string;
      platform: Platform;
      status: ContentVersionStatus;
      scheduleStatus: VersionScheduleStatus | null;
      script: VideoScript;
      caption: string;
      hashtags: string[];
      cta: string;
      mediaPrompt: string;
      imageUrl: string | null;
      brandVoice: BrandVoiceCheck;
      createdAt: string;
    }
    ```
- **Mapping Function**: `frontend/src/api/contentCreationService.ts`
  - Lines 432–454:
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
    Direct observation:
    1. If `v.voiceScore` is `null` (which happens because platform formatting does not inherit voice fields), `score` defaults to `0`.
    2. `v.voiceAligned` is completely discarded/ignored.
    3. `summary` takes `v.voiceNotes ?? ""`.

### 1.3 Edit and Save Flow
- **Edit initiation**: `frontend/src/components/create/ContentViewPanel.tsx` lines 167–171:
  - User clicks "Sửa" (`startEdit`): `setDraft(cloneVersion(version)); setHashtagText(version.hashtags.join(' '));`.
  - `cloneVersion(v)` creates a copy of `version` with deep cloned `script`, retaining `brandVoice: v.brandVoice`.
- **Edit fields**:
  - `tab === 'script'`: `ScriptSections` (lines 210–218).
  - `tab === 'content'`: `AutoGrowTextarea` for `caption`, `input` for `hashtags`, `AutoGrowTextarea` for `cta` (lines 224–238).
  - `tab === 'media'`: `AutoGrowTextarea` for `mediaPrompt` (lines 241–245).
- **Save execution**: `frontend/src/components/create/ContentViewPanel.tsx` lines 174–189:
  ```tsx
  const saveEdit = async () => {
    if (!draft || savingEdit) return;
    setSavingEdit(true);
    try {
      const res = await saveVersionEdit(item.id, draft);
      setVersions(res.versions);
      setStatus(res.item.status);
      setReview(res.item.reviewStatus);
      setDraft(null);
      onChanged?.();
    } catch (e) {
      toast.error(`${t.cvEditError}: ${(e as ApiError).message}`);
    } finally {
      setSavingEdit(false);
    }
  };
  ```
- **Service call**: `frontend/src/api/contentCreationService.ts` lines 328–340:
  ```tsx
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
- **API update payload**: `frontend/src/api/contentGeneration.ts` lines 261–267:
  ```ts
  export interface ContentVersionUpdateInput {
    script?: VideoScriptResponse;
    caption?: string;
    hashtags?: string[];
    cta?: string;
    mediaPrompt?: string;
  }
  ```
  Direct observation: `ContentVersionUpdateInput` does not accept `voiceScore`, `voiceAligned`, or `voiceNotes`. None of the brand voice metrics in `draft.brandVoice` are transmitted to the backend on save.

### 1.4 Re-check and Sync Flow
- **In `ContentViewPanel.tsx`**:
  - Line 356: `<BrandVoicePanel check={shown.brandVoice} />`.
  - Direct observation: `onRecheck`, `busy`, `baselineScore`, and `threshold` are **omitted**.
  - In `BrandVoicePanel.tsx`: `actionBtn` is conditional on `onRecheck && (...)`. Because `onRecheck` is not passed, no "Kiểm tra lại" (Re-check) button is rendered at all in `ContentViewPanel`.
- **Existing Recheck Hook**: `frontend/src/components/create/useBrandVoiceCheck.ts` lines 12–39:
  - Used in `FinalizeStep.tsx` (line 136) and `GenerateStep.tsx` (line 81).
  - Calls `checkBrandVoice({ brandId, platform, script, caption })` and updates local state via `onPatchVersion(version.id, { brandVoice })`.
- **Existing Service function**: `frontend/src/api/contentCreationService.ts` lines 653–656:
  ```ts
  // TODO(api): POST /content-items/check-brand-voice { brandId, platform, post, caption }
  // → BrandVoiceCheck. Backend cần bổ sung endpoint.
  export async function checkBrandVoice(input: CheckBrandVoiceInput): Promise<BrandVoiceCheck> {
    await delay(900);
    return mockBrandVoice(lang(), (input.script.hook.content.length + input.caption.length) % 4);
  }
  ```

### 1.5 Build and Test Verification
- Executed `npm run build` in `frontend/`:
  - `tsc`: 0 errors.
  - `vite build`: Succeeded in 3.09s, generated assets in `dist/`.
- Executed `npm run test` in `frontend/`:
  - Output: `1..95`, `pass 95`, `fail 0`, duration 2752ms.

---

## 2. Logic Chain

1. **Why Brand Voice Shows "Chưa kiểm tra" in `ContentViewPanel`**:
   - `ContentViewPanel` fetches content detail using `getContentDetail(item.id)`, which maps `versions` via `toContentVersion(v)`.
   - When a post version is formatted per platform, the backend (`ContentFormattingWorkerServiceImpl.java:257-260`) copies only `script` and `mediaPrompt` from the source version; it does not inherit `voiceScore`, `voiceNotes`, or `voiceAligned`.
   - As a result, the database columns `voice_score`, `voice_notes`, and `voice_aligned` in `content_versions` are `null`.
   - When returned to the frontend, `toContentVersion` maps `v.voiceScore ?? 0` -> `score = 0`.
   - In `BrandVoicePanel.tsx:35`, `checked` evaluates to `!!check && check.score > 0`. Because `check.score === 0`, `checked` is `false`.
   - `BrandVoicePanel.tsx:93` therefore enters the fallback branch for `checked === false && check !== null`: rendering `{t.cwVoiceUnchecked}` ("Chưa kiểm tra").

2. **Why Re-check is Inaccessible in `ContentViewPanel`**:
   - In `BrandVoicePanel.tsx:56`, the action button (`actionBtn`) is only rendered when `onRecheck` is provided.
   - `ContentViewPanel.tsx:356` only passes `check={shown.brandVoice}`, omitting `onRecheck`.
   - Hence, the user has no button to trigger a brand voice check/re-check inside `ContentViewPanel`.

3. **Why Brand Voice Edits Are Lost Upon Saving in `ContentViewPanel`**:
   - When a user edits content in `ContentViewPanel`, `draft` holds the modified `caption`, `script`, `hashtags`, `cta`, `mediaPrompt`, and `brandVoice`.
   - When user clicks "Lưu", `ContentViewPanel.saveEdit` calls `saveVersionEdit(item.id, draft)`.
   - `saveVersionEdit` in `contentCreationService.ts` calls `updateContentVersion` with an object conforming to `ContentVersionUpdateInput`.
   - `ContentVersionUpdateInput` in `contentGeneration.ts` only declares `script`, `caption`, `hashtags`, `cta`, and `mediaPrompt`. It does not include `voiceScore`, `voiceAligned`, or `voiceNotes`.
   - The backend `PUT /content-items/{itemId}/versions/{versionId}` only maps and updates those 5 fields.
   - After saving, `saveVersionEdit` maps the backend response back to `ContentVersion[]` and calls `setVersions(res.versions)`.
   - Since backend still returns the existing DB values (or null), any locally rechecked or updated Brand Voice metrics are overwritten and lost.

4. **Why `voiceAligned` is Not Preserved**:
   - `ContentVersionResponse` contains `voiceAligned: boolean | null`.
   - `BrandVoiceCheck` does not have an `aligned` field.
   - `toContentVersion` does not map `v.voiceAligned`.
   - `BrandVoicePanel` computes `aligned = checked && check.score >= threshold` dynamically. If backend evaluated alignment or if a custom alignment was returned, it is dropped on the frontend.

---

## 3. Caveats

1. **External AI Brand Voice Endpoint**: `contentCreationService.ts:checkBrandVoice` is currently marked with `TODO(api)` and runs via mock delay (`mockBrandVoice`). If backend exposes a live `POST /content-items/check-brand-voice` endpoint, `checkBrandVoice` can be easily routed there; otherwise, the recheck action works via `checkBrandVoice` and persists the resulting metrics (`voiceScore`, `voiceAligned`, `voiceNotes`) through `updateContentVersion` into the database.
2. **Settings Threshold**: In `ContentViewPanel`, publishing settings (`getPublishingSettings()`) are not yet queried to retrieve `brandVoiceThreshold`, so `BrandVoicePanel` defaults to `DEFAULT_VOICE_THRESHOLD = 70`. Querying `getPublishingSettings` in `ContentViewPanel` or falling back to 70 aligns it with `FinalizeStep`.
3. **Backend Scope Dependency**: The frontend fix requires coordinating with backend Explorer Survey 2 so that `PUT /content-items/{itemId}/versions/{versionId}` accepts `voiceScore`, `voiceAligned`, and `voiceNotes` in `ContentVersionUpdateRequest`.

---

## 4. Conclusion

The display of "Chưa kiểm tra" in `ContentViewPanel` and the inability to save/re-check Brand Voice are caused by three specific frontend gaps plus backend formatting omission:
1. **Frontend Display & Mapping**: `toContentVersion` maps `v.voiceScore ?? 0` and drops `v.voiceAligned`. Because backend resets voice fields to null during platform formatting, `score = 0`, causing `BrandVoicePanel` to show "Chưa kiểm tra".
2. **Missing Recheck Prop in `ContentViewPanel`**: Line 356 of `ContentViewPanel.tsx` passes only `check={shown.brandVoice}`, leaving `onRecheck`, `busy`, `baselineScore`, and `threshold` unpassed, which hides the re-check button.
3. **Missing Brand Voice in Save Payload**: `ContentVersionUpdateInput` and `saveVersionEdit` omit `voiceScore`, `voiceAligned`, and `voiceNotes`. As a result, `PUT /content-items/{itemId}/versions/{versionId}` never transmits brand voice metrics, preventing persistence into the database.

### Recommended Fix Strategy for Frontend

1. **`frontend/src/api/contentGeneration.ts`**:
   - Update `ContentVersionUpdateInput` to include optional brand voice fields:
     ```ts
     export interface ContentVersionUpdateInput {
       script?: VideoScriptResponse;
       caption?: string;
       hashtags?: string[];
       cta?: string;
       mediaPrompt?: string;
       voiceScore?: number;
       voiceAligned?: boolean;
       voiceNotes?: string;
     }
     ```

2. **`frontend/src/api/contentCreationService.ts`**:
   - Update `BrandVoiceCheck` to include `aligned?: boolean | null;`.
   - In `toContentVersion`:
     ```ts
     brandVoice: {
       score: v.voiceScore ?? 0,
       aligned: v.voiceAligned ?? (v.voiceScore != null && v.voiceScore > 0 ? v.voiceScore >= 70 : null),
       summary: v.voiceNotes ?? "",
       tone: "",
       wording: "",
       message: "",
     }
     ```
   - In `saveVersionEdit`:
     Forward `voiceScore: version.brandVoice.score`, `voiceAligned: version.brandVoice.aligned ?? (version.brandVoice.score >= 70)`, `voiceNotes: version.brandVoice.summary`.

3. **`frontend/src/components/create/BrandVoicePanel.tsx`**:
   - Update alignment check:
     ```ts
     const aligned = check?.aligned !== undefined && check?.aligned !== null
       ? check.aligned
       : (checked && check.score >= threshold);
     ```

4. **`frontend/src/components/create/ContentViewPanel.tsx`**:
   - Add state: `const [recheckingVoice, setRecheckingVoice] = useState(false);` and query `getPublishingSettings()` for `threshold`.
   - Implement `handleRecheckVoice`:
     - Calls `checkBrandVoice({ brandId: item.brandId, platform: shown.platform, script: shown.script, caption: shown.caption })`.
     - If in edit mode (`draft !== null`), updates `draft.brandVoice`.
     - If in view mode (`draft === null`), updates `versions` and calls `saveVersionEdit(item.id, updatedVersion)` so the recheck is immediately persisted to DB.
   - In JSX line 356, pass:
     ```tsx
     <BrandVoicePanel
       check={shown.brandVoice}
       busy={recheckingVoice}
       baselineScore={version?.brandVoice.score}
       onRecheck={handleRecheckVoice}
       threshold={voiceThreshold}
     />
     ```

---

## 5. Verification Method

1. **Type Checking & Build**:
   - Run `npm run build` in `frontend/`.
   - Verify `tsc` completes with zero errors and `vite build` produces `dist/`.
2. **Unit Tests**:
   - Run `npm run test` in `frontend/`.
   - Verify all 95 tests pass without regressions.
3. **Manual / Component Verification**:
   - Open Content Management (`/create`) and select any post to view in `ContentViewPanel`.
   - Inspect the Brand Voice panel in the right-hand column:
     - Verify it shows actual percentage progress bar (e.g. 85%), alignment badge ("Phù hợp" / "Cần xem lại"), and notes.
     - Verify the "Kiểm tra lại" (Re-check) button is visible.
     - Click "Kiểm tra lại": verify spinner activates, score/notes update.
     - Click "Sửa" (Edit), modify caption or script, click "Kiểm tra lại" or "Lưu": verify new Brand Voice data is saved and persisted across page refresh (`getContentDetail`).
4. **Invalidation Conditions**:
   - If `npm run build` fails with TypeScript type errors on `ContentVersionUpdateInput` or `BrandVoiceCheck`.
   - If `ContentViewPanel` still renders "Chưa kiểm tra" after platform formatting.
   - If saving version edits resets or nullifies `voice_score` in the backend response.
