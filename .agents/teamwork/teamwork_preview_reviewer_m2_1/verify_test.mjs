import assert from 'node:assert/strict';

// 1. Test toContentVersion mapping logic
function toBrandVoice(v) {
  return {
    score: v.voiceScore ?? 0,
    aligned: v.voiceAligned ?? (v.voiceScore != null && v.voiceScore > 0 ? v.voiceScore >= 70 : null),
    summary: v.voiceNotes ?? "",
    tone: "",
    wording: "",
    message: "",
  };
}

// Case 1.1: Full positive alignment
const bv1 = toBrandVoice({ voiceScore: 85, voiceAligned: true, voiceNotes: "Great tone" });
assert.equal(bv1.score, 85);
assert.equal(bv1.aligned, true);
assert.equal(bv1.summary, "Great tone");

// Case 1.2: Full negative alignment
const bv2 = toBrandVoice({ voiceScore: 40, voiceAligned: false, voiceNotes: "Off-brand" });
assert.equal(bv2.score, 40);
assert.equal(bv2.aligned, false);
assert.equal(bv2.summary, "Off-brand");

// Case 1.3: Unexamined version (nulls)
const bv3 = toBrandVoice({ voiceScore: null, voiceAligned: null, voiceNotes: null });
assert.equal(bv3.score, 0);
assert.equal(bv3.aligned, null, "Unexamined version must have aligned = null");
assert.equal(bv3.summary, "");

// Case 1.4: Zero score
const bv4 = toBrandVoice({ voiceScore: 0, voiceAligned: null, voiceNotes: "" });
assert.equal(bv4.score, 0);
assert.equal(bv4.aligned, null, "Score 0 with null aligned must evaluate to null");

// Case 1.5: Explicit false with high score (AI veto)
const bv5 = toBrandVoice({ voiceScore: 88, voiceAligned: false, voiceNotes: "AI detected tone mismatch" });
assert.equal(bv5.score, 88);
assert.equal(bv5.aligned, false, "Explicit voiceAligned=false must not be overridden by high score");

// Case 1.6: Explicit true with lower score (AI approval)
const bv6 = toBrandVoice({ voiceScore: 65, voiceAligned: true, voiceNotes: "Good enough" });
assert.equal(bv6.score, 65);
assert.equal(bv6.aligned, true, "Explicit voiceAligned=true must not be overridden by lower score");

// Case 1.7: Null voiceAligned with legacy score >= 70
const bv7 = toBrandVoice({ voiceScore: 75, voiceAligned: null, voiceNotes: "Legacy" });
assert.equal(bv7.score, 75);
assert.equal(bv7.aligned, true);

// Case 1.8: Null voiceAligned with legacy score < 70
const bv8 = toBrandVoice({ voiceScore: 65, voiceAligned: null, voiceNotes: "Legacy low" });
assert.equal(bv8.score, 65);
assert.equal(bv8.aligned, false);

console.log("PASS: toContentVersion brandVoice mapping tests passed.");

// 2. Test saveVersionEdit payload serialization logic
function computeSavePayload(version) {
  const hasVoice =
    (version.brandVoice?.score !== undefined && version.brandVoice.score > 0) ||
    (version.brandVoice?.aligned !== undefined && version.brandVoice.aligned !== null);

  const payload = {
    caption: version.caption,
    voiceScore: hasVoice ? version.brandVoice.score : undefined,
    voiceAligned: hasVoice
      ? (version.brandVoice.aligned ?? (version.brandVoice.score >= 70))
      : undefined,
    voiceNotes: hasVoice && version.brandVoice.summary ? version.brandVoice.summary : undefined,
  };
  return JSON.parse(JSON.stringify(payload)); // simulates JSON serialization (omits undefined)
}

// Case 2.1: Unexamined version -> voice fields must NOT be present in JSON
const p1 = computeSavePayload({ caption: "test", brandVoice: { score: 0, aligned: null, summary: "" } });
assert.equal("voiceScore" in p1, false, "Unexamined version must omit voiceScore in JSON");
assert.equal("voiceAligned" in p1, false, "Unexamined version must omit voiceAligned in JSON");
assert.equal("voiceNotes" in p1, false, "Unexamined version must omit voiceNotes in JSON");

// Case 2.2: Examined version with aligned=true
const p2 = computeSavePayload({ caption: "test", brandVoice: { score: 90, aligned: true, summary: "Super" } });
assert.equal(p2.voiceScore, 90);
assert.equal(p2.voiceAligned, true);
assert.equal(p2.voiceNotes, "Super");

// Case 2.3: Examined version with aligned=false
const p3 = computeSavePayload({ caption: "test", brandVoice: { score: 45, aligned: false, summary: "Needs work" } });
assert.equal(p3.voiceScore, 45);
assert.equal(p3.voiceAligned, false);
assert.equal(p3.voiceNotes, "Needs work");

// Case 2.4: Examined version with empty summary -> voiceNotes omitted
const p4 = computeSavePayload({ caption: "test", brandVoice: { score: 85, aligned: true, summary: "" } });
assert.equal(p4.voiceScore, 85);
assert.equal(p4.voiceAligned, true);
assert.equal("voiceNotes" in p4, false, "Empty summary must omit voiceNotes in JSON");

console.log("PASS: saveVersionEdit payload tests passed.");

// 3. Test BrandVoicePanel evaluation logic
function evaluatePanel(check, threshold = 70, baselineScore) {
  const checked = !!check && check.score > 0;
  const aligned = checked && (
    check.aligned !== undefined && check.aligned !== null
      ? Boolean(check.aligned)
      : check.score >= threshold
  );
  const dropped = checked && baselineScore !== undefined && baselineScore > 0 && check.score < baselineScore;
  const progressWidth = checked ? Math.min(100, Math.max(0, check.score)) : 0;
  return { checked, aligned, dropped, progressWidth };
}

// Case 3.1: Null check -> not checked
assert.deepEqual(evaluatePanel(null), { checked: false, aligned: false, dropped: false, progressWidth: 0 });

// Case 3.2: Score 0 -> not checked (renders "Chưa kiểm tra")
assert.deepEqual(evaluatePanel({ score: 0, aligned: null }), { checked: false, aligned: false, dropped: false, progressWidth: 0 });

// Case 3.3: Clamping over 100
assert.equal(evaluatePanel({ score: 120, aligned: true }).progressWidth, 100);

// Case 3.4: Clamping negative score
assert.equal(evaluatePanel({ score: -15, aligned: false }).progressWidth, 0);

// Case 3.5: Score dropped detection
const dropTest = evaluatePanel({ score: 65, aligned: false }, 70, 85);
assert.equal(dropTest.dropped, true);

// Case 3.6: Score maintained detection
const maintainTest = evaluatePanel({ score: 90, aligned: true }, 70, 85);
assert.equal(maintainTest.dropped, false);

console.log("PASS: BrandVoicePanel evaluation tests passed.");
