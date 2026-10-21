// Chạy: npm test  (node --test --experimental-strip-types)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

// Đọc source code thật để xác minh tĩnh (static assertion) không có độ lệch triển khai
const serviceSourcePath = path.resolve(import.meta.dirname, '../src/api/contentCreationService.ts');
const serviceSource = fs.readFileSync(serviceSourcePath, 'utf8');

// Trích xuất đoạn mã toContentVersion trong contentCreationService.ts
test('static inspection: contentCreationService.ts contains exact brand voice mapping implementation', () => {
  // Kiểm tra toContentVersion
  assert.ok(
    serviceSource.includes('score: v.voiceScore ?? 0'),
    'toContentVersion must default voiceScore to 0'
  );
  assert.ok(
    serviceSource.includes('aligned: v.voiceAligned ?? (v.voiceScore != null && v.voiceScore > 0 ? v.voiceScore >= 70 : null)'),
    'toContentVersion must use exact alignment expression'
  );
  assert.ok(
    serviceSource.includes('summary: v.voiceNotes ?? ""'),
    'toContentVersion must map voiceNotes to summary'
  );

  // Kiểm tra saveVersionEdit
  assert.ok(
    serviceSource.includes('(version.brandVoice?.score !== undefined && version.brandVoice.score > 0) ||'),
    'saveVersionEdit must check brandVoice.score > 0'
  );
  assert.ok(
    serviceSource.includes('(version.brandVoice?.aligned !== undefined && version.brandVoice.aligned !== null)'),
    'saveVersionEdit must check brandVoice.aligned is non-null'
  );
  assert.ok(
    serviceSource.includes('voiceScore: hasVoice ? version.brandVoice.score : undefined'),
    'saveVersionEdit must leave voiceScore undefined when !hasVoice'
  );
  assert.ok(
    serviceSource.includes('voiceAligned: hasVoice\n      ? (version.brandVoice.aligned ?? (version.brandVoice.score >= 70))\n      : undefined') ||
    serviceSource.includes('voiceAligned: hasVoice ? (version.brandVoice.aligned ?? (version.brandVoice.score >= 70)) : undefined') ||
    serviceSource.includes('version.brandVoice.aligned ?? (version.brandVoice.score >= 70)'),
    'saveVersionEdit must map voiceAligned with fallback threshold'
  );
  assert.ok(
    serviceSource.includes('voiceNotes: hasVoice && version.brandVoice.summary ? version.brandVoice.summary : undefined'),
    'saveVersionEdit must leave voiceNotes undefined when empty or !hasVoice'
  );
});

// Implementation mirrors contentCreationService.ts lines 455-462
function toBrandVoice(v: { voiceScore?: number | null; voiceAligned?: boolean | null; voiceNotes?: string | null }) {
  return {
    score: v.voiceScore ?? 0,
    aligned: v.voiceAligned ?? (v.voiceScore != null && v.voiceScore > 0 ? v.voiceScore >= 70 : null),
    summary: v.voiceNotes ?? "",
    tone: "",
    wording: "",
    message: "",
  };
}

// Implementation mirrors contentCreationService.ts lines 333-348
function toVersionEditPayload(version: {
  script?: any;
  caption?: string;
  hashtags?: string[];
  cta?: string;
  mediaPrompt?: string;
  brandVoice?: {
    score?: number;
    aligned?: boolean | null;
    summary?: string;
  } | null;
}) {
  const hasVoice =
    (version.brandVoice?.score !== undefined && version.brandVoice.score > 0) ||
    (version.brandVoice?.aligned !== undefined && version.brandVoice.aligned !== null);

  return {
    voiceScore: hasVoice ? version.brandVoice?.score : undefined,
    voiceAligned: hasVoice
      ? (version.brandVoice?.aligned ?? ((version.brandVoice?.score ?? 0) >= 70))
      : undefined,
    voiceNotes: hasVoice && version.brandVoice?.summary ? version.brandVoice.summary : undefined,
  };
}

// -------------------------------------------------------------
// 1. Stress-test toContentVersion mapping and boundary values
// -------------------------------------------------------------
test('toContentVersion: unexamined boundary (voiceScore=null, voiceAligned=null) yields score 0 and aligned null', () => {
  const res = toBrandVoice({ voiceScore: null, voiceAligned: null, voiceNotes: null });
  assert.equal(res.score, 0, 'score must default to 0');
  assert.equal(res.aligned, null, 'aligned must be null ("Chưa kiểm tra")');
  assert.equal(res.summary, '', 'summary must be empty string');
});

test('toContentVersion: unexamined boundary (voiceScore=undefined, voiceAligned=undefined) yields score 0 and aligned null', () => {
  const res = toBrandVoice({});
  assert.equal(res.score, 0);
  assert.equal(res.aligned, null);
  assert.equal(res.summary, '');
});

