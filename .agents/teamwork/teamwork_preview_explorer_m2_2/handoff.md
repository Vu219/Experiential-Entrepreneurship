# Handoff Report — Explorer M2.2 (Brand Voice Panel & Visual Representation)

## 1. Observation

### 1.1 `BrandVoicePanel.tsx` Code Inspection
- **File Path**: `frontend/src/components/create/BrandVoicePanel.tsx`
- **Component Signature** (lines 18–32):
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
- **Alignment Evaluation Logic** (lines 35–37):
  ```tsx
  const checked = !!check && check.score > 0;
  const aligned = checked && check.score >= threshold;
  const dropped = checked && baselineScore !== undefined && baselineScore > 0 && check.score < baselineScore;
  ```
  *Direct observation*: `aligned` is calculated strictly via `check.score >= threshold`. If backend or AI provides an explicit evaluation `check.aligned` (e.g. `voiceAligned: boolean` from DB/API), it is completely ignored.
- **Verdict & Styling Assignment** (lines 38–40):
  ```tsx
  const verdict = aligned
    ? { text: t.cwVoiceMatch, color: C.success, bg: C.successSoft, bar: 'linear-gradient(90deg,#22d3ee,#16a34a)' }
    : { text: t.cwVoiceReview, color: C.amberText, bg: C.warningSoft, bar: 'linear-gradient(90deg,#fbbf24,#d97706)' };
  ```
- **Badge Rendering** (lines 50–54):
  ```tsx
  const badge = checked ? (
    <span style={{ background: verdict.bg, color: verdict.color, borderRadius: 9, padding: '4px 12px', fontSize: 13, fontWeight: 800 }}>
      {verdict.text} ({check.score}%)
    </span>
  ) : null;
  ```
- **Action Button Rendering** (lines 56–65):
  ```tsx
  const actionBtn = onRecheck && (
    <button
      onClick={onRecheck}
      disabled={busy}
      className="btn-soft"
      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flex: 'none', border: `1px solid ${C.border}`, background: C.surface, borderRadius: 9, padding: '6px 10px', fontSize: 11.5, fontWeight: 700, color: C.primary, cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.6 : 1 }}
    >
      <Icon icon={RefreshCw} size={12} stroke={C.primary} />{checked ? t.cwVoiceRecheck : t.cwVoiceCheck}
    </button>
  );
  ```
  *Direct observation*:
  1. If `onRecheck` is omitted (as was in `ContentViewPanel`), `actionBtn` is falsy and never rendered.
  2. When `busy` is true, the button is disabled and dimmed (`opacity: 0.6`, `cursor: 'not-allowed'`), but the button text remains `{checked ? t.cwVoiceRecheck : t.cwVoiceCheck}` instead of indicating progress (`t.cwVoiceChecking`).
  3. The button lacks `aria-busy={busy}` for screen readers.
- **Progress Bar and Threshold Note** (lines 74–81):
  ```tsx
  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
    {badge}
    <span style={{ fontSize: 11.5, color: C.textSecondary }}>{t.cwVoiceThresholdNote.replace('{n}', String(threshold))}</span>
  </div>
  {/* Thanh % phù hợp */}
  <div style={{ height: 7, borderRadius: 99, background: C.border, overflow: 'hidden' }}>
    <div style={{ width: `${check.score}%`, height: '100%', borderRadius: 99, background: verdict.bar }} />
  </div>
  ```
  *Direct observation*: `check.score` is placed directly into `${check.score}%` without clamping (`Math.min(100, Math.max(0, check.score))`), which could lead to overflow if an out-of-range value is received.
- **Notes and Dimension Rendering** (lines 88–91):
  ```tsx
  <div style={{ fontSize: 12.5, color: C.text, fontWeight: 600 }}>{check.summary}</div>
  {row(t.cwVoiceTone, check.tone)}
  {row(t.cwVoiceWording, check.wording)}
  {row(t.cwVoiceMessage, check.message)}
  ```
  *Direct observation*: `row` checks `value ? (...) : null` so empty `tone`/`wording`/`message` are safely hidden, but `<div ...>{check.summary}</div>` is rendered unconditionally even if `check.summary` is an empty string.
