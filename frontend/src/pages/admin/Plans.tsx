import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Link2, Pencil, Plus, Star, Trash2, Eye, EyeOff } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Card, Loader, Icon } from '../../components/ui';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import Modal from '../../components/Modal';
import ConfirmDialog from '../../components/brand/ConfirmDialog';
import StatusBadge from '../../components/admin/StatusBadge';
import SegmentedControl from '../../components/admin/SegmentedControl';
import PlanCard from '../../components/landing/PlanCard';
import PlanFormModal from '../../components/admin/plans/PlanFormModal';
import CompareCell from '../../components/plans/CompareCell';
import ComparisonTable from '../../components/plans/ComparisonTable';
import { formatVND } from '../../api/admin';
import {
  getAdminPlans, updatePlan, deletePlan,
  createFeature, updateFeature, deleteFeature,
  toPricingPlans, toComparisonGroups, featureCellValue,
  type PlansPayload, type PlanDto, type PlanFeatureDto, type PlanSaveInput,
  type FeatureSaveInput, type PlanFeatureValueDto,
} from '../../api/plans';
import { listPlatformAvailability } from '../../api/platformAvailability';
import { PLAN_LIMIT_FIELDS, type PlanLimitKey } from '../../api/planLimits';
import type { PlatformEnum } from '../../api/connections';
import type { Lang } from '../../types';
import { useToast } from '../../components/toast/ToastProvider';
import PageContainer from '../../components/PageContainer';
import { C } from '../../styles/colors';


// Trang admin "Quản lý gói" (3 tab): Gói dịch vụ / Bảng so sánh / Xem trước.
// Nguồn dữ liệu là bảng Plan trong DB (một nguồn với landing — sửa ở đây là landing đổi).
// Trang Doanh thu chỉ còn khối gói read-only và điều hướng sang đây qua sessionStorage intent.

type Tab = 'plans' | 'compare' | 'preview';

/** Intent từ trang Doanh thu: mở đúng modal khi vừa điều hướng sang. */
export const PLANS_INTENT_KEY = 'aima.plansIntent';
export type PlansIntent = { action: 'create' } | { action: 'edit'; id: string };

/** Ẩn/hiện gói: chỉ đổi isActive — giới hạn null = giữ nguyên nên không cần gửi lại. */
const toSaveInput = (p: PlanDto): PlanSaveInput => ({
  nameVi: p.nameVi, nameEn: p.nameEn, price: p.price,
  billingCycleVi: p.billingCycleVi, billingCycleEn: p.billingCycleEn,
  billingIntervalMonths: p.billingIntervalMonths,
  monthlyTokenLimit: null,
  featureLimits: null,
  descriptionVi: p.descriptionVi, descriptionEn: p.descriptionEn,
  featuresVi: p.featuresVi, featuresEn: p.featuresEn,
  teaserFeaturesVi: p.teaserFeaturesVi, teaserFeaturesEn: p.teaserFeaturesEn,
  ctaVi: p.ctaVi, ctaEn: p.ctaEn,
  highlight: p.highlight, displayOrder: p.displayOrder, isActive: p.isActive,
});

const fieldStyle = { width: '100%', minWidth: 0, boxSizing: 'border-box', border: `1px solid ${C.border}`, borderRadius: 10, padding: '9px 12px', fontSize: 13.5, color: C.textStrong, outline: 'none', background: C.surface } as const;
const labelStyle = { fontSize: 11.5, fontWeight: 700, letterSpacing: '.04em', color: C.textFaint, marginBottom: 5, display: 'block' } as const;
const hintStyle = { fontSize: 11, color: C.textFaint, marginTop: 3 } as const;

/** Nhãn ngắn của một giới hạn số trên thẻ gói: ∞ / Tắt / số. */
function shortLimit(v: number | null | undefined, offLabel: string): string {
  if (v === undefined) return '—';
  if (v == null || v === -1) return '∞';
  return v === 0 ? offLabel : v.toLocaleString('vi-VN');
}

