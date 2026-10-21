# Handoff Report — Explorer M2.3: ContentViewPanel Wire-Up & State Management

## 1. Observation

### 1.1 Current Component State in `frontend/src/components/create/ContentViewPanel.tsx`
- **BrandVoicePanel Invocation (Line 356)**:
  ```tsx
  355: <SourceInfoCard info={srcInfo} />
  356: <BrandVoicePanel check={shown.brandVoice} />
  357: {/* Từ "Xem trước bài đăng" trở xuống dính theo màn hình khi cuộn... */}
  ```
  Direct observation: Only `check` is passed. `busy`, `baselineScore`, `onRecheck`, and `threshold` are completely omitted.
- **BrandVoicePanel Definition in `frontend/src/components/create/BrandVoicePanel.tsx` (Lines 18–32, 56–65)**:
  ```tsx
  export default function BrandVoicePanel({
    check,
    busy = false,
    baselineScore,
    onRecheck,
    threshold = DEFAULT_VOICE_THRESHOLD,
    collapsible = false,
  }: { ... })
  ...
  const actionBtn = onRecheck && (
    <button
      onClick={onRecheck}
      disabled={busy}
      className="btn-soft" ...>
      <Icon icon={RefreshCw} size={12} stroke={C.primary} />{checked ? t.cwVoiceRecheck : t.cwVoiceCheck}
    </button>
  );
  ```
  Direct observation: When `onRecheck` is omitted, `actionBtn` is `null`. The user has no UI mechanism to trigger a Brand Voice check or re-check in `ContentViewPanel`.