- **Fallback States** (lines 70–72, 93–103):
  - When `busy`: renders `<div style={{ fontSize: 12.5, color: C.textMuted, padding: '10px 0' }}>{t.cwVoiceChecking}</div>`.
  - When `check` exists but `check.score === 0` (lines 93–97):
    ```tsx
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12.5, color: C.textMuted }}>
      <span style={{ background: C.surfaceMuted, color: C.textSecondary, borderRadius: 9, padding: '4px 12px', fontSize: 12.5, fontWeight: 700 }}>{t.cwVoiceUnchecked}</span>
    </div>
    ```
    Renders "Chưa kiểm tra" badge (`t.cwVoiceUnchecked`).
  - When `check` is null (lines 98–103): renders dashed card placeholder (`t.cwVoiceEmpty`).

### 1.2 Usages Across Codebase
- **`frontend/src/components/create/ContentViewPanel.tsx`** (line 356):
  ```tsx
  <BrandVoicePanel check={shown.brandVoice} />
  ```
  *Direct observation*: `onRecheck`, `busy`, `baselineScore`, and `threshold` are omitted. Consequently, no action button was rendered in `ContentViewPanel`.
- **`frontend/src/components/create/steps/FinalizeStep.tsx`** (lines 397–404):
  ```tsx
  <BrandVoicePanel
    check={version.brandVoice}
    busy={voice.busy}
    baselineScore={baselines[version.id]}
    onRecheck={() => voice.run(version)}
    threshold={readiness.voiceThreshold}
    collapsible
  />
  ```
- **`frontend/src/components/create/steps/GenerateStep.tsx`** (lines 232–236):
  ```tsx
  <BrandVoicePanel
    check={version?.brandVoice ?? null}
    busy={voice.busy}
    onRecheck={version ? () => voice.run(version) : undefined}
  />
  ```

### 1.3 Data Contract Dependency (Explorer M2.1)
- **`frontend/src/api/contentCreationService.ts`** (lines 85–91):
  ```ts
  export interface BrandVoiceCheck {
    score: number; // 0–100
    tone: string;
    wording: string;
    message: string;
    summary: string;
  }
  ```
  `aligned` is being added by Explorer M2.1 as `aligned?: boolean | null;`.

### 1.4 i18n & Theme Tokens
- `frontend/src/i18n.ts`:
  - Lines 461–464 (VI): `cwVoiceTitle: 'Kiểm tra brand voice'`, `cwVoiceMatch: 'Phù hợp'`, `cwVoiceChecking: 'Đang kiểm tra...'`, `cwVoiceRecheck: 'Kiểm tra lại'`, `cwVoiceDropped: 'Điểm phù hợp giảm sau chỉnh sửa...'`, `cwVoiceEmpty: 'Tạo nội dung để xem điểm brand voice.'`
  - Line 489 (VI): `cwVoiceUnchecked: 'Chưa kiểm tra'`, `cwVoiceCheck: 'Kiểm tra'`, `cwVoiceReview: 'Cần xem lại'`, `cwVoiceThresholdNote: 'Ngưỡng phù hợp: {n}%'`
  - Lines 1839, 1867 (EN): Full English counterparts exist (`Brand voice check`, `Match`, `Needs review`, `Not checked`, `Check`, `Recheck`, etc.).
- Theme tokens from `frontend/src/styles/colors.ts`: `C.success`, `C.successSoft`, `C.amberText`, `C.warningSoft`, `C.border`, `C.surface`, `C.primary`, `C.accentText`, `C.textSecondary`, `C.textMuted`, `C.surfaceMuted`. All map to CSS variables (`var(--c-*)`) supporting both light and dark modes.

### 1.5 Baseline Verification
- Tool Command: `npm run build` in `frontend/` -> Result: Exit code 0, 0 TS errors, Vite bundle built in 2.26s.
- Tool Command: `npm run test` in `frontend/` -> Result: Exit code 0, 95/95 tests passed.

---

## 2. Logic Chain

1. **Alignment Evaluation Precedence (Direct Observation §1.1 -> Requirement M2.2)**:
   - Observation: Currently `const aligned = checked && check.score >= threshold;`.
   - Reason: The backend `ContentVersion` entity stores `voice_aligned` as a boolean (`true`/`false`/`null`). An AI evaluator can mark content misaligned even if a tone score meets an arbitrary threshold (e.g., policy or brand-inconsistent terms), or aligned if it passes qualitative scrutiny.
   - Inference: Discarding `check.aligned` creates discrepancy between backend truth and UI display.
   - Conclusion: When `check.aligned` is defined and not null (`check.aligned !== undefined && check.aligned !== null`), `aligned` must use `Boolean(check.aligned)`. Only when `check.aligned` is null or undefined should it dynamically evaluate `check.score >= threshold`.

