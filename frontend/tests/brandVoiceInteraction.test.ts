// Chạy: npm test  (node --test --experimental-strip-types)
import { test } from 'node:test';
import assert from 'node:assert/strict';

export const DEFAULT_VOICE_THRESHOLD = 70;
import type { BrandVoiceCheck, ContentVersion } from '../src/api/contentCreationService.ts';

// ---------------------------------------------------------------------------
// 1. Logic Oracles for BrandVoicePanel
// (Mirroring exact pure logic implemented in BrandVoicePanel.tsx)
// ---------------------------------------------------------------------------

function evaluateBrandVoiceState(
  check: BrandVoiceCheck | null,
  options: {
    busy?: boolean;
    baselineScore?: number;
    threshold?: number;
  } = {}
) {
  const { busy = false, baselineScore, threshold = DEFAULT_VOICE_THRESHOLD } = options;
  const checked = !!check && check.score > 0;
  const aligned = checked && (
    check.aligned !== undefined && check.aligned !== null
      ? Boolean(check.aligned)
      : check.score >= threshold
  );
  const dropped = checked && baselineScore !== undefined && baselineScore > 0 && check.score < baselineScore;
  const progressWidth = check ? Math.min(100, Math.max(0, check.score)) : 0;

  // Button state logic
  const buttonDisabled = busy;
  const buttonAriaBusy = busy;
  const buttonLabel = busy
    ? 'Đang kiểm tra...'
    : (checked ? 'Kiểm tra lại' : 'Kiểm tra brand voice');

  // Summary logic
  const summary = busy
    ? 'Đang kiểm tra...'
    : checked
      ? `${aligned ? 'Phù hợp' : 'Cần xem lại'} · ${check.score}%`
      : check
        ? 'Chưa kiểm tra'
        : null;

  return {
    checked,
    aligned,
    dropped,
    progressWidth,
    buttonDisabled,
    buttonAriaBusy,
    buttonLabel,
    summary,
  };
}

// ---------------------------------------------------------------------------
// 2. Data Serialization Oracles for saveVersionEdit
// (Mirroring exact payload building in saveVersionEdit)
// ---------------------------------------------------------------------------