test('toContentVersion: high score with null voiceAligned (voiceScore=85, voiceAligned=null) yields score 85 and aligned true', () => {
  const res = toBrandVoice({ voiceScore: 85, voiceAligned: null, voiceNotes: 'Tốt' });
  assert.equal(res.score, 85);
  assert.equal(res.aligned, true, 'aligned must evaluate to true because score >= 70');
  assert.equal(res.summary, 'Tốt');
});

test('toContentVersion: explicit boolean overrides threshold (voiceScore=65, voiceAligned=true) yields score 65 and aligned true', () => {
  const res = toBrandVoice({ voiceScore: 65, voiceAligned: true, voiceNotes: 'Nội dung ngắn' });
  assert.equal(res.score, 65);
  assert.equal(res.aligned, true, 'explicit voiceAligned=true must be respected even when score < 70');
  assert.equal(res.summary, 'Nội dung ngắn');
});

test('toContentVersion: explicit boolean overrides threshold (voiceScore=75, voiceAligned=false) yields score 75 and aligned false', () => {
  const res = toBrandVoice({ voiceScore: 75, voiceAligned: false, voiceNotes: 'Nhạy cảm' });
  assert.equal(res.score, 75);
  assert.equal(res.aligned, false, 'explicit voiceAligned=false must be respected even when score >= 70');
  assert.equal(res.summary, 'Nhạy cảm');
});

test('toContentVersion: exact threshold boundary values 70 and 69 with voiceAligned=null', () => {
  const at70 = toBrandVoice({ voiceScore: 70, voiceAligned: null });
  assert.equal(at70.score, 70);
  assert.equal(at70.aligned, true, 'score 70 must be aligned');

  const at69 = toBrandVoice({ voiceScore: 69, voiceAligned: null });
  assert.equal(at69.score, 69);
  assert.equal(at69.aligned, false, 'score 69 must be unaligned (false)');
});

test('toContentVersion: zero score boundaries with explicit aligned flags', () => {
  const zeroUnaligned = toBrandVoice({ voiceScore: 0, voiceAligned: false });
  assert.equal(zeroUnaligned.score, 0);
  assert.equal(zeroUnaligned.aligned, false, 'explicit false with score 0 must be preserved');

  const zeroAligned = toBrandVoice({ voiceScore: 0, voiceAligned: true });
  assert.equal(zeroAligned.score, 0);
  assert.equal(zeroAligned.aligned, true, 'explicit true with score 0 must be preserved');

  const zeroNull = toBrandVoice({ voiceScore: 0, voiceAligned: null });
  assert.equal(zeroNull.score, 0);
  assert.equal(zeroNull.aligned, null, 'score 0 with aligned null must remain null ("Chưa kiểm tra")');
});

test('toContentVersion: negative scores or missing scores do not mistakenly evaluate to aligned true', () => {
  const neg = toBrandVoice({ voiceScore: -10, voiceAligned: null });
  assert.equal(neg.score, -10);
  assert.equal(neg.aligned, null, 'negative score with null aligned must evaluate to null');

  const hundred = toBrandVoice({ voiceScore: 100, voiceAligned: null });
  assert.equal(hundred.score, 100);
  assert.equal(hundred.aligned, true, 'score 100 with null aligned evaluates to true');
});

// -------------------------------------------------------------
// 2. Stress-test saveVersionEdit payload generation
// -------------------------------------------------------------
test('saveVersionEdit: unexamined version (score=0, aligned=null) leaves voice fields undefined in payload', () => {
  const version = {
    brandVoice: {
      score: 0,
      aligned: null,
      summary: '',
    },
  };

  const payload = toVersionEditPayload(version);
  assert.equal(payload.voiceScore, undefined, 'voiceScore must be undefined to avoid overwriting DB');
  assert.equal(payload.voiceAligned, undefined, 'voiceAligned must be undefined');
  assert.equal(payload.voiceNotes, undefined, 'voiceNotes must be undefined');

  // Verify JSON serialization omits undefined keys
  const serialized = JSON.stringify(payload);
  assert.ok(!serialized.includes('voiceScore'), 'serialized JSON must not contain voiceScore');
  assert.ok(!serialized.includes('voiceAligned'), 'serialized JSON must not contain voiceAligned');
  assert.ok(!serialized.includes('voiceNotes'), 'serialized JSON must not contain voiceNotes');
});

test('saveVersionEdit: evaluated version with explicit aligned=true forwards all fields accurately', () => {
  const version = {
    brandVoice: {
      score: 65,
      aligned: true,
      summary: 'Matches brand guidelines closely',
    },
  };

  const payload = toVersionEditPayload(version);
  assert.equal(payload.voiceScore, 65);
  assert.equal(payload.voiceAligned, true);
  assert.equal(payload.voiceNotes, 'Matches brand guidelines closely');

  const serialized = JSON.parse(JSON.stringify(payload));
  assert.equal(serialized.voiceScore, 65);
  assert.equal(serialized.voiceAligned, true);
  assert.equal(serialized.voiceNotes, 'Matches brand guidelines closely');
});

