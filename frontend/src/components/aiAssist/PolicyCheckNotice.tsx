import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Loader2, ShieldAlert, Sparkles } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useToast } from '../toast/ToastProvider';
import { TONE_COLORS, type Tone } from '../../statusTokens';
import { alpha, C } from '../../styles/colors';
import type { Platform } from '../../api/brandProfile';
import { checkPolicy, isAiRunning, type PolicyCheckResult, type PolicyRiskLevel } from '../../api/aiAssist';
import { platformDisplayName } from '../../api/publishErrorCatalog';
import AiFixModal from './AiFixModal';

// Cảnh báo chính sách trước khi đăng (failed-posts đợt 2 — A2), dưới mỗi nền tảng ở bước lên lịch. CHỈ cảnh báo:
// không khoá nút lên lịch. Bộ lọc tự động chạy miễn phí; AI chỉ chạy khi bộ lọc có nghi vấn + được phép (backend
// quyết định, cache theo hash nội dung). "AI sửa ngay" mở AiFixModal rồi kiểm tra lại nội dung mới.

const POLL_MS = 2000;
const POLL_LIMIT = 45;

const RISK_TONE: Record<PolicyRiskLevel, Tone> = { NONE: 'success', LOW: 'info', MEDIUM: 'warning', HIGH: 'danger' };
const RULE_KEYS = ['REFUND_GUARANTEE', 'HEALTH_CLAIM', 'EXAGGERATED_DISCOUNT', 'ABSOLUTE_CLAIM', 'FINANCIAL_PROMISE', 'ENGAGEMENT_BAIT'] as const;