export default function Plans() {
  const { t, lang, brandGradient } = useApp();
  const { isMobile } = useBreakpoint();
  const [load, setLoad] = useState<'loading' | 'error' | 'ok'>('loading');
  const [payload, setPayload] = useState<PlansPayload | null>(null);
  const [lockedPlatforms, setLockedPlatforms] = useState<PlatformEnum[]>([]);
  const [tab, setTab] = useState<Tab>('plans');
  const toast = useToast();

  // Modal state
  const [editingPlan, setEditingPlan] = useState<PlanDto | 'new' | null>(null);
  const [deletingPlan, setDeletingPlan] = useState<PlanDto | null>(null);
  const [hidingPlan, setHidingPlan] = useState<PlanDto | null>(null);
  const [editingFeature, setEditingFeature] = useState<PlanFeatureDto | 'new' | null>(null);
  const [deletingFeature, setDeletingFeature] = useState<PlanFeatureDto | null>(null);
  const [busy, setBusy] = useState(false);

  const fetchAll = useCallback(() => {
    setLoad('loading');
    // Trạng thái khoá nền tảng toàn hệ thống: ghi chú ở chip nền tảng + cảnh báo nội dung card nhắc nền tảng đang khoá.
    listPlatformAvailability()
      .then((rows) => setLockedPlatforms(rows.filter((r) => !r.connectionEnabled).map((r) => r.platform)))
      .catch(() => setLockedPlatforms([]));
    getAdminPlans()
      .then((p) => {
        setPayload(p);
        setLoad('ok');
        // Intent từ trang Doanh thu (Sửa gói / + Thêm gói) → mở đúng modal một lần.
        const raw = sessionStorage.getItem(PLANS_INTENT_KEY);
        if (raw) {
          sessionStorage.removeItem(PLANS_INTENT_KEY);
          try {
            const intent = JSON.parse(raw) as PlansIntent;
            if (intent.action === 'create') setEditingPlan('new');
            else {
              const found = p.plans.find((x) => x.id === intent.id);
              if (found) setEditingPlan(found);
            }
          } catch { /* intent hỏng → bỏ qua */ }
        }
      })
      .catch(() => setLoad('error'));
  }, []);
  useEffect(() => fetchAll(), [fetchAll]);

  const sortedPlans = payload ? [...payload.plans].sort((a, b) => a.displayOrder - b.displayOrder) : [];
  const sortedFeatures = payload ? [...payload.features].sort((a, b) => a.displayOrder - b.displayOrder) : [];

  const toggleActive = (p: PlanDto) => {
    setBusy(true);
    updatePlan(p.id, { ...toSaveInput(p), isActive: !p.isActive })
      .then(() => { fetchAll(); toast.success(t.plSaved); })
      .catch(() => toast.error(t.plSaveFail))
      .finally(() => { setBusy(false); setHidingPlan(null); });
  };

  const confirmDeletePlan = () => {
    if (!deletingPlan) return;
    setBusy(true);
    deletePlan(deletingPlan.id)
      .then(() => {
        setPayload((prev) => prev && ({ ...prev, plans: prev.plans.filter((x) => x.id !== deletingPlan.id) }));
        toast.success(t.plDeleted);
      })
      .catch(() => toast.error(t.plDeleteFail))
      .finally(() => { setBusy(false); setDeletingPlan(null); });
  };

  const confirmDeleteFeature = () => {
    if (!deletingFeature) return;
    setBusy(true);
    deleteFeature(deletingFeature.id)
      .then(() => {
        setPayload((prev) => prev && ({ ...prev, features: prev.features.filter((x) => x.id !== deletingFeature.id) }));
        toast.success(t.plDeleted);
      })
      .catch(() => toast.error(t.plDeleteFail))
      .finally(() => { setBusy(false); setDeletingFeature(null); });
  };

  if (load === 'loading') return <PageContainer><Card><Loader label={t.listLoading} /></Card></PageContainer>;
  if (load === 'error' || !payload) return (
    <PageContainer>
      <Card style={{ textAlign: 'center', padding: '54px 16px' }}>
        <div style={{ fontSize: 14.5, fontWeight: 600, color: C.ink550, marginBottom: 14 }}>{t.listError}</div>
        <button onClick={fetchAll} style={{ border: 'none', borderRadius: 10, padding: '9px 18px', fontWeight: 700, fontSize: 13, color: C.onBrand, background: brandGradient, cursor: 'pointer' }}>{t.retry}</button>
      </Card>
    </PageContainer>
  );

  const tabBtn = (key: Tab, label: string) => {
    const active = tab === key;
    return (
      <button key={key} onClick={() => setTab(key)} style={{ border: '1px solid', borderColor: active ? 'transparent' : C.border, background: active ? brandGradient : C.surface, color: active ? C.onBrand : C.ink550, borderRadius: 9, padding: '7px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>{label}</button>
    );
  };

  const limitOf = (p: PlanDto, key: PlanLimitKey) => {
    const f = PLAN_LIMIT_FIELDS.find((x) => x.key === key)!;
    return p.featureLimits ? (p.featureLimits as unknown as Record<string, number | null>)[f.field] : undefined;
  };

  // Bảng so sánh admin: colgroup + table-layout fixed — cột nhóm/tên rộng cố định, cột gói chia đều, cột hành động riêng.
  const planColWidth = 110;
  const unlinkedCount = sortedFeatures.filter((f) => !f.limitKey).length;

  return (
    <PageContainer>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: 8 }}>
          {tabBtn('plans', t.plTabPlans)}
          {tabBtn('compare', t.plTabCompare)}
          {tabBtn('preview', t.plTabPreview)}
        </div>
        {tab === 'plans' && (
          <button onClick={() => setEditingPlan('new')} style={{ display: 'flex', alignItems: 'center', gap: 6, border: 'none', borderRadius: 9, padding: '8px 14px', fontSize: 12.5, fontWeight: 700, color: C.onBrand, background: brandGradient, cursor: 'pointer' }}>
            <Plus size={15} strokeWidth={2.5} /> {t.plAddPlan}
          </button>
        )}
        {tab === 'compare' && (
          <button onClick={() => setEditingFeature('new')} style={{ display: 'flex', alignItems: 'center', gap: 6, border: 'none', borderRadius: 9, padding: '8px 14px', fontSize: 12.5, fontWeight: 700, color: C.onBrand, background: brandGradient, cursor: 'pointer' }}>
            <Plus size={15} strokeWidth={2.5} /> {t.plAddFeature}
          </button>
        )}
      </div>

      {tab === 'plans' && (
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill,minmax(300px,1fr))', gap: 18 }}>
          {sortedPlans.map((p) => (
            <Card key={p.id} style={{ display: 'flex', flexDirection: 'column', gap: 10, opacity: p.isActive ? 1 : 0.72 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontFamily: "'Plus Jakarta Sans'", fontWeight: 800, fontSize: 17, color: C.textStrong }}>{lang === 'en' ? p.nameEn : p.nameVi}</span>
                {p.highlight && <Star size={15} fill={C.strengthFair} color={C.strengthFair} />}
                <span style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '.08em', color: C.primaryStrong, background: C.primarySoft, border: `1px solid ${C.accentLine}`, borderRadius: 999, padding: '2px 8px' }} title={p.core ? t.plCore : undefined}>{p.code}</span>
                <span style={{ marginLeft: 'auto' }}>
                  <StatusBadge tone={p.isActive ? 'success' : 'neutral'} label={p.isActive ? t.plActiveOn : t.plActiveOff} />
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
                <span style={{ fontFamily: "'Plus Jakarta Sans'", fontWeight: 800, fontSize: 24, color: C.ink900 }}>{formatVND(p.price)}</span>
                <span style={{ fontSize: 12.5, fontWeight: 600, color: C.textMuted }}>{lang === 'en' ? p.billingCycleEn : p.billingCycleVi}</span>
              </div>
              <div style={{ fontSize: 12.5, color: C.textSecondary, lineHeight: 1.5, minHeight: 36 }}>{lang === 'en' ? p.descriptionEn : p.descriptionVi}</div>
              <div style={{ fontSize: 12, color: C.accentTextMuted }}>
                {t.plTokenLimit}: <b>{p.monthlyTokenLimit == null ? '∞' : p.monthlyTokenLimit.toLocaleString('vi-VN')}</b>
                <span style={{ margin: '0 8px', color: C.legacyTexte3ddf2 }}>|</span>
                {t.plfSubscribersShort}: <b>{p.subscriberCount ?? 0}</b>
                <span style={{ margin: '0 8px', color: C.legacyTexte3ddf2 }}>|</span>
                {t.plOrder}: <b>{p.displayOrder}</b>
              </div>
              <div style={{ fontSize: 12, color: C.accentTextMuted }}>
                {t.plAiCheckLimit}: <b>{shortLimit(limitOf(p, 'POLICY_CHECK_AI_PER_PERIOD'), t.plModeOff)}</b>
                <span style={{ margin: '0 8px', color: C.legacyTexte3ddf2 }}>|</span>
                {t.plAiFixLimit}: <b>{shortLimit(limitOf(p, 'AI_FIX_PER_VERSION'), t.plModeOff)}</b>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 'auto', paddingTop: 6 }}>
                <button onClick={() => setEditingPlan(p)} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, border: `1px solid ${C.border}`, background: C.surface, borderRadius: 9, padding: '7px 0', fontSize: 12.5, fontWeight: 700, color: C.ink550, cursor: 'pointer' }}>
                  <Icon icon={Pencil} size={14} stroke={C.violetLight} /> {t.plEditPlan}
                </button>
                {/* Icon theo TRẠNG THÁI (đang hiển thị = mắt mở), tooltip theo HÀNH ĐỘNG khi bấm */}
                <button
                  onClick={() => (p.isActive ? setHidingPlan(p) : toggleActive(p))}
                  disabled={busy}
                  title={p.isActive ? t.plHideAction : t.plShowAction}
                  aria-label={p.isActive ? t.plHideAction : t.plShowAction}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${C.border}`, background: C.surface, borderRadius: 9, padding: '7px 12px', cursor: 'pointer' }}
                >
                  <Icon icon={p.isActive ? Eye : EyeOff} size={15} stroke={C.textMuted} />
                </button>
                {!p.core && (
                  <button onClick={() => setDeletingPlan(p)} title={t.plDeleteAction} aria-label={t.plDeleteAction} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${C.legacyBorderfbdce7}`, background: C.surface, borderRadius: 9, padding: '7px 12px', cursor: 'pointer' }}>
                    <Icon icon={Trash2} size={15} stroke={C.legacyTexte25c84} />
                  </button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {tab === 'compare' && (
        <>
          {unlinkedCount > 0 && (
            <div role="note" style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '10px 14px', borderRadius: 12,
              background: C.amberSoft, color: C.amberText, fontSize: 12.5, lineHeight: 1.5 }}>
              <AlertTriangle size={15} strokeWidth={2.2} aria-hidden style={{ flex: 'none', marginTop: 2 }} />
              <span>{t.plCmpManualWarning.replace('{n}', String(unlinkedCount))}</span>
            </div>
          )}
          <Card style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
              <table style={{ width: '100%', minWidth: 420 + planColWidth * sortedPlans.length, borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                <colgroup>
                  <col style={{ width: 150 }} />
                  <col style={{ width: 230 }} />
                  {sortedPlans.map((p) => <col key={p.id} />)}
                  <col style={{ width: 96 }} />
                </colgroup>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${C.surfaceMuted}` }}>
                    <th style={{ padding: '13px 16px', textAlign: 'left', fontSize: 12.5, fontWeight: 700, color: C.textMuted }}>{t.plColGroup}</th>
                    <th style={{ padding: '13px 16px', textAlign: 'left', fontSize: 12.5, fontWeight: 700, color: C.textMuted }}>{t.plColFeature}</th>
                    {sortedPlans.map((p) => (
                      <th key={p.id} style={{ padding: '13px 8px', textAlign: 'center', verticalAlign: 'middle', fontSize: 12.5, fontWeight: 800, color: p.highlight ? C.primaryStrong : C.textStrong }}>{p.code}</th>
                    ))}
                    <th style={{ padding: '13px 16px' }} />
                  </tr>
                </thead>
                <tbody>
                  {sortedFeatures.length === 0 && (
                    <tr><td colSpan={sortedPlans.length + 3} style={{ padding: '30px 16px', textAlign: 'center', fontSize: 13, color: C.textMuted }}>{t.listEmpty}</td></tr>
                  )}
                  {sortedFeatures.map((f) => (
                    <tr key={f.id} style={{ borderTop: `1px solid ${C.bg}` }}>
                      <td style={{ padding: '11px 16px', fontSize: 12.5, fontWeight: 700, color: C.primary, overflowWrap: 'anywhere' }}>{lang === 'en' ? f.groupEn : f.groupVi}</td>
                      <td style={{ padding: '11px 16px', fontSize: 13, color: C.ink650, overflowWrap: 'anywhere' }}>
                        <div>{lang === 'en' ? f.nameEn : f.nameVi}</div>
                        <div style={{ marginTop: 4 }}>
                          {f.limitKey ? (
                            <span title={t.plCmpAutoTip} style={autoBadge}><Link2 size={11} strokeWidth={2.4} aria-hidden />{t.plCmpAuto}</span>
                          ) : (
                            <span title={t.plCmpManualTip} style={manualBadge}><AlertTriangle size={11} strokeWidth={2.4} aria-hidden />{t.plCmpManual}</span>
                          )}
                        </div>
                      </td>
                      {sortedPlans.map((p) => (
                        <td key={p.id} style={{ padding: '11px 8px', textAlign: 'center', verticalAlign: 'middle' }}>
                          <CompareCell compact value={f.limitKey || f.values.some((x) => x.planCode === p.code && (x.boolValue !== null || x.textVi || x.textEn))
                            ? featureCellValue(f, p.code, lang) : null} />
                        </td>
                      ))}
                      <td style={{ padding: '11px 12px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <button onClick={() => setEditingFeature(f)} title={t.plEditFeature} aria-label={t.plEditFeature} style={{ border: `1px solid ${C.border}`, background: C.surface, borderRadius: 8, padding: '5px 9px', cursor: 'pointer', marginRight: 6 }}>
                          <Icon icon={Pencil} size={13} stroke={C.violetLight} />
                        </button>
                        <button onClick={() => setDeletingFeature(f)} title={t.plDeleteRow} aria-label={t.plDeleteRow} style={{ border: `1px solid ${C.legacyBorderfbdce7}`, background: C.surface, borderRadius: 8, padding: '5px 9px', cursor: 'pointer' }}>
                          <Icon icon={Trash2} size={13} stroke={C.legacyTexte25c84} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}

      {tab === 'preview' && <PreviewTab payload={payload} />}

      {editingPlan && (
        <PlanFormModal
          plan={editingPlan === 'new' ? null : editingPlan}
          plans={sortedPlans}
          limitDefaults={payload?.limitDefaults}
          lockedPlatforms={lockedPlatforms}
          onClose={() => setEditingPlan(null)}
          onSaved={() => { setEditingPlan(null); toast.success(t.plSaved); fetchAll(); }}
        />
      )}
      {editingFeature && (
        <FeatureFormModal
          feature={editingFeature === 'new' ? null : editingFeature}
          plans={sortedPlans}
          onClose={() => setEditingFeature(null)}
          onSaved={() => { setEditingFeature(null); toast.success(t.plSaved); fetchAll(); }}
        />
      )}
      {deletingPlan && (
        <ConfirmDialog title={`${t.plEditPlan}: ${deletingPlan.nameVi}`} message={t.plDeletePlanMsg} confirmLabel={t.plDeleted} busy={busy} onConfirm={confirmDeletePlan} onClose={() => setDeletingPlan(null)} />
      )}
      {hidingPlan && (
        <ConfirmDialog variant="warning" title={hidingPlan.nameVi} message={t.plHideConfirm} confirmLabel={t.plHideAction} busy={busy} onConfirm={() => toggleActive(hidingPlan)} onClose={() => setHidingPlan(null)} />
      )}
      {deletingFeature && (
        <ConfirmDialog title={deletingFeature.nameVi} message={t.plDeleteFeatureMsg} confirmLabel={t.plDeleted} busy={busy} onConfirm={confirmDeleteFeature} onClose={() => setDeletingFeature(null)} />
      )}
    </PageContainer>
  );
}

const autoBadge = {
  display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10.5, fontWeight: 800, color: C.primaryStrong,
  background: C.primarySoft, border: `1px solid ${C.accentLine}`, borderRadius: 999, padding: '1px 7px',
} as const;
const manualBadge = {
  display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10.5, fontWeight: 700, color: C.amberText,
  background: C.amberSoft, borderRadius: 999, padding: '1px 7px',
} as const;

// ===== Tab Xem trước: render đúng UI landing (card + bảng so sánh — CÙNG component với /pricing), chỉ gói đang bật =====
function PreviewTab({ payload }: { payload: PlansPayload }) {
  const { t, lang, brandGradient } = useApp();
  const { isMobile, isTablet } = useBreakpoint();
  const [previewLang, setPreviewLang] = useState<Lang>(lang);

  const activePayload: PlansPayload = {
    plans: payload.plans.filter((p) => p.isActive).sort((a, b) => a.displayOrder - b.displayOrder),
    features: [...payload.features].sort((a, b) => a.displayOrder - b.displayOrder),
  };
  const plans = toPricingPlans(activePayload, previewLang);
  const groups = toComparisonGroups(activePayload, previewLang);

  // Đồng bộ layout với landing: desktop ≤3 gói giữ kích cỡ card như cũ (3 cột), ≥4 gói
  // chuyển 4 cột; tablet 2, mobile 1. Flex-wrap + justify center để hàng cuối thiếu card
  // tự căn giữa, bề rộng card cố định theo cột.
  const cols = isMobile ? 1 : isTablet ? 2 : plans.length <= 3 ? 3 : 4;
  const gap = 20;
  const cardWidth = `calc((100% - ${(cols - 1) * gap}px) / ${cols})`;

  const langBtn = (l: Lang) => (
    <button key={l} onClick={() => setPreviewLang(l)} style={{ border: '1px solid', borderColor: previewLang === l ? 'transparent' : C.border, background: previewLang === l ? brandGradient : C.surface, color: previewLang === l ? C.onBrand : C.ink550, borderRadius: 8, padding: '5px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>{l.toUpperCase()}</button>
  );

  if (plans.length === 0) {
    return <Card style={{ textAlign: 'center', padding: '44px 16px', fontSize: 13.5, color: C.textMuted }}>{t.plPreviewEmpty}</Card>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ fontSize: 12.5, color: C.textMuted, flex: 1 }}>{t.plPreviewNote}</div>
        <div style={{ display: 'flex', gap: 6 }}>{langBtn('vi')}{langBtn('en')}</div>
      </div>

      {/* pointerEvents none: preview thuần hiển thị — CTA trên card không điều hướng */}
      <div style={{ pointerEvents: 'none', display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap, alignItems: 'stretch', paddingTop: 16 }}>
        {plans.map((p) => (
          <div key={p.id} style={{ display: 'flex', flex: '0 0 auto', width: cardWidth }}>
            <PlanCard plan={p} stacked={isMobile || isTablet} popularLabel={t.prPopular} />
          </div>
        ))}
      </div>

      <ComparisonTable plans={plans} groups={groups} />
    </div>
  );
}

// ===== Modal Sửa/Tạo dòng bảng so sánh =====
type CellDraft = { type: 'tick' | 'text'; tick: boolean; textVi: string; textEn: string };

function FeatureFormModal({ feature, plans, onClose, onSaved }: {
  feature: PlanFeatureDto | null;
  plans: PlanDto[];
  onClose: () => void;
  onSaved: (saved: PlanFeatureDto, isNew: boolean) => void;
}) {
  const { t, lang, brandGradient } = useApp();
  const dict = t as unknown as Record<string, string>;
  const toast = useToast();
  const isNew = !feature;
  const [busy, setBusy] = useState(false);

  const [groupVi, setGroupVi] = useState(feature?.groupVi ?? '');
  const [groupEn, setGroupEn] = useState(feature?.groupEn ?? '');
  const [nameVi, setNameVi] = useState(feature?.nameVi ?? '');
  const [nameEn, setNameEn] = useState(feature?.nameEn ?? '');
  const [order, setOrder] = useState(String(feature?.displayOrder ?? 0));
  // Liên kết giới hạn thật: giá trị cột tự động, không nhập tay (ô nhập tay cũ được giữ nếu gỡ liên kết).
  const [limitKey, setLimitKey] = useState<PlanLimitKey | ''>(feature?.limitKey ?? '');
  const [cells, setCells] = useState<Record<string, CellDraft>>(() => {
    const init: Record<string, CellDraft> = {};
    for (const p of plans) {
      const v = feature?.values.find((x) => x.planCode === p.code);
      init[p.code] = v && v.boolValue !== null && v.boolValue !== undefined
        ? { type: 'tick', tick: v.boolValue, textVi: '', textEn: '' }
        : { type: v && (v.textVi || v.textEn) ? 'text' : 'tick', tick: false, textVi: v?.textVi ?? '', textEn: v?.textEn ?? '' };
    }
    return init;
  });

  const setCell = (code: string, patch: Partial<CellDraft>) =>
    setCells((prev) => ({ ...prev, [code]: { ...prev[code], ...patch } }));

  const canSave = !!nameVi.trim() && !!nameEn.trim();

  const submit = () => {
    if (!canSave || busy) return;
    setBusy(true);
    const values: PlanFeatureValueDto[] = plans.map((p) => {
      const c = cells[p.code];
      return c.type === 'tick'
        ? { planCode: p.code, boolValue: c.tick, textVi: null, textEn: null }
        : { planCode: p.code, boolValue: null, textVi: c.textVi.trim() || null, textEn: c.textEn.trim() || null };
    });
    const input: FeatureSaveInput = {
      groupVi: groupVi.trim() || null, groupEn: groupEn.trim() || null,
      nameVi: nameVi.trim(), nameEn: nameEn.trim(),
      displayOrder: Number(order) || 0,
      values,
      limitKey: limitKey || null,
    };
    const req = isNew
      ? createFeature(input).then((saved) => onSaved(saved, true))
      : updateFeature(feature.id, input).then((saved) => onSaved(saved, false));
    req.catch(() => toast.error(t.plSaveFail)).finally(() => setBusy(false));
  };

  const two = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 240px), 1fr))', gap: 10, marginBottom: 12 } as const;

  return (
    <Modal title={isNew ? t.plAddFeature : `${t.plEditFeature}: ${feature.nameVi}`} onClose={onClose} maxWidth={680}>
      <div style={two}>
        <div>
          <label style={labelStyle}>{t.plGroupVi}</label>
          <input value={groupVi} onChange={(e) => setGroupVi(e.target.value)} style={fieldStyle} placeholder="Nội dung & AI" />
          <div style={hintStyle}>{t.plGroupHint}</div>
        </div>
        <div><label style={labelStyle}>{t.plGroupEn}</label><input value={groupEn} onChange={(e) => setGroupEn(e.target.value)} style={fieldStyle} placeholder="Content & AI" /></div>
      </div>
      <div style={two}>
        <div><label style={labelStyle}>{t.plFeatNameVi}</label><input value={nameVi} onChange={(e) => setNameVi(e.target.value)} style={fieldStyle} /></div>
        <div><label style={labelStyle}>{t.plFeatNameEn}</label><input value={nameEn} onChange={(e) => setNameEn(e.target.value)} style={fieldStyle} /></div>
      </div>
      <div style={two}>
        <div>
          <label style={labelStyle}>{t.plOrder}</label>
          <input value={order} onChange={(e) => setOrder(e.target.value.replace(/[^\d]/g, ''))} inputMode="numeric" style={fieldStyle} />
        </div>
        <div>
          <label style={labelStyle}>{t.plCmpLinkLabel}</label>
          <select value={limitKey} onChange={(e) => setLimitKey(e.target.value as PlanLimitKey | '')} style={{ ...fieldStyle, cursor: 'pointer' }}>
            <option value="">{t.plCmpLinkNone}</option>
            {PLAN_LIMIT_FIELDS.map((f) => <option key={f.key} value={f.key}>{dict[`plk_${f.key}`] ?? f.key}</option>)}
          </select>
          <div style={hintStyle}>{limitKey ? t.plCmpAutoTip : t.plCmpManualTip}</div>
        </div>
      </div>

      <div style={{ ...labelStyle, marginBottom: 8 }}>{t.plValuesTitle}</div>
      {limitKey ? (
        // Dòng liên kết: xem giá trị tự động lấy từ giới hạn thật của từng gói (đọc theo DB sau khi lưu).
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
          {plans.map((p) => (
            <div key={p.code} style={{ display: 'flex', alignItems: 'center', gap: 10, border: `1px solid ${C.surfaceMuted}`, borderRadius: 12, padding: '9px 12px' }}>
              <span style={{ fontSize: 12, fontWeight: 800, color: C.primaryStrong, minWidth: 60 }}>{p.code}</span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <CompareCell compact value={feature?.limitKey === limitKey ? featureCellValue(feature, p.code, lang) : t.plCmpAutoAfterSave} />
              </span>
              <span style={autoBadge}><Link2 size={11} strokeWidth={2.4} aria-hidden />{t.plCmpAuto}</span>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
          {plans.map((p) => {
            const c = cells[p.code];
            return (
              <div key={p.code} style={{ border: `1px solid ${C.surfaceMuted}`, borderRadius: 12, padding: '10px 12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 12, fontWeight: 800, color: C.primaryStrong }}>{p.code}</span>
                  <span style={{ fontSize: 11.5, color: C.textFaint }}>{p.nameVi}</span>
                  <span style={{ marginLeft: 'auto' }}>
                    <SegmentedControl size="sm" ariaLabel={`${p.code} — ${t.plValuesTitle}`} value={c.type}
                      options={[{ value: 'tick', label: t.plTypeTick }, { value: 'text', label: t.plTypeText }]}
                      onChange={(v) => setCell(p.code, { type: v })} />
                  </span>
                </div>
                {c.type === 'tick' ? (
                  <SegmentedControl size="sm" ariaLabel={`${p.code} ✓`} value={c.tick ? 'yes' : 'no'}
                    options={[{ value: 'yes', label: t.plTickYes }, { value: 'no', label: t.plTickNo }]}
                    onChange={(v) => setCell(p.code, { tick: v === 'yes' })} />
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 200px), 1fr))', gap: 8 }}>
                    <input value={c.textVi} onChange={(e) => setCell(p.code, { textVi: e.target.value })} style={fieldStyle} placeholder={t.plTextViPh} />
                    <input value={c.textEn} onChange={(e) => setCell(p.code, { textEn: e.target.value })} style={fieldStyle} placeholder={t.plTextEnPh} />
                  </div>
                )}
              </div>
            );
          })}
          <div role="note" style={{ display: 'flex', alignItems: 'flex-start', gap: 6, fontSize: 12, color: C.amberText, lineHeight: 1.45 }}>
            <AlertTriangle size={13} strokeWidth={2.2} aria-hidden style={{ flex: 'none', marginTop: 2 }} />{t.plCmpManualTip}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 10 }}>
        <button onClick={onClose} style={{ flex: 1, border: `1px solid ${C.border}`, background: C.surface, borderRadius: 10, padding: '10px 0', fontSize: 14, fontWeight: 700, color: C.ink550, cursor: 'pointer' }}>{t.cancel}</button>
        <button onClick={submit} disabled={!canSave || busy} style={{ flex: 1, border: 'none', borderRadius: 10, padding: '10px 0', fontSize: 14, fontWeight: 700, color: C.onBrand, background: brandGradient, cursor: canSave && !busy ? 'pointer' : 'default', opacity: canSave && !busy ? 1 : 0.6 }}>{t.save}</button>
      </div>
    </Modal>
  );
}
