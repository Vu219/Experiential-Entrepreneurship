import { useCallback, useEffect, useMemo, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { useApp } from '../../../context/AppContext';
import ConfirmDialog from '../../brand/ConfirmDialog';
import StatusBadge, { type Tone } from '../StatusBadge';
import { Loader } from '../../ui';
import { withToast } from '../../../utils/toastFlow';
import { formatDateTimeVN, formatDateVN } from '../../../utils/format';
import { durationOk, reasonOk, REASON_MAX } from '../../../validations/subscriptionValidation';
import type { ApiError } from '../../../api/apiClient';
import type { PlanSource } from '../../../api/payments';
import { getAdminPlans, type PlanDto } from '../../../api/plans';
import {
  getUserSubscription, getUserSubscriptionHistory, extendUserSubscription,
  changeUserSubscription, revokeUserSubscription, userPlanMeta, DURATION_MAX,
  type UserSubscription, type SubscriptionHistoryEntry, type DurationUnit,
  type SubscriptionChangeCategory, type UserPlan,
} from '../../../api/admin';
import { C } from '../../../styles/colors';

type Action = 'extend' | 'change' | 'revoke';
const UNITS: DurationUnit[] = ['DAY', 'WEEK', 'MONTH'];
const CATEGORIES: SubscriptionChangeCategory[] = ['PROMOTION', 'COMPENSATION', 'SUPPORT', 'OTHER'];
const HISTORY_PAGE = 10;
const CORE_CODES = new Set(['FREE', 'PLUS', 'PRO']);

/** Cộng thời lượng theo lịch, chỉ để XEM TRƯỚC — tháng kẹp về cuối tháng như plusMonths của backend. */
function addDuration(base: Date, amount: number, unit: DurationUnit): Date {
  const d = new Date(base);
  if (unit === 'DAY') d.setDate(d.getDate() + amount);
  else if (unit === 'WEEK') d.setDate(d.getDate() + amount * 7);
  else {
    const day = d.getDate();
    d.setDate(1);
    d.setMonth(d.getMonth() + amount);
    d.setDate(Math.min(day, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()));
  }
  return d;
}

const fill = (tpl: string, vars: Record<string, string | number>) =>
  Object.entries(vars).reduce((s, [k, v]) => s.split(`{${k}}`).join(String(v)), tpl);

/**
 * Tab "Gói dịch vụ" trong modal chi tiết người dùng: gói hiện tại (đọc từ subscription — nguồn sự
 * thật), 3 thao tác gia hạn / đổi gói / thu hồi (bắt buộc phân loại + lý do), và lịch sử thay đổi.
 * Chỉ tác động MỘT user — áp gói hàng loạt là tính năng riêng, không làm ở đây.
 */
export default function UserPlanTab({ userId, userName, onPlanChanged }: {
  userId: string;
  userName: string;
  /** Nhãn gói mới sau thao tác — để bảng danh sách cập nhật badge. */
  onPlanChanged: (plan: UserPlan) => void;
}) {
  const { t, lang } = useApp();

  const [sub, setSub] = useState<UserSubscription | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [plans, setPlans] = useState<PlanDto[]>([]);
  const [history, setHistory] = useState<SubscriptionHistoryEntry[]>([]);
  const [historyPage, setHistoryPage] = useState(0);
  const [historyLast, setHistoryLast] = useState(true);
  const [historyBusy, setHistoryBusy] = useState(false);

  const [action, setAction] = useState<Action>('extend');
  const [amount, setAmount] = useState('7');
  const [unit, setUnit] = useState<DurationUnit>('DAY');
  const [planId, setPlanId] = useState('');
  const [noExpiry, setNoExpiry] = useState(false);
  const [category, setCategory] = useState<SubscriptionChangeCategory | ''>('');
  const [reason, setReason] = useState('');
  const [errors, setErrors] = useState<{ amount?: string; plan?: string; category?: string; reason?: string }>({});
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  const loadHistory = useCallback(async (page: number) => {
    setHistoryBusy(true);
    try {
      const res = await getUserSubscriptionHistory(userId, page, HISTORY_PAGE);
      setHistory((prev) => (page === 0 ? res.content : [...prev, ...res.content]));
      setHistoryPage(page);
      setHistoryLast(res.last);
    } catch {
      // Lịch sử là phần phụ: lỗi thì để trống, không chặn thao tác gói.
    } finally {
      setHistoryBusy(false);
    }
  }, [userId]);

  useEffect(() => {
    let alive = true;
    getUserSubscription(userId)
      .then((s) => { if (alive) setSub(s); })
      .catch(() => { if (alive) setLoadFailed(true); });
    getAdminPlans()
      .then((p) => { if (alive) setPlans(p.plans); })
      .catch(() => { /* dropdown rỗng → nút Áp dụng của Đổi gói báo thiếu gói */ });
    loadHistory(0);
    return () => { alive = false; };
  }, [userId, loadHistory]);

  const planName = useCallback((code: string | null) => {
    if (!code) return '—';
    const p = plans.find((x) => x.code === code);
    if (p) return lang === 'en' ? p.nameEn : p.nameVi;
    return CORE_CODES.has(code) ? userPlanMeta(code as UserPlan).label : code;
  }, [plans, lang]);

  const isFree = sub?.planCode === 'FREE';
  const canExtend = !!sub && !isFree && !!sub.planExpiresAt;
  // Trùng gói đang có hạn là việc của Gia hạn — không liệt kê để admin khỏi ghi đè hạn cũ.
  const targetPlans = useMemo(
    () => plans.filter((p) => p.code !== 'FREE' && !(sub && p.code === sub.planCode && sub.planExpiresAt)),
    [plans, sub]
  );

  const amountNum = Number(amount);
  const extendPreview = useMemo(() => {
    if (!sub?.planExpiresAt || !durationOk(amountNum, unit)) return null;
    const base = new Date(sub.planExpiresAt);
    const from = base.getTime() > Date.now() ? base : new Date();
    return addDuration(from, amountNum, unit);
  }, [sub, amountNum, unit]);
  const changePreview = useMemo(
    () => (!noExpiry && durationOk(amountNum, unit) ? addDuration(new Date(), amountNum, unit) : null),
    [noExpiry, amountNum, unit]
  );

  const pickAction = (a: Action) => { setAction(a); setErrors({}); };

  const validate = () => {
    const er: typeof errors = {};
    const needsDuration = action === 'extend' || (action === 'change' && !noExpiry);
    if (needsDuration && !durationOk(amountNum, unit)) {
      er.amount = fill(t.upAmountInvalid, { n: DURATION_MAX[unit] });
    }
    if (action === 'change' && !planId) er.plan = t.upPickPlan;
    if (!category) er.category = t.upCategoryReq;
    if (!reasonOk(reason)) er.reason = t.upReasonReq;
    setErrors(er);
    return Object.keys(er).length === 0;
  };

  const confirmMessage = () => {
    const name = userName;
    if (action === 'extend') {
      return fill(t.upConfirmExtend, {
        name, plan: planName(sub?.planCode ?? null), amount: amountNum, unit: t[`upUnit${unit}`],
      });
    }
    if (action === 'change') {
      return fill(t.upConfirmChange, { name, plan: planName(plans.find((p) => p.id === planId)?.code ?? null) });
    }
    return fill(t.upConfirmRevoke, { name, plan: planName(sub?.planCode ?? null) });
  };

  const apply = async () => {
    if (!category) return;
    setBusy(true);
    const base = { category, reason: reason.trim() };
    const call = action === 'extend'
      ? extendUserSubscription(userId, { ...base, amount: amountNum, unit })
      : action === 'change'
        ? changeUserSubscription(userId, noExpiry
          ? { ...base, planId, noExpiry: true }
          : { ...base, planId, noExpiry: false, amount: amountNum, unit })
        : revokeUserSubscription(userId, base);
    try {
      const updated = await withToast(call, {
        loading: t.upApply + '…',
        success: t.upDone,
        error: (e) => (e as ApiError).message || t.upFail,
        title: t.usrTabPlan,
      });
      setSub(updated);
      onPlanChanged(updated.planLabel);
      setReason('');
      setCategory('');
      setPlanId('');
      loadHistory(0);
    } catch {
      // toast đã báo lỗi
    } finally {
      setBusy(false);
      setConfirming(false);
    }
  };

  const submit = () => { if (validate()) setConfirming(true); };

  if (loadFailed) return <div style={noteBox}>{t.upLoadFail}</div>;
  if (!sub) return <div style={{ display: 'flex', justifyContent: 'center', padding: 32 }}><Loader /></div>;

  const sourceMeta: Record<PlanSource, { tone: Tone; label: string }> = {
    FREE: { tone: 'neutral', label: t.upSourceFree },
    PAYMENT: { tone: 'success', label: t.upSourcePayment },
    ADMIN: { tone: 'info', label: t.upSourceAdmin },
  };
  const daysLeft = sub.planExpiresAt
    ? Math.ceil((new Date(sub.planExpiresAt).getTime() - Date.now()) / 86400000)
    : null;
  const planTone: Tone = CORE_CODES.has(sub.planCode) ? userPlanMeta(sub.planCode as UserPlan).tone : 'purple';
  const actionDisabled = busy
    || (action === 'extend' && !canExtend)
    || (action === 'revoke' && isFree);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Gói hiện tại */}
      <div style={panel}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={sectionLabel}>{t.upCurrent}</span>
            <StatusBadge tone={planTone} label={lang === 'en' ? sub.planNameEn : sub.planNameVi} />
          </div>
          <StatusBadge tone={sourceMeta[sub.planSource].tone} label={`${t.upSource}: ${sourceMeta[sub.planSource].label}`} />
        </div>
        <div className="grid-2" style={{ display: 'grid', gap: 10, marginTop: 12 }}>
          <Fact label={t.upStarted} value={formatDateVN(sub.planStartedAt)} />
          <Fact
            label={t.upExpires}
            value={sub.planExpiresAt ? formatDateTimeVN(sub.planExpiresAt) : t.upNoExpiry}
            hint={daysLeft === null ? undefined
              : daysLeft <= 0 ? t.upExpiresToday : fill(t.upDaysLeft, { n: daysLeft })}
          />
        </div>
      </div>

      {/* Thao tác */}
      <div>
        <div style={{ ...sectionLabel, marginBottom: 8 }}>{t.upActions}</div>
        <div role="tablist" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
          {([['extend', t.upActExtend], ['change', t.upActChange], ['revoke', t.upActRevoke]] as const).map(([k, label]) => (
            <button key={k} type="button" role="tab" aria-selected={action === k}
              onClick={() => pickAction(k)} style={pill(action === k, k === 'revoke')}>
              {label}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {action === 'extend' && (canExtend ? (
            <>
              <DurationFields amount={amount} unit={unit} error={errors.amount}
                onAmount={setAmount} onUnit={setUnit} label={t.upAmount} />
              {extendPreview && (
                <div style={previewBox}>
                  {t.upNewExpiry}: <b>{formatDateTimeVN(extendPreview)}</b>
                  <span style={{ color: C.textMuted }}> · {t.upExtendFrom} {formatDateTimeVN(sub.planExpiresAt)}</span>
                </div>
              )}
            </>
          ) : <div style={noteBox}>{t.upExtendNotAllowed}</div>)}

          {action === 'change' && (
            <>
              <Field label={t.upTargetPlan} error={errors.plan}>
                <select value={planId} onChange={(e) => setPlanId(e.target.value)} style={input}>
                  <option value="">{t.upPickPlan}</option>
                  {targetPlans.map((p) => (
                    <option key={p.id} value={p.id}>{lang === 'en' ? p.nameEn : p.nameVi}</option>
                  ))}
                </select>
              </Field>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: C.ink650, cursor: 'pointer' }}>
                <input type="checkbox" checked={noExpiry} onChange={(e) => setNoExpiry(e.target.checked)} />
                {t.upNoExpiry}
              </label>
              {!noExpiry && (
                <DurationFields amount={amount} unit={unit} error={errors.amount}
                  onAmount={setAmount} onUnit={setUnit} label={t.upDurationFromNow} />
              )}
              {changePreview && (
                <div style={previewBox}>{t.upNewExpiry}: <b>{formatDateTimeVN(changePreview)}</b></div>
              )}
              <div style={warnBox}>{t.upChangeNote}</div>
            </>
          )}

          {action === 'revoke' && (
            <div style={isFree ? noteBox : warnBox}>{isFree ? t.upRevokeFreeAlready : t.upRevokeDesc}</div>
          )}

          {!(action === 'extend' && !canExtend) && !(action === 'revoke' && isFree) && (
            <>
              <Field label={t.upCategory} error={errors.category}>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {CATEGORIES.map((c) => (
                    <button key={c} type="button" aria-pressed={category === c}
                      onClick={() => setCategory(c)} style={pill(category === c, false)}>
                      {t[`upCat${c}`]}
                    </button>
                  ))}
                </div>
              </Field>
              <Field label={t.upReason} error={errors.reason}>
                <textarea value={reason} maxLength={REASON_MAX} rows={2} placeholder={t.upReasonPh}
                  onChange={(e) => setReason(e.target.value)}
                  style={{ ...input, height: 'auto', padding: '10px 12px', resize: 'vertical', fontFamily: 'inherit' }} />
              </Field>
              <button type="button" onClick={submit} disabled={actionDisabled} style={applyBtn(actionDisabled, action === 'revoke')}>
                {action === 'extend' ? t.upActExtend : action === 'change' ? t.upActChange : t.upActRevoke}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Lịch sử */}
      <div>
        <div style={{ ...sectionLabel, marginBottom: 8 }}>{t.upHistory}</div>
        {history.length === 0 && !historyBusy ? (
          <div style={noteBox}>{t.upHistoryEmpty}</div>
        ) : (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {history.map((h) => (
              <HistoryRow key={h.id} entry={h} planName={planName} />
            ))}
          </ul>
        )}
        {!historyLast && (
          <button type="button" onClick={() => loadHistory(historyPage + 1)} disabled={historyBusy}
            style={{ ...outlineBtn, marginTop: 8 }}>
            {t.upLoadMore}
          </button>
        )}
        <p style={{ fontSize: 11.5, color: C.textFaint, margin: '8px 0 0' }}>{t.upHistoryNote}</p>
      </div>

      {confirming && (
        <ConfirmDialog
          title={t.upConfirmTitle}
          message={confirmMessage()}
          confirmLabel={t.upApply}
          variant={action === 'revoke' ? 'danger' : 'warning'}
          busy={busy}
          onConfirm={apply}
          onClose={() => setConfirming(false)}
        />
      )}
    </div>
  );
}

function HistoryRow({ entry: h, planName }: {
  entry: SubscriptionHistoryEntry;
  planName: (code: string | null) => string;
}) {
  const { t } = useApp();
  const planChanged = h.fromPlanCode !== h.toPlanCode;
  const expiry = (v: string | null) => (v ? formatDateVN(v) : t.upNoExpiry);
  return (
    <li style={{ ...panel, padding: '10px 12px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: C.ink750 }}>
          {t[`upHis${h.action}`]}
          {h.extendAmount != null && h.extendUnit && (
            <span style={{ color: C.primaryStrong }}> +{h.extendAmount} {t[`upUnit${h.extendUnit}`]}</span>
          )}
        </span>
        <span style={{ fontSize: 12, color: C.textMuted }}>{formatDateTimeVN(h.createdAt)}</span>
      </div>
      <div style={{ fontSize: 12.5, color: C.ink650, marginTop: 4 }}>
        {planChanged ? `${planName(h.fromPlanCode)} → ${planName(h.toPlanCode)}` : planName(h.toPlanCode)}
        {' · '}{t.upExpires}: {expiry(h.fromExpiresAt)} → {expiry(h.toExpiresAt)}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 6, fontSize: 12, color: C.textMuted }}>
        <span>{h.actorEmail ?? t.upSystem}</span>
        {h.category && <StatusBadge tone="neutral" label={t[`upCat${h.category}`]} />}
      </div>
      {h.reason && <div style={{ fontSize: 12.5, color: C.ink550, marginTop: 6, fontStyle: 'italic' }}>“{h.reason}”</div>}
    </li>
  );
}

function DurationFields({ amount, unit, error, onAmount, onUnit, label }: {
  amount: string;
  unit: DurationUnit;
  error?: string;
  onAmount: (v: string) => void;
  onUnit: (u: DurationUnit) => void;
  label: string;
}) {
  const { t } = useApp();
  return (
    <Field label={label} error={error}>
      <div style={{ display: 'flex', gap: 8 }}>
        <input type="number" inputMode="numeric" min={1} max={DURATION_MAX[unit]} value={amount}
          onChange={(e) => onAmount(e.target.value)} style={{ ...input, flex: '1 1 0' }} aria-label={t.upAmount} />
        <select value={unit} onChange={(e) => onUnit(e.target.value as DurationUnit)}
          style={{ ...input, flex: '1 1 0' }} aria-label={t.upUnit}>
          {UNITS.map((u) => <option key={u} value={u}>{t[`upUnit${u}`]}</option>)}
        </select>
      </div>
      <span style={{ fontSize: 11.5, color: C.textFaint }}>
        {fill(t.upMaxHint, { n: DURATION_MAX[unit], unit: t[`upUnit${unit}`] })}
      </span>
    </Field>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{ fontSize: 12, fontWeight: 700, color: C.textMuted, letterSpacing: 0.3, textTransform: 'uppercase' }}>{label}</span>
      {children}
      {error && <span style={{ fontSize: 12, fontWeight: 600, color: C.danger }}>{error}</span>}
    </div>
  );
}