export default function PolicyCheckNotice({ versionId, platform }: { versionId: string; platform: Platform }) {
  const { t, go } = useApp();
  const toast = useToast();
  const [result, setResult] = useState<PolicyCheckResult | null>(null);
  const [fixOpen, setFixOpen] = useState(false);
  const [round, setRound] = useState(0);
  // Một lần kiểm tra cho mỗi (bản, lượt) — StrictMode chạy effect 2 lần ở dev, không được tạo 2 job AI.
  const started = useRef<{ key: string; request: Promise<PolicyCheckResult> } | null>(null);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let polls = 0;
    const key = `${versionId}:${round}`;
    if (!started.current || started.current.key !== key) {
      started.current = { key, request: checkPolicy(versionId) };
    }
    const handle = (next: PolicyCheckResult) => {
      if (cancelled) return;
      setResult(next);
      if (isAiRunning(next.aiStatus) && ++polls < POLL_LIMIT) {
        timer = setTimeout(() => checkPolicy(versionId).then(handle).catch(() => undefined), POLL_MS);
      }
    };
    started.current.request.then(handle).catch(() => { if (!cancelled) setResult(null); });
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [versionId, round]);

  if (!result || !result.enabled) return null;
  const name = platformDisplayName(platform);

  if (result.ruleHits.length === 0) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: C.textMuted }}>
        <CheckCircle2 size={13} color={TONE_COLORS.success.color} aria-hidden /> {t.pcChecked}
      </div>
    );
  }

  const ai = result.aiStatus === 'DONE' ? result.ai : null;
  const risk: PolicyRiskLevel = ai ? ai.riskLevel : result.ruleRisk;
  const tone = TONE_COLORS[RISK_TONE[risk]];
  const aiNote = result.aiStatus === 'PLAN_NOT_INCLUDED' ? t.pcPlanNotIncluded
    : result.aiStatus === 'LIMIT_REACHED' ? t.pcLimitReached.replace('{limit}', String(result.aiChecksLimit ?? 0))
      : result.aiStatus === 'QUOTA_EXCEEDED' ? t.pcQuota
        : result.aiStatus === 'FAILED' ? t.pcAiFailed : null;
  // Hết lượt / gói không gồm AI kiểm tra (giới hạn theo gói, admin cấu hình) → gợi ý nâng gói.
  const planBlocked = result.aiStatus === 'PLAN_NOT_INCLUDED' || result.aiStatus === 'LIMIT_REACHED';
  const usageNote = (result.aiStatus === 'DONE' || isAiRunning(result.aiStatus)) && result.aiChecksLimit !== null
    ? t.pcChecksUsed.replace('{used}', String(result.aiChecksUsed)).replace('{limit}', String(result.aiChecksLimit))
    : null;
  const ruleLabel = (category: string) =>
    (RULE_KEYS as readonly string[]).includes(category) ? t[`aiRule_${category as (typeof RULE_KEYS)[number]}`] : t.aiRule_OTHER;

  return (
    <div role="status" style={{ background: tone.bg, border: `1px solid ${alpha(tone.color, 0.22)}`, borderRadius: 12, padding: '11px 13px', display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <ShieldAlert size={16} color={tone.color} aria-hidden style={{ flex: 'none' }} />
        <strong style={{ fontSize: 13, color: C.ink750, flex: 1, minWidth: 180 }}>{t.pcTitle.replace('{platform}', name)}</strong>
        <span style={{ fontSize: 10.5, fontWeight: 800, padding: '3px 9px', borderRadius: 999, color: tone.color, background: alpha(tone.color, 0.12) }}>
          {t[`pcRisk_${risk}`]}
        </span>
      </div>

      {!ai && (
        <div style={{ fontSize: 12.5, color: C.ink650, lineHeight: 1.5 }}>
          {t.pcRulesFound.replace('{n}', String(result.ruleHits.length))}
          <ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>
            {result.ruleHits.map((h) => (
              <li key={h.ruleId}><strong>{ruleLabel(h.category)}</strong>{h.excerpt ? ` — “${h.excerpt}”` : ''}</li>
            ))}
          </ul>
        </div>
      )}

      {isAiRunning(result.aiStatus) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12.5, color: TONE_COLORS.ai.color }}>
          <Loader2 size={13} className="icon-spin" aria-hidden /> {t.pcAiChecking}
        </div>
      )}

      {ai && (
        <div style={{ fontSize: 12.5, color: C.ink650, lineHeight: 1.55 }}>
          <div style={{ fontWeight: 700, color: C.ink750 }}>{t.pcAiTitle}</div>
          <div>{ai.riskLevel === 'NONE' ? t.pcAiClean : ai.summary}</div>
          {ai.issues.length > 0 && (
            <ul style={{ margin: '4px 0 0', paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 4 }}>
              {ai.issues.map((issue, i) => (
                <li key={i}>
                  {issue.excerpt && <strong>“{issue.excerpt}”: </strong>}{issue.reason}
                  {issue.suggestion && <div style={{ color: C.textMuted }}>{t.pcSuggestion}: {issue.suggestion}</div>}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {(aiNote || usageNote) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontSize: 12, color: C.textMuted }}>
          <span>{aiNote ?? usageNote}</span>
          {planBlocked && (
            <button type="button" onClick={() => go('pricing')} className="btn-soft"
              style={{ border: 'none', background: 'none', padding: 0, fontSize: 12, fontWeight: 700, color: TONE_COLORS.ai.color, cursor: 'pointer', textDecoration: 'underline' }}>
              {t.pcUpgrade}
            </button>
          )}
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 11.5, color: C.textMuted }}>{t.pcWarnOnly}</span>
        {risk !== 'NONE' && (
          <button
            type="button"
            onClick={() => setFixOpen(true)}
            className="btn-soft"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: `1px solid ${alpha(TONE_COLORS.ai.color, 0.3)}`, background: C.surface, borderRadius: 9, padding: '6px 11px', fontSize: 12.5, fontWeight: 700, color: TONE_COLORS.ai.color, cursor: 'pointer' }}
          >
            <Sparkles size={13} aria-hidden /> {t.pcFixNow}
          </button>
        )}
      </div>

      {fixOpen && (
        <AiFixModal
          contentVersionId={versionId}
          onClose={() => setFixOpen(false)}
          onApplied={() => {
            setFixOpen(false);
            toast.success(t.aiFixApplied);
            setRound((n) => n + 1); // nội dung mới → kiểm tra lại (hash mới)
          }}
        />
      )}
    </div>
  );
}