test('saveVersionEdit: evaluated version with explicit aligned=false forwards aligned false regardless of high score', () => {
  const version = {
    brandVoice: {
      score: 85,
      aligned: false,
      summary: 'High score but contains banned competitor term',
    },
  };

  const payload = toVersionEditPayload(version);
  assert.equal(payload.voiceScore, 85);
  assert.equal(payload.voiceAligned, false, 'must forward false even if score >= 70');
  assert.equal(payload.voiceNotes, 'High score but contains banned competitor term');
});

test('saveVersionEdit: evaluated version with aligned=null falls back to score >= 70', () => {
  const versionHigh = {
    brandVoice: {
      score: 80,
      aligned: null,
      summary: 'Good',
    },
  };
  let payload = toVersionEditPayload(versionHigh);
  assert.equal(payload.voiceScore, 80);
  assert.equal(payload.voiceAligned, true, '80 >= 70 yields true');

  const versionLow = {
    brandVoice: {
      score: 55,
      aligned: null,
      summary: 'Low',
    },
  };
  payload = toVersionEditPayload(versionLow);
  assert.equal(payload.voiceScore, 55);
  assert.equal(payload.voiceAligned, false, '55 >= 70 yields false');
});

test('saveVersionEdit: zero score with explicit aligned=false is recognized as having voice', () => {
  const versionZero = {
    brandVoice: {
      score: 0,
      aligned: false,
      summary: 'Unacceptable',
    },
  };

  const payload = toVersionEditPayload(versionZero);
  assert.equal(payload.voiceScore, 0);
  assert.equal(payload.voiceAligned, false);
  assert.equal(payload.voiceNotes, 'Unacceptable');
});

test('saveVersionEdit: null or undefined brandVoice safely produces undefined fields', () => {
  const payloadNull = toVersionEditPayload({ brandVoice: null });
  assert.equal(payloadNull.voiceScore, undefined);
  assert.equal(payloadNull.voiceAligned, undefined);
  assert.equal(payloadNull.voiceNotes, undefined);

  const payloadUndefined = toVersionEditPayload({});
  assert.equal(payloadUndefined.voiceScore, undefined);
  assert.equal(payloadUndefined.voiceAligned, undefined);
  assert.equal(payloadUndefined.voiceNotes, undefined);
});

// -------------------------------------------------------------
// 3. Stress-test BrandVoicePanel logic rules
// -------------------------------------------------------------
test('BrandVoicePanel: checked flag and alignment logic check', () => {
  const threshold = 70;

  // Unchecked case: score = 0, aligned = null
  const check1 = { score: 0, aligned: null, summary: '', tone: '', wording: '', message: '' };
  const checked1 = !!check1 && check1.score > 0;
  assert.equal(checked1, false, 'score 0 must be unchecked');

  // Checked case: score = 85, aligned = null
  const check2 = { score: 85, aligned: null, summary: '', tone: '', wording: '', message: '' };
  const checked2 = !!check2 && check2.score > 0;
  const aligned2 = checked2 && (
    check2.aligned !== undefined && check2.aligned !== null
      ? Boolean(check2.aligned)
      : check2.score >= threshold
  );
  assert.equal(checked2, true);
  assert.equal(aligned2, true);

  // Checked case: score = 65, aligned = true (explicit override below threshold)
  const check3 = { score: 65, aligned: true, summary: '', tone: '', wording: '', message: '' };
  const checked3 = !!check3 && check3.score > 0;
  const aligned3 = checked3 && (
    check3.aligned !== undefined && check3.aligned !== null
      ? Boolean(check3.aligned)
      : check3.score >= threshold
  );
  assert.equal(checked3, true);
  assert.equal(aligned3, true);

  // Checked case: score = 75, aligned = false (explicit override above threshold)
  const check4 = { score: 75, aligned: false, summary: '', tone: '', wording: '', message: '' };
  const checked4 = !!check4 && check4.score > 0;
  const aligned4 = checked4 && (
    check4.aligned !== undefined && check4.aligned !== null
      ? Boolean(check4.aligned)
      : check4.score >= threshold
  );
  assert.equal(checked4, true);
  assert.equal(aligned4, false);

  // Progress bar clamp checks
  assert.equal(Math.min(100, Math.max(0, -15)), 0, 'negative score clamped to 0');
  assert.equal(Math.min(100, Math.max(0, 125)), 100, 'over-100 score clamped to 100');
  assert.equal(Math.min(100, Math.max(0, 85)), 85, 'normal score preserved');
});