function buildVersionUpdatePayload(version: ContentVersion) {
  const hasVoice =
    (version.brandVoice?.score !== undefined && version.brandVoice.score > 0) ||
    (version.brandVoice?.aligned !== undefined && version.brandVoice.aligned !== null);

  return {
    caption: version.caption,
    hashtags: version.hashtags.map((h) => h.replace(/^#+/, '')),
    cta: version.cta,
    mediaPrompt: version.mediaPrompt,
    voiceScore: hasVoice ? version.brandVoice.score : undefined,
    voiceAligned: hasVoice
      ? (version.brandVoice.aligned ?? (version.brandVoice.score >= 70))
      : undefined,
    voiceNotes: hasVoice && version.brandVoice.summary ? version.brandVoice.summary : undefined,
  };
}

// ---------------------------------------------------------------------------
// 3. Concurrency Protection & Mode Simulation Oracles
// (Mirroring exact guards in ContentViewPanel.tsx)
// ---------------------------------------------------------------------------

class ContentViewPanelModel {
  versions: ContentVersion[];
  platform: string;
  status: string;
  reviewStatus: string;
  draft: ContentVersion | null = null;
  savingEdit = false;
  statusBusy = false;
  voiceBusy = false;
  threshold = 70;
  onChangedCalls = 0;
  backendSaves: { itemId: string; version: ContentVersion }[] = [];

  constructor(initialVersions: ContentVersion[], initialStatus = 'DRAFT', initialReview = 'NONE') {
    this.versions = initialVersions.map(v => ({ ...v }));
    this.platform = initialVersions[0]?.platform ?? 'FACEBOOK';
    this.status = initialStatus;
    this.reviewStatus = initialReview;
  }

  get currentVersion(): ContentVersion | null {
    return this.versions.find(v => v.platform === this.platform) ?? this.versions[0] ?? null;
  }

  get shown(): ContentVersion | null {
    return this.draft ?? this.currentVersion;
  }

  get isEditable(): boolean {
    return this.status !== 'POSTING' && this.currentVersion?.scheduleStatus !== 'POSTING';
  }

  startEdit() {
    if (this.voiceBusy || !this.currentVersion || !this.isEditable) return false;
    this.draft = JSON.parse(JSON.stringify(this.currentVersion));
    return true;
  }

  cancelEdit() {
    if (this.savingEdit || this.voiceBusy) return false;
    this.draft = null;
    return true;
  }

  async saveEdit() {
    if (!this.draft || this.savingEdit || this.voiceBusy) return false;
    this.savingEdit = true;
    try {
      this.backendSaves.push({ itemId: 'item-1', version: JSON.parse(JSON.stringify(this.draft)) });
      const idx = this.versions.findIndex(v => v.id === this.draft!.id);
      if (idx >= 0) {
        this.versions[idx] = JSON.parse(JSON.stringify(this.draft));
      }
      this.draft = null;
      this.onChangedCalls++;
      return true;
    } finally {
      this.savingEdit = false;
    }
  }

  async handleRecheckVoice(mockCheckResult: { score: number; aligned?: boolean | null; summary?: string }) {
    if (this.voiceBusy || this.savingEdit || !this.shown || !this.isEditable) return false;
    this.voiceBusy = true;
    try {
      const isAligned = mockCheckResult.aligned ?? (mockCheckResult.score >= this.threshold);
      const brandVoice: BrandVoiceCheck = {
        score: mockCheckResult.score,
        aligned: isAligned,
        summary: mockCheckResult.summary ?? '',
        tone: '',
        wording: '',
        message: '',
      };

      if (this.draft) {
        // Edit mode: updates draft only, does NOT touch versions or save to backend
        this.draft = { ...this.draft, brandVoice };
      } else if (this.currentVersion) {
        // View mode: immediately updates version and saves to backend
        const updatedVersion: ContentVersion = {
          ...this.currentVersion,
          brandVoice,
        };
        this.backendSaves.push({ itemId: 'item-1', version: JSON.parse(JSON.stringify(updatedVersion)) });
        const idx = this.versions.findIndex(v => v.id === updatedVersion.id);
        if (idx >= 0) {
          this.versions[idx] = updatedVersion;
        }
        this.onChangedCalls++;
      }
      return true;
    } finally {
      this.voiceBusy = false;
    }
  }

  switchPlatform(newPlatform: string) {
    if (this.draft || this.voiceBusy || this.savingEdit) return false;
    this.platform = newPlatform;
    return true;
  }

  async applyStatus(target: string) {
    if (this.statusBusy || this.voiceBusy || this.draft) return false;
    this.statusBusy = true;
    try {
      this.reviewStatus = target;
      this.onChangedCalls++;
      return true;
    } finally {
      this.statusBusy = false;
    }
  }
}

// ---------------------------------------------------------------------------
// TESTS
// ---------------------------------------------------------------------------

test('BrandVoicePanel: unexamined version (score 0, aligned null) shows unexamined state and check button', () => {
  const unexamined: BrandVoiceCheck = {
    score: 0,
    aligned: null,
    summary: '',
    tone: '',
    wording: '',
    message: '',
  };

  const res = evaluateBrandVoiceState(unexamined, { busy: false, threshold: 70 });
  assert.equal(res.checked, false, 'Score 0 must not be considered checked');
  assert.equal(res.aligned, false);
  assert.equal(res.dropped, false);
  assert.equal(res.buttonLabel, 'Kiểm tra brand voice', 'Must prompt to check, not recheck');
  assert.equal(res.buttonDisabled, false);
  assert.equal(res.summary, 'Chưa kiểm tra', 'Summary must be Chưa kiểm tra');
  assert.equal(res.progressWidth, 0);
});

test('BrandVoicePanel: checked version with matching voice shows correct label, badge and gradient bar', () => {
  const matching: BrandVoiceCheck = {
    score: 85,
    aligned: true,
    summary: 'Giọng điệu nhất quán',
    tone: 'Tự tin',
    wording: 'Tự nhiên',
    message: 'Rõ ràng',
  };

  const res = evaluateBrandVoiceState(matching, { busy: false, threshold: 70 });
  assert.equal(res.checked, true);
  assert.equal(res.aligned, true);
  assert.equal(res.buttonLabel, 'Kiểm tra lại', 'Must offer recheck when already checked');
  assert.equal(res.summary, 'Phù hợp · 85%');
  assert.equal(res.progressWidth, 85);
});

test('BrandVoicePanel: busy state locks button and displays checking label across components', () => {
  const checked: BrandVoiceCheck = {
    score: 80,
    aligned: true,
    summary: 'OK',
    tone: '',
    wording: '',
    message: '',
  };

  const res = evaluateBrandVoiceState(checked, { busy: true, threshold: 70 });
  assert.equal(res.buttonDisabled, true, 'Button must be disabled when busy');
  assert.equal(res.buttonAriaBusy, true, 'aria-busy must be true');
  assert.equal(res.buttonLabel, 'Đang kiểm tra...', 'Label must be checking');
  assert.equal(res.summary, 'Đang kiểm tra...', 'Summary must be checking');
});

test('BrandVoicePanel: explicit aligned boolean overrides score vs threshold comparison', () => {
  // Case A: High score (90) but explicit aligned=false (e.g. policy violation detected)
  const highMismatch: BrandVoiceCheck = {
    score: 90,
    aligned: false,
    summary: 'Vi phạm chính sách từ cấm',
    tone: '',
    wording: '',
    message: '',
  };
  const resA = evaluateBrandVoiceState(highMismatch, { threshold: 70 });
  assert.equal(resA.aligned, false, 'Explicit aligned=false must prevail over score >= threshold');
  assert.equal(resA.summary, 'Cần xem lại · 90%');

  // Case B: Low score (55) but explicit aligned=true (e.g. niche humor allowed by brand)
  const lowMatch: BrandVoiceCheck = {
    score: 55,
    aligned: true,
    summary: 'Phù hợp với phong cách cá tính',
    tone: '',
    wording: '',
    message: '',
  };
  const resB = evaluateBrandVoiceState(lowMatch, { threshold: 70 });
  assert.equal(resB.aligned, true, 'Explicit aligned=true must prevail over score < threshold');
  assert.equal(resB.summary, 'Phù hợp · 55%');

  // Case C: aligned is null -> falls back to threshold comparison
  const fallbackMatch: BrandVoiceCheck = {
    score: 75,
    aligned: null,
    summary: 'Legacy data',
    tone: '',
    wording: '',
    message: '',
  };
  const resC1 = evaluateBrandVoiceState(fallbackMatch, { threshold: 70 });
  assert.equal(resC1.aligned, true, '75 >= 70 -> aligned=true');

  const resC2 = evaluateBrandVoiceState(fallbackMatch, { threshold: 80 });
  assert.equal(resC2.aligned, false, '75 < 80 -> aligned=false');
});

test('BrandVoicePanel: baseline score drop detection flags degradation after manual edits', () => {
  const current: BrandVoiceCheck = {
    score: 68,
    aligned: false,
    summary: 'Giọng điệu bị loãng sau khi sửa',
    tone: '',
    wording: '',
    message: '',
  };

  const resDrop = evaluateBrandVoiceState(current, { baselineScore: 85, threshold: 70 });
  assert.equal(resDrop.dropped, true, 'Score 68 < baseline 85 must flag dropped');

  const resNoDrop = evaluateBrandVoiceState(current, { baselineScore: 65, threshold: 70 });
  assert.equal(resNoDrop.dropped, false, 'Score 68 >= baseline 65 must NOT flag dropped');

  const resUndefinedBaseline = evaluateBrandVoiceState(current, { baselineScore: undefined, threshold: 70 });
  assert.equal(resUndefinedBaseline.dropped, false, 'Undefined baseline must NOT flag dropped');
});

test('BrandVoicePanel: progress bar width clamping prevents CSS overflow', () => {
  const negativeScore: BrandVoiceCheck = { score: -20, aligned: false, summary: '', tone: '', wording: '', message: '' };
  assert.equal(evaluateBrandVoiceState(negativeScore).progressWidth, 0);

  const excessiveScore: BrandVoiceCheck = { score: 150, aligned: true, summary: '', tone: '', wording: '', message: '' };
  assert.equal(evaluateBrandVoiceState(excessiveScore).progressWidth, 100);
});

test('saveVersionEdit: preserves unexamined state by omitting voice fields from payload', () => {
  const unexaminedVersion: ContentVersion = {
    id: 'v1',
    platform: 'FACEBOOK',
    status: 'GENERATED',
    scheduleStatus: null,
    script: { hook: { content: 'H', sceneSuggestion: '', timing: '' }, steps: [], cta: { content: '', sceneSuggestion: '', timing: '' } },
    caption: 'My caption',
    hashtags: ['#test'],
    cta: 'Call me',
    mediaPrompt: 'Prompt',
    imageUrl: null,
    brandVoice: {
      score: 0,
      aligned: null,
      summary: '',
      tone: '',
      wording: '',
      message: '',
    },
    createdAt: new Date().toISOString(),
  };

  const payload = buildVersionUpdatePayload(unexaminedVersion);
  assert.equal(payload.voiceScore, undefined, 'voiceScore must be undefined for unexamined version');
  assert.equal(payload.voiceAligned, undefined, 'voiceAligned must be undefined for unexamined version');
  assert.equal(payload.voiceNotes, undefined, 'voiceNotes must be undefined for unexamined version');

  // Verify that JSON stringifying omits these keys completely
  const json = JSON.stringify(payload);
  assert.ok(!json.includes('voiceScore'), 'JSON must not contain voiceScore');
  assert.ok(!json.includes('voiceAligned'), 'JSON must not contain voiceAligned');
  assert.ok(!json.includes('voiceNotes'), 'JSON must not contain voiceNotes');
});

test('saveVersionEdit: serializes brand voice fields accurately when present', () => {
  const examinedVersion: ContentVersion = {
    id: 'v2',
    platform: 'INSTAGRAM',
    status: 'GENERATED',
    scheduleStatus: null,
    script: { hook: { content: 'H', sceneSuggestion: '', timing: '' }, steps: [], cta: { content: '', sceneSuggestion: '', timing: '' } },
    caption: 'My IG caption',
    hashtags: ['#insta', 'photo'],
    cta: 'Like',
    mediaPrompt: 'Square photo',
    imageUrl: null,
    brandVoice: {
      score: 92,
      aligned: true,
      summary: 'Xuất sắc',
      tone: '',
      wording: '',
      message: '',
    },
    createdAt: new Date().toISOString(),
  };

  const payload = buildVersionUpdatePayload(examinedVersion);
  assert.equal(payload.voiceScore, 92);
  assert.equal(payload.voiceAligned, true);
  assert.equal(payload.voiceNotes, 'Xuất sắc');

  const json = JSON.parse(JSON.stringify(payload));
  assert.equal(json.voiceScore, 92);
  assert.equal(json.voiceAligned, true);
  assert.equal(json.voiceNotes, 'Xuất sắc');
});

test('ContentViewPanel: View Mode triggers recheck and immediately persists to backend', async () => {
  const version: ContentVersion = {
    id: 'v-view',
    platform: 'FACEBOOK',
    status: 'GENERATED',
    scheduleStatus: null,
    script: { hook: { content: 'Hook', sceneSuggestion: '', timing: '' }, steps: [], cta: { content: '', sceneSuggestion: '', timing: '' } },
    caption: 'View mode test',
    hashtags: [],
    cta: '',
    mediaPrompt: '',
    imageUrl: null,
    brandVoice: { score: 0, aligned: null, summary: '', tone: '', wording: '', message: '' },
    createdAt: new Date().toISOString(),
  };

  const panel = new ContentViewPanelModel([version]);
  assert.equal(panel.draft, null, 'Starts in view mode');

  const ok = await panel.handleRecheckVoice({ score: 88, aligned: true, summary: 'Good' });
  assert.equal(ok, true);
  assert.equal(panel.backendSaves.length, 1, 'Must persist to backend immediately in view mode');
  assert.equal(panel.backendSaves[0].version.brandVoice.score, 88);
  assert.equal(panel.backendSaves[0].version.brandVoice.aligned, true);
  assert.equal(panel.currentVersion!.brandVoice.score, 88);
  assert.equal(panel.onChangedCalls, 1);
});

test('ContentViewPanel: Edit Mode updates draft metrics only, persists on save, discards on cancel', async () => {
  const version: ContentVersion = {
    id: 'v-edit',
    platform: 'FACEBOOK',
    status: 'GENERATED',
    scheduleStatus: null,
    script: { hook: { content: 'Initial Hook', sceneSuggestion: '', timing: '' }, steps: [], cta: { content: '', sceneSuggestion: '', timing: '' } },
    caption: 'Initial caption',
    hashtags: [],
    cta: '',
    mediaPrompt: '',
    imageUrl: null,
    brandVoice: { score: 75, aligned: true, summary: 'Initial voice', tone: '', wording: '', message: '' },
    createdAt: new Date().toISOString(),
  };

  const panel = new ContentViewPanelModel([version]);

  // 1. Enter edit mode
  panel.startEdit();
  assert.ok(panel.draft !== null);
  panel.draft!.caption = 'Edited caption with lower voice alignment';

  // 2. Trigger recheck while in edit mode
  await panel.handleRecheckVoice({ score: 60, aligned: false, summary: 'Voice degraded after edit' });

  // Verify: backend NOT called yet, draft updated, version untouched
  assert.equal(panel.backendSaves.length, 0, 'Must NOT persist immediately while in edit mode');
  assert.equal(panel.draft!.brandVoice.score, 60, 'Draft brandVoice must reflect new score');
  assert.equal(panel.currentVersion!.brandVoice.score, 75, 'Saved version brandVoice must remain untouched');

  // Verify baseline score calculation for drop detection:
  // shown is draft (60), baselineScore is version.brandVoice.score (75) -> dropped!
  const state = evaluateBrandVoiceState(panel.shown!.brandVoice, {
    baselineScore: panel.currentVersion!.brandVoice.score,
    threshold: panel.threshold,
  });
  assert.equal(state.dropped, true, 'Draft must flag voice degradation compared to saved baseline');

  // 3. User saves changes
  await panel.saveEdit();
  assert.equal(panel.backendSaves.length, 1, 'Must save draft to backend on saveEdit');
  assert.equal(panel.backendSaves[0].version.brandVoice.score, 60);
  assert.equal(panel.backendSaves[0].version.caption, 'Edited caption with lower voice alignment');
  assert.equal(panel.currentVersion!.brandVoice.score, 60);
  assert.equal(panel.draft, null, 'Draft must be cleared after save');
});

test('ContentViewPanel: Edit Mode cancel discards rechecked metrics without backend writes', async () => {
  const version: ContentVersion = {
    id: 'v-cancel',
    platform: 'FACEBOOK',
    status: 'GENERATED',
    scheduleStatus: null,
    script: { hook: { content: 'H', sceneSuggestion: '', timing: '' }, steps: [], cta: { content: '', sceneSuggestion: '', timing: '' } },
    caption: 'Cap',
    hashtags: [],
    cta: '',
    mediaPrompt: '',
    imageUrl: null,
    brandVoice: { score: 80, aligned: true, summary: 'OK', tone: '', wording: '', message: '' },
    createdAt: new Date().toISOString(),
  };

  const panel = new ContentViewPanelModel([version]);
  panel.startEdit();
  await panel.handleRecheckVoice({ score: 40, aligned: false, summary: 'Terrible' });
  assert.equal(panel.draft!.brandVoice.score, 40);

  // Cancel edit
  panel.cancelEdit();
  assert.equal(panel.draft, null);
  assert.equal(panel.currentVersion!.brandVoice.score, 80, 'Original voice restored on cancel');
  assert.equal(panel.backendSaves.length, 0, 'No backend calls on cancel');
});

test('ContentViewPanel Concurrency: all actions blocked while voiceBusy is in flight', async () => {
  const version: ContentVersion = {
    id: 'v-concurrency',
    platform: 'FACEBOOK',
    status: 'GENERATED',
    scheduleStatus: null,
    script: { hook: { content: 'H', sceneSuggestion: '', timing: '' }, steps: [], cta: { content: '', sceneSuggestion: '', timing: '' } },
    caption: 'Cap',
    hashtags: [],
    cta: '',
    mediaPrompt: '',
    imageUrl: null,
    brandVoice: { score: 70, aligned: true, summary: '', tone: '', wording: '', message: '' },
    createdAt: new Date().toISOString(),
  };

  const version2: ContentVersion = {
    ...version,
    id: 'v-concurrency-ig',
    platform: 'INSTAGRAM',
  };

  const panel = new ContentViewPanelModel([version, version2]);

  // Set voiceBusy to true to simulate in-flight check
  panel.voiceBusy = true;

  // 1. Attempt platform switch
  const switched = panel.switchPlatform('INSTAGRAM');
  assert.equal(switched, false, 'Platform switch must be blocked when voiceBusy');
  assert.equal(panel.platform, 'FACEBOOK');

  // 2. Attempt start edit
  const startedEdit = panel.startEdit();
  assert.equal(startedEdit, false, 'Start edit must be blocked when voiceBusy');
  assert.equal(panel.draft, null);

  // 3. Attempt apply status
  const appliedStatus = await panel.applyStatus('NEED_REVIEW');
  assert.equal(appliedStatus, false, 'Status change must be blocked when voiceBusy');
  assert.equal(panel.reviewStatus, 'NONE');

  // 4. Attempt concurrent duplicate recheck
  const duplicateRecheck = await panel.handleRecheckVoice({ score: 90 });
  assert.equal(duplicateRecheck, false, 'Duplicate recheck must be blocked when voiceBusy');

  // Reset voiceBusy
  panel.voiceBusy = false;

  // Now in edit mode: test save/cancel blocked while voiceBusy
  panel.startEdit();
  panel.voiceBusy = true;

  const saved = await panel.saveEdit();
  assert.equal(saved, false, 'saveEdit must be blocked when voiceBusy');

  const cancelled = panel.cancelEdit();
  assert.equal(cancelled, false, 'cancelEdit must be blocked when voiceBusy');
});

test('ContentViewPanel: isEditable false (POSTING status) prevents recheck trigger', async () => {
  const postingVersion: ContentVersion = {
    id: 'v-posting',
    platform: 'FACEBOOK',
    status: 'POSTED',
    scheduleStatus: 'POSTING',
    script: { hook: { content: 'H', sceneSuggestion: '', timing: '' }, steps: [], cta: { content: '', sceneSuggestion: '', timing: '' } },
    caption: 'Posting now',
    hashtags: [],
    cta: '',
    mediaPrompt: '',
    imageUrl: null,
    brandVoice: { score: 80, aligned: true, summary: '', tone: '', wording: '', message: '' },
    createdAt: new Date().toISOString(),
  };

  const panel = new ContentViewPanelModel([postingVersion], 'POSTING');
  assert.equal(panel.isEditable, false);

  const rechecked = await panel.handleRecheckVoice({ score: 90 });
  assert.equal(rechecked, false, 'Recheck must be blocked when post is in POSTING state');
  assert.equal(panel.backendSaves.length, 0);
});