function Fact({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div>
      <div style={{ fontSize: 11.5, fontWeight: 700, color: C.textFaint, letterSpacing: 0.3, textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontSize: 13.5, fontWeight: 600, color: C.ink750, marginTop: 2 }}>
        {value}{hint && <span style={{ fontWeight: 500, color: C.textMuted }}> · {hint}</span>}
      </div>
    </div>
  );
}

/* ---- style: khớp EditUserModal ---- */
const panel: CSSProperties = { background: C.surfaceSubtle, border: `1px solid ${C.surfaceMuted}`, borderRadius: 12, padding: '12px 14px' };
const sectionLabel: CSSProperties = { fontSize: 11.5, fontWeight: 700, color: C.textFaint, letterSpacing: 0.3, textTransform: 'uppercase' };
const input: CSSProperties = { width: '100%', height: 40, border: `1px solid ${C.border}`, borderRadius: 10, padding: '0 12px', fontSize: 13.5, color: C.textStrong, outline: 'none', background: C.surface };
const noteBox: CSSProperties = { background: C.surfaceMuted, border: `1px solid ${C.border}`, borderRadius: 10, padding: '11px 14px', fontSize: 13, color: C.textSecondary };
const warnBox: CSSProperties = { background: C.warningSoft, border: `1px solid ${C.legacyBorderf7dca6}`, borderRadius: 10, padding: '10px 14px', fontSize: 12.5, color: C.legacyText92400e, lineHeight: 1.5 };
const previewBox: CSSProperties = { fontSize: 13, color: C.ink750, background: C.border, border: `1px solid ${C.legacyBordere9dcff}`, borderRadius: 10, padding: '9px 12px' };
const outlineBtn: CSSProperties = { border: `1px solid ${C.border}`, background: C.surface, color: C.ink550, fontWeight: 700, fontSize: 12.5, borderRadius: 10, padding: '8px 14px', cursor: 'pointer' };
const pill = (active: boolean, danger: boolean): CSSProperties => ({
  border: `1px solid ${active ? (danger ? C.legacyBorderf5c2d3 : C.legacyBorderd9c8fb) : C.border}`,
  background: active ? (danger ? C.legacyBgfdeef3 : C.primarySoft) : C.surface,
  color: active ? (danger ? C.legacyTextbe185d : C.primaryStrong) : C.ink550,
  fontWeight: 700, fontSize: 12.5, borderRadius: 999, padding: '7px 14px', cursor: 'pointer',
});
const applyBtn = (disabled: boolean, danger: boolean): CSSProperties => ({
  border: 'none', borderRadius: 11, padding: '11px 0', fontSize: 14, fontWeight: 700, color: danger ? '#fff' : C.onBrand,
  background: danger ? '#d6336c' : 'var(--brand)',
  cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.6 : 1,
});