2. **Badge Rendering Logic (Direct Observation §1.1 -> §1.4)**:
   - State A (`checked && aligned`): Renders badge with `verdict.bg = C.successSoft`, `verdict.color = C.success`, text `t.cwVoiceMatch` ("Phù hợp") and `check.score%`.
   - State B (`checked && !aligned`): Renders badge with `verdict.bg = C.warningSoft`, `verdict.color = C.amberText`, text `t.cwVoiceReview` ("Cần xem lại") and `check.score%`.
   - State C (`check && !checked`, e.g. `check.score === 0`): Renders badge with `C.surfaceMuted`, `C.textSecondary`, text `t.cwVoiceUnchecked` ("Chưa kiểm tra"). Does NOT show 0% or "Phù hợp".
   - State D (`!check`): Renders empty placeholder card with dashed border.

3. **Action Button Behavior Under `busy` Toggle (Direct Observation §1.1 -> §1.2)**:
   - Observation: When `onRecheck` is provided, `actionBtn` is rendered.
   - When idle (`busy === false`):
     - If `checked` is true: Displays label `{t.cwVoiceRecheck}` ("Kiểm tra lại").
     - If `checked` is false (`score === 0`): Displays label `{t.cwVoiceCheck}` ("Kiểm tra").
   - When busy (`busy === true`):
     - `disabled={busy}` disables native button clicks and prevents double-invocations.
     - `cursor: 'not-allowed'` and `opacity: 0.6` provide visual disabled cues.
     - Button label should display `{t.cwVoiceChecking}` ("Đang kiểm tra..."), giving immediate feedback on the button itself.
     - `aria-busy="true"` signals in-progress state to assistive technologies.
     - In card body, `{t.cwVoiceChecking}` replaces previous score details during fetch.

4. **Visual Score and Progress Bar Protection**:
   - `width: ${Math.min(100, Math.max(0, check.score))}%` guarantees the progress bar never renders with invalid negative width or overflows beyond 100%.

5. **Clean Note Rendering**:
   - `{check.summary && <div style={{ fontSize: 12.5, color: C.text, fontWeight: 600 }}>{check.summary}</div>}` avoids mounting empty `<div>` nodes when notes are empty.
   - `row` helper already omits empty dimensions (`tone`, `wording`, `message`), which matches the real backend schema where only `voiceNotes` is populated.

6. **UI Rule Compliance (`frontend/rule.md`)**:
   - Uses `Card`, `Icon`, `.btn-soft` class (Rules 0, 3).
   - All color tokens via `C.*` (`var(--c-*)`) guaranteeing dark mode support (Rule 1).
   - Typography strictly adheres to existing sizes and weights (Rule 2).
   - Accessibility tags (`aria-busy`, `aria-expanded`, `aria-label`, native `disabled`) included (Rule 6).
   - Bilingual strings from `t.*` (Rule 7).

---

## 3. Caveats

1. **Type Definition Prerequisite**: `BrandVoicePanel.tsx` imports `BrandVoiceCheck` from `frontend/src/api/contentCreationService.ts`. Explorer M2.1 is responsible for adding `aligned?: boolean | null;` to `BrandVoiceCheck`. Until M2.1's change is merged into `contentCreationService.ts`, referencing `check.aligned` requires `aligned?: boolean | null;` on `BrandVoiceCheck`.
2. **ContentViewPanel Integration**: Explorer M2.3 is responsible for updating `ContentViewPanel.tsx` line 356 to pass `onRecheck={handleRecheckVoice}`, `busy={recheckingVoice}`, `baselineScore={version?.brandVoice.score}`, and `threshold={voiceThreshold}`. `BrandVoicePanel` is ready to accept and render all these props as designed.
3. **Collapsible vs Standard Layout**: `collapsible` defaults to `false`. When `collapsible={false}` (as in `ContentViewPanel`), the panel renders an expanded `Card` with padding 20 and header action button. When `collapsible={true}` (as in `FinalizeStep`), it renders the compact accordion. Both variants use the identical badge and button logic.

---

## 4. Conclusion

`frontend/src/components/create/BrandVoicePanel.tsx` requires surgical enhancements to properly respect backend alignment evaluation (`check.aligned`), improve button state feedback during async checks (`busy ? t.cwVoiceChecking : ...`, `aria-busy`), clamp progress bar widths, and cleanly handle empty notes.

### Exact Proposed Code Changes