- **Edit & Save Flow in `ContentViewPanel.tsx` (Lines 167–189)**:
  ```tsx
  const startEdit = () => {
    if (!version) return;
    setDraft(cloneVersion(version));
    setHashtagText(version.hashtags.join(' '));
  };
  const cancelEdit = () => setDraft(null);

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
  Direct observation:
  1. `shown` is defined as `draft ?? version;` (Line 160).
  2. In edit mode (`draft !== null`), any updates to `draft.brandVoice` are held locally and then passed via `saveVersionEdit(item.id, draft)` on save.
  3. In view mode (`draft === null`), there is currently no recheck action or state persistence handler.

### 1.2 Service and Hook Capabilities
- **`checkBrandVoice` in `frontend/src/api/contentCreationService.ts` (Lines 192–197, 653–656)**:
  ```ts
  export interface CheckBrandVoiceInput {
    brandId: string;
    platform: Platform;
    script: VideoScript;
    caption: string;
  }
  ...
  export async function checkBrandVoice(input: CheckBrandVoiceInput): Promise<BrandVoiceCheck> {
    await delay(900);
    return mockBrandVoice(lang(), (input.script.hook.content.length + input.caption.length) % 4);
  }
  ```
  `checkBrandVoice` takes `brandId`, `platform`, `script`, and `caption`, and resolves to `BrandVoiceCheck`.
- **`useBrandVoiceCheck.ts` (Lines 12–39)**:
  Accepts `(brandId, onPatchVersion)`. Only patches in-memory versions in wizard steps (`FinalizeStep`, `GenerateStep`). It does not persist to backend DB in view mode, nor distinguish between draft vs view modes.
- **Threshold Resolution in `frontend/src/components/create/useReadiness.ts` (Lines 12, 41) & `frontend/src/api/schedules.ts` (Lines 20–23)**:
  `DEFAULT_VOICE_THRESHOLD = 70`. `getPublishingSettings()` returns `settings.brandVoiceThreshold`.

### 1.3 Backend Persistence Readiness (M1 Verification)
- In `backend/src/main/java/com/aima/service/Impl/ContentItemServiceImpl.java` (Lines 220–239, 326–330):
  ```java
  private static List<Object> versionContent(ContentVersion version) {
      return Arrays.asList(version.getScript(), version.getFormattedCaption(), version.getFormattedHashtag(),
              version.getCta(), version.getMediaPrompt(),
              version.getVoiceAligned(), version.getVoiceScore(), version.getVoiceNotes());
  }
  ```
  When `updateVersion` (`PUT /content-items/{itemId}/versions/{versionId}`) is invoked with `voiceScore`, `voiceAligned`, or `voiceNotes`, backend detects the change, increments `version.revision`, triggers `holdService.onContentChanged(item)`, saves via `contentItemRepository.save(item)`, and returns the updated `ContentItemResponse`.

### 1.4 Baseline Test & Build Status
- `npm run build` in `frontend`: Exit code 0, 0 TypeScript errors, built in 2.81s.
- `npm run test` in `frontend`: Exit code 0, 95 tests pass, 0 fail.
- `./mvnw test-compile` in `backend`: Exit code 0, BUILD SUCCESS.
- `./mvnw test '-Dtest=ContentFormattingLateResultTest,ContentVersionMappingTest'` in `backend`: Exit code 0, 9 tests run, 0 failures, 0 errors.

---

## 2. Logic Chain

1. **Root cause of missing interaction in `ContentViewPanel`**:
   - `BrandVoicePanel.tsx` only renders the action button when `onRecheck` is provided (`onRecheck && (...)`).
   - Line 356 of `ContentViewPanel.tsx` passes only `check={shown.brandVoice}`.
   - Therefore, the user cannot trigger a Brand Voice evaluation or re-evaluation from `ContentViewPanel`.

2. **Divergent requirements for Draft Mode vs View Mode**:
   - In **Edit Mode** (`draft !== null`): The user is editing draft fields (`caption`, `script`). Re-checking should compute Brand Voice based on the in-memory draft (`shown.script`, `shown.caption`), and update `draft.brandVoice`. This allows the user to inspect the updated % score, badge, and notes before deciding to save or cancel. When the user clicks "Lưu thay đổi" (`saveEdit`), `saveVersionEdit(item.id, draft)` transmits the modified brand voice along with the edited content.
   - In **View Mode** (`draft === null`): The user is viewing an existing saved version. Re-checking should immediately compute Brand Voice, update `versions` in local state, and call `saveVersionEdit(item.id, updatedVersion)` so the newly evaluated metrics (`voiceScore`, `voiceAligned`, `voiceNotes`) are persisted into the database without requiring manual entry into edit mode.

3. **Concurrency and Race Condition Prevention**:
   - An asynchronous check takes time (AI analysis or network delay).
   - If user saves, cancels, switches platform tabs, or triggers status transitions while a recheck is in flight, state can become inconsistent.
   - Introducing `voiceBusy: boolean` and binding it to `BrandVoicePanel (busy={voiceBusy})`, `PlatformTabs (disabled during voiceBusy || savingEdit)`, `saveEdit (disabled={savingEdit || voiceBusy})`, `cancelEdit (disabled={savingEdit || voiceBusy})`, `startEdit (disabled={voiceBusy})`, and status actions (`disabled={statusBusy || voiceBusy}`) completely eliminates concurrency hazards.

4. **Dynamic Threshold Integration**:
   - Brand voice alignment evaluation depends on user settings (`brandVoiceThreshold`).
   - Calling `getPublishingSettings()` on panel mount and storing `threshold` (defaulting to `DEFAULT_VOICE_THRESHOLD = 70`) ensures consistency with `useReadiness` and user configuration.

---

## 3. Caveats

1. **Dependency on M2.1 Client DTO Updates**:
   - In view mode and on `saveEdit`, `saveVersionEdit` relies on M2.1 extending `ContentVersionUpdateInput` with `voiceScore`, `voiceAligned`, and `voiceNotes` and transmitting them in `updateContentVersion`. Once M2.1 is merged, the wire payload and DB persistence are fully active.
2. **AI / Mock Backend Endpoint**:
   - `checkBrandVoice` currently uses a client-side simulated delay and heuristic mock (`mockBrandVoice`). When the backend exposes a dedicated `POST /content-items/check-brand-voice` endpoint, only `checkBrandVoice` in `contentCreationService.ts` needs to be updated; `ContentViewPanel.tsx` requires zero changes.
3. **Posting Lock Constraint (FR-33)**:
   - When a post or version is currently `POSTING`, editing and updating are locked by business rules (`isEditable(status, version)`). In this state, `onRecheck` is set to `undefined`, preventing unauthorized mutations while the background dispatcher is running.

---

## 4. Conclusion

The specification and code changes for `ContentViewPanel.tsx` are fully formulated and validated:
1. Created `proposed_ContentViewPanel.tsx` and unified diff patch `ContentViewPanel.patch` in `.agents/teamwork/teamwork_preview_explorer_m2_3/`.
2. Exact modifications to `frontend/src/components/create/ContentViewPanel.tsx`:
   - **Imports**: Add `checkBrandVoice`, `type BrandVoiceCheck` from `../../api/contentCreationService`, `getPublishingSettings` from `../../api/schedules`, and `DEFAULT_VOICE_THRESHOLD` from `./useReadiness`.
   - **State**: Add `voiceBusy: boolean` and `threshold: number`.
   - **Threshold Hook**: Fetch `getPublishingSettings()` in mount `useEffect` to retrieve `brandVoiceThreshold`.
   - **Recheck Handler (`handleRecheckVoice`)**:
     - Check `if (voiceBusy || savingEdit || !shown || !editable) return;`.
     - Evaluate `checkBrandVoice({ brandId: item.brandId, platform: shown.platform, script: shown.script, caption: shown.caption })`.
     - In edit mode: `setDraft((prev) => prev ? { ...prev, brandVoice } : null)`.
     - In view mode: construct `updatedVersion`, call `saveVersionEdit(item.id, updatedVersion)`, update `versions`, `status`, `review`, and invoke `onChanged?.()`.
   - **Guards**: Guard `saveEdit`, `cancelEdit`, `startEdit`, `applyStatus`, and `PlatformTabs` with `voiceBusy` and `savingEdit`.
   - **Panel Props (Line 356)**:
     ```tsx
     <BrandVoicePanel
       check={shown.brandVoice}
       busy={voiceBusy}
       baselineScore={draft && version && version.brandVoice.score > 0 ? version.brandVoice.score : undefined}
       onRecheck={editable ? handleRecheckVoice : undefined}
       threshold={threshold}
     />
     ```

---

## 5. Verification Method

### 5.1 Independent Code Inspection
- Inspect `.agents/teamwork/teamwork_preview_explorer_m2_3/proposed_ContentViewPanel.tsx`.
- Review `.agents/teamwork/teamwork_preview_explorer_m2_3/ContentViewPanel.patch`.

### 5.2 Build & Test Verification Commands
1. **Frontend compilation**:
   ```bash
   cd frontend
   npm run build
   ```
   Verify 0 TypeScript/lint errors and successful Vite production bundling.
2. **Frontend unit tests**:
   ```bash
   cd frontend
   npm run test
   ```
   Verify all 95 tests pass with 0 failures.
3. **Backend build and tests**:
   ```bash
   cd backend
   ./mvnw test-compile
   ./mvnw test '-Dtest=ContentFormattingLateResultTest,ContentVersionMappingTest'
   ```
   Verify BUILD SUCCESS and 9 passing tests.

### 5.3 Invalidation Conditions
- If `saveVersionEdit` in view mode throws without user feedback. (Handled via `try/catch` and `toast.error`).
- If re-checking in edit mode causes immediate unwanted DB persistence. (Prevented: edit mode only updates local `draft.brandVoice`).
- If switching platform tabs while recheck is in-flight corrupts state. (Prevented: tab change is blocked when `voiceBusy` is true).