#### 1. Diff Patch (`frontend/src/components/create/BrandVoicePanel.tsx`)
```diff
--- a/frontend/src/components/create/BrandVoicePanel.tsx
+++ b/frontend/src/components/create/BrandVoicePanel.tsx
@@ -35,3 +35,7 @@
   const checked = !!check && check.score > 0;
-  const aligned = checked && check.score >= threshold;
+  const aligned = checked && (
+    check.aligned !== undefined && check.aligned !== null
+      ? Boolean(check.aligned)
+      : check.score >= threshold
+  );
   const dropped = checked && baselineScore !== undefined && baselineScore > 0 && check.score < baselineScore;
@@ -58,5 +62,6 @@
       onClick={onRecheck}
       disabled={busy}
+      aria-busy={busy}
       className="btn-soft"
       style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flex: 'none', border: `1px solid ${C.border}`, background: C.surface, borderRadius: 9, padding: '6px 10px', fontSize: 11.5, fontWeight: 700, color: C.primary, cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.6 : 1 }}
     >
-      <Icon icon={RefreshCw} size={12} stroke={C.primary} />{checked ? t.cwVoiceRecheck : t.cwVoiceCheck}
+      <Icon icon={RefreshCw} size={12} stroke={C.primary} />{busy ? t.cwVoiceChecking : (checked ? t.cwVoiceRecheck : t.cwVoiceCheck)}
     </button>
   );
@@ -79,3 +84,3 @@
       <div style={{ height: 7, borderRadius: 99, background: C.border, overflow: 'hidden' }}>
-        <div style={{ width: `${check.score}%`, height: '100%', borderRadius: 99, background: verdict.bar }} />
+        <div style={{ width: `${Math.min(100, Math.max(0, check.score))}%`, height: '100%', borderRadius: 99, background: verdict.bar }} />
       </div>
@@ -88,1 +93,1 @@
-      <div style={{ fontSize: 12.5, color: C.text, fontWeight: 600 }}>{check.summary}</div>
+      {check.summary && <div style={{ fontSize: 12.5, color: C.text, fontWeight: 600 }}>{check.summary}</div>}
```

#### 2. Generated Artifacts
The following reference files have been generated in this folder:
- **`proposed_BrandVoicePanel.patch`**: Exact unified diff ready for application.
- **`proposed_BrandVoicePanel.tsx`**: Complete drop-in replacement file.

---

## 5. Verification Method

### 5.1 Automated Type Check and Test Commands
1. **Compilation Check**:
   ```bash
   cd frontend
   npm run build
   ```
   *Expected Result*: Zero TypeScript errors, Vite build completes successfully and produces `dist/`.
2. **Unit Test Suite**:
   ```bash
   cd frontend
   npm run test
   ```
   *Expected Result*: All 95 tests pass with 0 failures (`pass 95`, `fail 0`).

### 5.2 Interactive & Visual Inspection Steps
1. **Alignment Logic Verification**:
   - Provide `check = { score: 65, aligned: true, summary: "Hài hòa", tone: "", wording: "", message: "" }` with `threshold = 70`:
     - Badge must display green "Phù hợp (65%)" (`t.cwVoiceMatch`), respecting `check.aligned = true`.
   - Provide `check = { score: 75, aligned: false, summary: "Chưa đúng giọng", tone: "", wording: "", message: "" }` with `threshold = 70`:
     - Badge must display amber "Cần xem lại (75%)" (`t.cwVoiceReview`), respecting `check.aligned = false`.
   - Provide `check = { score: 75, aligned: null, summary: "Tốt", tone: "", wording: "", message: "" }` with `threshold = 70`:
     - Badge dynamically falls back to threshold and displays "Phù hợp (75%)".
2. **Unchecked State**:
   - Provide `check = { score: 0, summary: "", tone: "", wording: "", message: "" }`:
     - Badge displays muted "Chưa kiểm tra" (`t.cwVoiceUnchecked`).
     - Action button displays "Kiểm tra" (`t.cwVoiceCheck`).
3. **Recheck Action & Busy State**:
   - Provide `onRecheck`: Button renders in the header.
   - When clicked and `busy = true`:
     - Button is disabled (`disabled`), `opacity: 0.6`, `cursor: not-allowed`.
     - Button text updates to "Đang kiểm tra..." (`t.cwVoiceChecking`).
     - Card body displays `{t.cwVoiceChecking}`.
     - When `busy` returns to `false`, new score/badge/notes render instantly.

### 5.3 Invalidation Conditions
- If `check.aligned` is `false` but the component renders "Phù hợp" because `score >= threshold`.
- If `npm run build` fails with TypeScript errors on `check.aligned`.
- If the action button remains clickable during an in-flight check (`busy === true`).
- If progress bar width exceeds 100% or produces invalid CSS dimensions.
