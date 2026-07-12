import { Fragment, useCallback, useEffect, useState } from 'react';
import { Check, Pencil, Plus, Star, Trash2, Eye, EyeOff } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Card, Loader, Icon } from '../../components/ui';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import Modal from '../../components/Modal';
import ConfirmDialog from '../../components/brand/ConfirmDialog';
import StatusBadge from '../../components/admin/StatusBadge';
import PlanCard from '../../components/landing/PlanCard';
import { formatVND } from '../../api/admin';
import {
  getAdminPlans, createPlan, updatePlan, deletePlan,
  createFeature, updateFeature, deleteFeature,
  toPricingPlans, toComparisonGroups,
  type PlansPayload, type PlanDto, type PlanFeatureDto, type PlanSaveInput,
  type FeatureSaveInput, type PlanFeatureValueDto,
} from '../../api/plans';
import type { ApiError } from '../../api/apiClient';
import type { Lang } from '../../types';

// Trang admin "Quản lý gói" (3 tab): Gói dịch vụ / Bảng so sánh / Xem trước.
// Nguồn dữ liệu là bảng Plan trong DB (một nguồn với landing — sửa ở đây là landing đổi).
// Trang Doanh thu chỉ còn khối gói read-only và điều hướng sang đây qua sessionStorage intent.

type Tab = 'plans' | 'compare' | 'preview';

/** Intent từ trang Doanh thu: mở đúng modal khi vừa điều hướng sang. */
export const PLANS_INTENT_KEY = 'aima.plansIntent';
export type PlansIntent = { action: 'create' } | { action: 'edit'; id: string };

const ERR_PLAN_CODE_EXISTED = 1982;

const toSaveInput = (p: PlanDto): PlanSaveInput => ({
  nameVi: p.nameVi, nameEn: p.nameEn, price: p.price,
  billingCycleVi: p.billingCycleVi, billingCycleEn: p.billingCycleEn,
  tokenQuota: p.tokenQuota, descriptionVi: p.descriptionVi, descriptionEn: p.descriptionEn,
  featuresVi: p.featuresVi, featuresEn: p.featuresEn,
  teaserFeaturesVi: p.teaserFeaturesVi, teaserFeaturesEn: p.teaserFeaturesEn,
  ctaVi: p.ctaVi, ctaEn: p.ctaEn,
  highlight: p.highlight, displayOrder: p.displayOrder, isActive: p.isActive,
});

const fieldStyle = { width: '100%', border: '1px solid #ece8f6', borderRadius: 10, padding: '9px 12px', fontSize: 13.5, color: '#241f3a', outline: 'none', background: '#fff' } as const;
const labelStyle = { fontSize: 11.5, fontWeight: 700, letterSpacing: '.04em', color: '#a59fbb', marginBottom: 5, display: 'block' } as const;
const hintStyle = { fontSize: 11, color: '#a59fbb', marginTop: 3 } as const;

export default function Plans() {
  const { t, lang, brandGradient } = useApp();
  const { isMobile } = useBreakpoint();
  const [load, setLoad] = useState<'loading' | 'error' | 'ok'>('loading');
  const [payload, setPayload] = useState<PlansPayload | null>(null);
  const [tab, setTab] = useState<Tab>('plans');
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const showToast = useCallback((type: 'success' | 'error', msg: string) => setToast({ type, msg }), []);

  // Modal state
  const [editingPlan, setEditingPlan] = useState<PlanDto | 'new' | null>(null);
  const [deletingPlan, setDeletingPlan] = useState<PlanDto | null>(null);
  const [hidingPlan, setHidingPlan] = useState<PlanDto | null>(null);
  const [editingFeature, setEditingFeature] = useState<PlanFeatureDto | 'new' | null>(null);
  const [deletingFeature, setDeletingFeature] = useState<PlanFeatureDto | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(timer);
  }, [toast]);

  const fetchAll = useCallback(() => {
    setLoad('loading');
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

  const replacePlan = (saved: PlanDto, isNew: boolean) =>
    setPayload((prev) => prev && ({
      ...prev,
      plans: isNew ? [...prev.plans, saved] : prev.plans.map((x) => (x.id === saved.id ? saved : x)),
    }));

  const replaceFeature = (saved: PlanFeatureDto, isNew: boolean) =>
    setPayload((prev) => prev && ({
      ...prev,
      features: isNew ? [...prev.features, saved] : prev.features.map((x) => (x.id === saved.id ? saved : x)),
    }));

  const toggleActive = (p: PlanDto) => {
    setBusy(true);
    updatePlan(p.id, { ...toSaveInput(p), isActive: !p.isActive })
      .then((saved) => { replacePlan(saved, false); showToast('success', t.plSaved); })
      .catch(() => showToast('error', t.plSaveFail))
      .finally(() => { setBusy(false); setHidingPlan(null); });
  };

  const confirmDeletePlan = () => {
    if (!deletingPlan) return;
    setBusy(true);
    deletePlan(deletingPlan.id)
      .then(() => {
        setPayload((prev) => prev && ({ ...prev, plans: prev.plans.filter((x) => x.id !== deletingPlan.id) }));
        showToast('success', t.plDeleted);
      })
      .catch(() => showToast('error', t.plDeleteFail))
      .finally(() => { setBusy(false); setDeletingPlan(null); });
  };

  const confirmDeleteFeature = () => {
    if (!deletingFeature) return;
    setBusy(true);
    deleteFeature(deletingFeature.id)
      .then(() => {
        setPayload((prev) => prev && ({ ...prev, features: prev.features.filter((x) => x.id !== deletingFeature.id) }));
        showToast('success', t.plDeleted);
      })
      .catch(() => showToast('error', t.plDeleteFail))
      .finally(() => { setBusy(false); setDeletingFeature(null); });
  };

  if (load === 'loading') return <div className="view-pop" style={{ maxWidth: 1180, margin: '0 auto' }}><Card><Loader label={t.listLoading} /></Card></div>;
  if (load === 'error' || !payload) return (
    <div className="view-pop" style={{ maxWidth: 1180, margin: '0 auto' }}>
      <Card style={{ textAlign: 'center', padding: '54px 16px' }}>
        <div style={{ fontSize: 14.5, fontWeight: 600, color: '#5b5670', marginBottom: 14 }}>{t.listError}</div>
        <button onClick={fetchAll} style={{ border: 'none', borderRadius: 10, padding: '9px 18px', fontWeight: 700, fontSize: 13, color: '#fff', background: brandGradient, cursor: 'pointer' }}>{t.retry}</button>
      </Card>
    </div>
  );

  const tabBtn = (key: Tab, label: string) => {
    const active = tab === key;
    return (
      <button key={key} onClick={() => setTab(key)} style={{ border: '1px solid', borderColor: active ? 'transparent' : '#ece8f6', background: active ? brandGradient : '#fff', color: active ? '#fff' : '#5b5670', borderRadius: 9, padding: '7px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>{label}</button>
    );
  };

  return (
    <div className="view-pop" style={{ maxWidth: 1180, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
      {toast && (
        <div className="view-pop" style={{ padding: '10px 16px', borderRadius: 10, fontSize: 13.5, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8, background: toast.type === 'success' ? '#dcfce7' : '#fee2e2', color: toast.type === 'success' ? '#16a34a' : '#dc2626', border: `1px solid ${toast.type === 'success' ? '#bbf7d0' : '#fecaca'}` }}>
          <span style={{ fontSize: 15 }}>{toast.type === 'success' ? '✓' : '✕'}</span>
          <span style={{ flex: 1 }}>{toast.msg}</span>
          <button onClick={() => setToast(null)} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 16, color: 'inherit', padding: 0 }}>×</button>
        </div>
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: 8 }}>
          {tabBtn('plans', t.plTabPlans)}
          {tabBtn('compare', t.plTabCompare)}
          {tabBtn('preview', t.plTabPreview)}
        </div>
        {tab === 'plans' && (
          <button onClick={() => setEditingPlan('new')} style={{ display: 'flex', alignItems: 'center', gap: 6, border: 'none', borderRadius: 9, padding: '8px 14px', fontSize: 12.5, fontWeight: 700, color: '#fff', background: brandGradient, cursor: 'pointer' }}>
            <Plus size={15} strokeWidth={2.5} /> {t.plAddPlan}
          </button>
        )}
        {tab === 'compare' && (
          <button onClick={() => setEditingFeature('new')} style={{ display: 'flex', alignItems: 'center', gap: 6, border: 'none', borderRadius: 9, padding: '8px 14px', fontSize: 12.5, fontWeight: 700, color: '#fff', background: brandGradient, cursor: 'pointer' }}>
            <Plus size={15} strokeWidth={2.5} /> {t.plAddFeature}
          </button>
        )}
      </div>

      {tab === 'plans' && (
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill,minmax(300px,1fr))', gap: 18 }}>
          {sortedPlans.map((p) => (
            <Card key={p.id} style={{ display: 'flex', flexDirection: 'column', gap: 10, opacity: p.isActive ? 1 : 0.72 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontFamily: "'Plus Jakarta Sans'", fontWeight: 800, fontSize: 17, color: '#211c38' }}>{lang === 'en' ? p.nameEn : p.nameVi}</span>
                {p.highlight && <Star size={15} fill="#f59e0b" color="#f59e0b" />}
                <span style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '.08em', color: '#6d28d9', background: '#f3edff', border: '1px solid #e7d9fb', borderRadius: 999, padding: '2px 8px' }} title={p.core ? t.plCore : undefined}>{p.code}</span>
                <span style={{ marginLeft: 'auto' }}>
                  <StatusBadge tone={p.isActive ? 'success' : 'neutral'} label={p.isActive ? t.plActiveOn : t.plActiveOff} />
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
                <span style={{ fontFamily: "'Plus Jakarta Sans'", fontWeight: 800, fontSize: 24, color: '#171327' }}>{formatVND(p.price)}</span>
                <span style={{ fontSize: 12.5, fontWeight: 600, color: '#8a85a0' }}>{lang === 'en' ? p.billingCycleEn : p.billingCycleVi}</span>
              </div>
              <div style={{ fontSize: 12.5, color: '#6b6680', lineHeight: 1.5, minHeight: 36 }}>{lang === 'en' ? p.descriptionEn : p.descriptionVi}</div>
              <div style={{ fontSize: 12, color: '#7d6aa3' }}>
                {t.plTokenQuota}: <b>{p.tokenQuota === null ? '∞' : p.tokenQuota.toLocaleString('vi-VN')}</b>
                <span style={{ margin: '0 8px', color: '#e3ddf2' }}>|</span>
                {t.plOrder}: <b>{p.displayOrder}</b>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 'auto', paddingTop: 6 }}>
                <button onClick={() => setEditingPlan(p)} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, border: '1px solid #ece8f6', background: '#fff', borderRadius: 9, padding: '7px 0', fontSize: 12.5, fontWeight: 700, color: '#5b5670', cursor: 'pointer' }}>
                  <Icon icon={Pencil} size={14} stroke="#8b5cf6" /> {t.plEditPlan}
                </button>
                {/* Icon theo TRẠNG THÁI (đang hiển thị = mắt mở), tooltip theo HÀNH ĐỘNG khi bấm */}
                <button
                  onClick={() => (p.isActive ? setHidingPlan(p) : toggleActive(p))}
                  disabled={busy}
                  title={p.isActive ? t.plHideAction : t.plShowAction}
                  aria-label={p.isActive ? t.plHideAction : t.plShowAction}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #ece8f6', background: '#fff', borderRadius: 9, padding: '7px 12px', cursor: 'pointer' }}
                >
                  <Icon icon={p.isActive ? Eye : EyeOff} size={15} stroke="#8a85a0" />
                </button>
                {!p.core && (
                  <button onClick={() => setDeletingPlan(p)} title={t.plDeleteAction} aria-label={t.plDeleteAction} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #fbdce7', background: '#fff', borderRadius: 9, padding: '7px 12px', cursor: 'pointer' }}>
                    <Icon icon={Trash2} size={15} stroke="#e25c84" />
                  </button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {tab === 'compare' && (
        <Card style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
            <table style={{ width: '100%', minWidth: 640, borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #f0ecf8' }}>
                  <th style={{ padding: '13px 16px', textAlign: 'left', fontSize: 12.5, fontWeight: 700, color: '#8a85a0' }}>{t.plColGroup}</th>
                  <th style={{ padding: '13px 16px', textAlign: 'left', fontSize: 12.5, fontWeight: 700, color: '#8a85a0' }}>{t.plColFeature}</th>
                  {sortedPlans.map((p) => (
                    <th key={p.id} style={{ padding: '13px 12px', textAlign: 'center', fontSize: 12.5, fontWeight: 800, color: p.highlight ? '#6d28d9' : '#211c38', minWidth: 90 }}>{p.code}</th>
                  ))}
                  <th style={{ padding: '13px 16px' }} />
                </tr>
              </thead>
              <tbody>
                {sortedFeatures.length === 0 && (
                  <tr><td colSpan={sortedPlans.length + 3} style={{ padding: '30px 16px', textAlign: 'center', fontSize: 13, color: '#8a85a0' }}>{t.listEmpty}</td></tr>
                )}
                {sortedFeatures.map((f) => (
                  <tr key={f.id} style={{ borderTop: '1px solid #f6f3fb' }}>
                    <td style={{ padding: '11px 16px', fontSize: 12.5, fontWeight: 700, color: '#7c3aed', whiteSpace: 'nowrap' }}>{lang === 'en' ? f.groupEn : f.groupVi}</td>
                    <td style={{ padding: '11px 16px', fontSize: 13, color: '#4b4660' }}>{lang === 'en' ? f.nameEn : f.nameVi}</td>
                    {sortedPlans.map((p) => {
                      const v = f.values.find((x) => x.planCode === p.code);
                      return (
                        <td key={p.id} style={{ padding: '11px 12px', textAlign: 'center' }}>
                          {!v || (v.boolValue === null && !v.textVi && !v.textEn) ? <span style={{ color: '#c9c2dd' }}>·</span>
                            : v.boolValue === true ? <Check size={15} strokeWidth={3} color="#7c3aed" style={{ verticalAlign: 'middle' }} />
                            : v.boolValue === false ? <span style={{ color: '#c9c2dd', fontWeight: 600 }}>—</span>
                            : <span style={{ fontSize: 12.5, fontWeight: 600, color: '#4b4660' }}>{lang === 'en' ? v.textEn || v.textVi : v.textVi || v.textEn}</span>}
                        </td>
                      );
                    })}
                    <td style={{ padding: '11px 16px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <button onClick={() => setEditingFeature(f)} title={t.plEditFeature} style={{ border: '1px solid #ece8f6', background: '#fff', borderRadius: 8, padding: '5px 9px', cursor: 'pointer', marginRight: 6 }}>
                        <Icon icon={Pencil} size={13} stroke="#8b5cf6" />
                      </button>
                      <button onClick={() => setDeletingFeature(f)} title={t.plDeleteRow} aria-label={t.plDeleteRow} style={{ border: '1px solid #fbdce7', background: '#fff', borderRadius: 8, padding: '5px 9px', cursor: 'pointer' }}>
                        <Icon icon={Trash2} size={13} stroke="#e25c84" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {tab === 'preview' && <PreviewTab payload={payload} />}

      {editingPlan && (
        <PlanFormModal
          plan={editingPlan === 'new' ? null : editingPlan}
          onClose={() => setEditingPlan(null)}
          onSaved={(saved, isNew) => { replacePlan(saved, isNew); setEditingPlan(null); showToast('success', t.plSaved); }}
          onToast={showToast}
        />
      )}
      {editingFeature && (
        <FeatureFormModal
          feature={editingFeature === 'new' ? null : editingFeature}
          plans={sortedPlans}
          onClose={() => setEditingFeature(null)}
          onSaved={(saved, isNew) => { replaceFeature(saved, isNew); setEditingFeature(null); showToast('success', t.plSaved); }}
          onToast={showToast}
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
    </div>
  );
}

// ===== Tab Xem trước: render đúng UI landing (card + bảng so sánh), chỉ gói đang bật =====
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
    <button key={l} onClick={() => setPreviewLang(l)} style={{ border: '1px solid', borderColor: previewLang === l ? 'transparent' : '#ece8f6', background: previewLang === l ? brandGradient : '#fff', color: previewLang === l ? '#fff' : '#5b5670', borderRadius: 8, padding: '5px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>{l.toUpperCase()}</button>
  );

  if (plans.length === 0) {
    return <Card style={{ textAlign: 'center', padding: '44px 16px', fontSize: 13.5, color: '#8a85a0' }}>{t.plPreviewEmpty}</Card>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ fontSize: 12.5, color: '#8a85a0', flex: 1 }}>{t.plPreviewNote}</div>
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

      <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', background: '#fff', border: '1px solid #efeaf8', borderRadius: 20, boxShadow: '0 22px 44px -34px rgba(80,40,140,.5)' }}>
        <table style={{ width: '100%', minWidth: 640, borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ padding: '14px 18px', textAlign: 'left', fontSize: 13, fontWeight: 700, color: '#8a85a0', borderBottom: '1px solid #f0ecf8' }}>{t.ppColFeature}</th>
              {plans.map((p) => (
                <th key={p.id} style={{ padding: '14px 18px', textAlign: 'center', borderBottom: '1px solid #f0ecf8', minWidth: 130 }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontFamily: "'Plus Jakarta Sans'", fontWeight: 800, fontSize: 15, color: p.featured ? '#6d28d9' : '#211c38' }}>
                    {p.name}
                    {p.featured && <span style={{ fontSize: 10.5, fontWeight: 700, color: '#6d28d9', background: '#f3edff', border: '1px solid #e7d9fb', borderRadius: 999, padding: '2px 8px', whiteSpace: 'nowrap' }}>★ {t.prPopular}</span>}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {groups.map((g) => (
              <Fragment key={g.title}>
                {g.title && (
                  <tr>
                    <td colSpan={plans.length + 1} style={{ padding: '18px 18px 8px', fontFamily: "'Plus Jakarta Sans'", fontWeight: 700, fontSize: 13.5, color: '#7c3aed' }}>{g.title}</td>
                  </tr>
                )}
                {g.rows.map((row) => (
                  <tr key={row.label} style={{ borderBottom: '1px solid #f6f3fb' }}>
                    <td style={{ padding: '14px 18px', fontSize: 13.5, color: '#4b4660' }}>{row.label}</td>
                    {row.values.map((v, i) => (
                      <td key={i} style={{ padding: '14px 18px', textAlign: 'center', background: plans[i]?.featured ? 'rgba(124,58,237,.035)' : undefined }}>
                        {v === true ? (
                          <span style={{ display: 'inline-flex', width: 22, height: 22, borderRadius: '50%', background: '#f3edff', alignItems: 'center', justifyContent: 'center' }}>
                            <Check size={13} strokeWidth={3} color="#7c3aed" />
                          </span>
                        ) : v === false ? <span style={{ color: '#c9c2dd', fontWeight: 600 }}>—</span>
                          : <span style={{ fontSize: 13.5, fontWeight: 600, color: '#4b4660' }}>{v}</span>}
                      </td>
                    ))}
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ===== Modal Sửa/Tạo gói =====
type PlanFormSection = 'basic' | 'content' | 'features' | 'display';

function PlanFormModal({ plan, onClose, onSaved, onToast }: {
  plan: PlanDto | null;
  onClose: () => void;
  onSaved: (saved: PlanDto, isNew: boolean) => void;
  onToast: (type: 'success' | 'error', msg: string) => void;
}) {
  const { t, brandGradient } = useApp();
  const isNew = !plan;
  const [busy, setBusy] = useState(false);
  const [section, setSection] = useState<PlanFormSection>('basic');

  const [code, setCode] = useState(plan?.code ?? '');
  const [nameVi, setNameVi] = useState(plan?.nameVi ?? '');
  const [nameEn, setNameEn] = useState(plan?.nameEn ?? '');
  const [price, setPrice] = useState(String(plan?.price ?? 0));
  const [cycleVi, setCycleVi] = useState(plan?.billingCycleVi ?? '/tháng');
  const [cycleEn, setCycleEn] = useState(plan?.billingCycleEn ?? '/month');
  const [tokenQuota, setTokenQuota] = useState(plan?.tokenQuota === null || plan?.tokenQuota === undefined ? '' : String(plan.tokenQuota));
  const [descVi, setDescVi] = useState(plan?.descriptionVi ?? '');
  const [descEn, setDescEn] = useState(plan?.descriptionEn ?? '');
  const [featuresVi, setFeaturesVi] = useState((plan?.featuresVi ?? []).join('\n'));
  const [featuresEn, setFeaturesEn] = useState((plan?.featuresEn ?? []).join('\n'));
  const [teaserVi, setTeaserVi] = useState((plan?.teaserFeaturesVi ?? []).join('\n'));
  const [teaserEn, setTeaserEn] = useState((plan?.teaserFeaturesEn ?? []).join('\n'));
  const [ctaVi, setCtaVi] = useState(plan?.ctaVi ?? '');
  const [ctaEn, setCtaEn] = useState(plan?.ctaEn ?? '');
  const [highlight, setHighlight] = useState(plan?.highlight ?? false);
  const [order, setOrder] = useState(String(plan?.displayOrder ?? 0));
  const [isActive, setIsActive] = useState(plan?.isActive ?? true);

  const codeOk = !isNew || /^[A-Z0-9_]{2,20}$/.test(code.trim().toUpperCase());
  const canSave = !!nameVi.trim() && !!nameEn.trim() && (!isNew || (!!code.trim() && codeOk));

  const lines = (s: string) => s.split('\n').map((x) => x.trim()).filter(Boolean);

  const submit = () => {
    if (!canSave || busy) return;
    setBusy(true);
    const input: PlanSaveInput = {
      nameVi: nameVi.trim(), nameEn: nameEn.trim(),
      price: Number(price) || 0,
      billingCycleVi: cycleVi.trim() || null, billingCycleEn: cycleEn.trim() || null,
      tokenQuota: tokenQuota.trim() === '' ? null : Number(tokenQuota) || 0,
      descriptionVi: descVi.trim() || null, descriptionEn: descEn.trim() || null,
      featuresVi: lines(featuresVi), featuresEn: lines(featuresEn),
      teaserFeaturesVi: lines(teaserVi), teaserFeaturesEn: lines(teaserEn),
      ctaVi: ctaVi.trim() || null, ctaEn: ctaEn.trim() || null,
      highlight, displayOrder: Number(order) || 0, isActive,
    };
    const req = isNew
      ? createPlan({ ...input, code: code.trim().toUpperCase() }).then((saved) => onSaved(saved, true))
      : updatePlan(plan.id, input).then((saved) => onSaved(saved, false));
    req
      .catch((e) => onToast('error', (e as ApiError).code === ERR_PLAN_CODE_EXISTED ? t.plCodeExists : t.plSaveFail))
      .finally(() => setBusy(false));
  };

  const two = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 } as const;

  // Bố cục theo 4 tab (Cơ bản · Nội dung · Tính năng · Hiển thị) thay vì 1 cột dài;
  // trong mỗi nhóm giữ 2 cột VI (trái) / EN (phải).
  const sections: { key: PlanFormSection; label: string }[] = [
    { key: 'basic', label: t.plSecBasic },
    { key: 'content', label: t.plSecContent },
    { key: 'features', label: t.plSecFeatures },
    { key: 'display', label: t.plSecDisplay },
  ];
  const sectionBtn = (s: { key: PlanFormSection; label: string }) => {
    const active = section === s.key;
    return (
      <button key={s.key} onClick={() => setSection(s.key)} style={{ border: '1px solid', borderColor: active ? 'transparent' : '#ece8f6', background: active ? '#f3edff' : '#fff', color: active ? '#6d28d9' : '#8a85a0', borderRadius: 999, padding: '6px 14px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>{s.label}</button>
    );
  };

  return (
    <Modal title={isNew ? t.plNewPlan : `${t.plEditPlan}: ${plan.nameVi}`} onClose={onClose} maxWidth={620}>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', paddingBottom: 14, marginBottom: 14, borderBottom: '1px solid #f0ecf8' }}>
        {sections.map(sectionBtn)}
      </div>

      {section === 'basic' && (
        <>
          <div style={two}>
            <div>
              <label style={labelStyle}>{t.plCode}</label>
              <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} disabled={!isNew} style={{ ...fieldStyle, background: isNew ? '#fff' : '#f4f2fb', color: isNew ? '#241f3a' : '#8a85a0', textTransform: 'uppercase' }} placeholder="TEAM" />
              <div style={hintStyle}>{isNew ? t.plCodeHint : t.plCore}</div>
            </div>
            <div>
              <label style={labelStyle}>{t.plPrice}</label>
              <input value={price} onChange={(e) => setPrice(e.target.value.replace(/[^\d]/g, ''))} inputMode="numeric" style={fieldStyle} placeholder="499000" />
            </div>
          </div>
          <div style={two}>
            <div><label style={labelStyle}>{t.plNameVi}</label><input value={nameVi} onChange={(e) => setNameVi(e.target.value)} style={fieldStyle} /></div>
            <div><label style={labelStyle}>{t.plNameEn}</label><input value={nameEn} onChange={(e) => setNameEn(e.target.value)} style={fieldStyle} /></div>
          </div>
          <div style={two}>
            <div><label style={labelStyle}>{t.plCycleVi}</label><input value={cycleVi} onChange={(e) => setCycleVi(e.target.value)} style={fieldStyle} placeholder="/tháng" /></div>
            <div><label style={labelStyle}>{t.plCycleEn}</label><input value={cycleEn} onChange={(e) => setCycleEn(e.target.value)} style={fieldStyle} placeholder="/month" /></div>
          </div>
          <div style={two}>
            <div>
              <label style={labelStyle}>{t.plTokenQuota}</label>
              <input value={tokenQuota} onChange={(e) => setTokenQuota(e.target.value.replace(/[^\d]/g, ''))} inputMode="numeric" style={fieldStyle} placeholder="100" />
              <div style={hintStyle}>{t.plTokenQuotaHint}</div>
            </div>
            <div>
              <label style={labelStyle}>{t.plOrder}</label>
              <input value={order} onChange={(e) => setOrder(e.target.value.replace(/[^\d]/g, ''))} inputMode="numeric" style={fieldStyle} />
            </div>
          </div>
        </>
      )}

      {section === 'content' && (
        <div style={two}>
          <div><label style={labelStyle}>{t.plDescVi}</label><textarea value={descVi} onChange={(e) => setDescVi(e.target.value)} rows={4} style={{ ...fieldStyle, resize: 'vertical' }} /></div>
          <div><label style={labelStyle}>{t.plDescEn}</label><textarea value={descEn} onChange={(e) => setDescEn(e.target.value)} rows={4} style={{ ...fieldStyle, resize: 'vertical' }} /></div>
        </div>
      )}

      {section === 'features' && (
        <>
          <div style={two}>
            <div>
              <label style={labelStyle}>{t.plFeaturesVi}</label>
              <textarea value={featuresVi} onChange={(e) => setFeaturesVi(e.target.value)} rows={5} style={{ ...fieldStyle, resize: 'vertical' }} />
              <div style={hintStyle}>{t.plLinesHint}</div>
            </div>
            <div>
              <label style={labelStyle}>{t.plFeaturesEn}</label>
              <textarea value={featuresEn} onChange={(e) => setFeaturesEn(e.target.value)} rows={5} style={{ ...fieldStyle, resize: 'vertical' }} />
              <div style={hintStyle}>{t.plLinesHint}</div>
            </div>
          </div>
          <div style={two}>
            <div>
              <label style={labelStyle}>{t.plTeaserVi}</label>
              <textarea value={teaserVi} onChange={(e) => setTeaserVi(e.target.value)} rows={3} style={{ ...fieldStyle, resize: 'vertical' }} />
              <div style={hintStyle}>{t.plLinesHint}</div>
            </div>
            <div>
              <label style={labelStyle}>{t.plTeaserEn}</label>
              <textarea value={teaserEn} onChange={(e) => setTeaserEn(e.target.value)} rows={3} style={{ ...fieldStyle, resize: 'vertical' }} />
              <div style={hintStyle}>{t.plLinesHint}</div>
            </div>
          </div>
        </>
      )}

      {section === 'display' && (
        <>
          <div style={two}>
            <div><label style={labelStyle}>{t.plCtaVi}</label><input value={ctaVi} onChange={(e) => setCtaVi(e.target.value)} style={fieldStyle} /></div>
            <div><label style={labelStyle}>{t.plCtaEn}</label><input value={ctaEn} onChange={(e) => setCtaEn(e.target.value)} style={fieldStyle} /></div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, color: '#4b4660', cursor: 'pointer' }}>
              <input type="checkbox" checked={highlight} onChange={(e) => setHighlight(e.target.checked)} /> {t.plHighlight}
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, color: '#4b4660', cursor: 'pointer' }}>
              <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} /> {t.plActive}
            </label>
          </div>
        </>
      )}

      {/* Footer sticky: luôn thấy Lưu/Hủy không cần scroll (bù padding 26 của Modal bằng margin âm) */}
      <div style={{ position: 'sticky', bottom: -26, background: '#fff', margin: '16px -26px -26px', padding: '14px 26px 20px', borderTop: '1px solid #f0ecf8', display: 'flex', gap: 10 }}>
        <button onClick={onClose} style={{ flex: 1, border: '1px solid #ece8f6', background: '#fff', borderRadius: 10, padding: '10px 0', fontSize: 14, fontWeight: 700, color: '#5b5670', cursor: 'pointer' }}>{t.cancel}</button>
        <button onClick={submit} disabled={!canSave || busy} style={{ flex: 1, border: 'none', borderRadius: 10, padding: '10px 0', fontSize: 14, fontWeight: 700, color: '#fff', background: brandGradient, cursor: canSave && !busy ? 'pointer' : 'default', opacity: canSave && !busy ? 1 : 0.6 }}>{t.save}</button>
      </div>
    </Modal>
  );
}

// ===== Modal Sửa/Tạo dòng bảng so sánh =====
type CellDraft = { type: 'tick' | 'text'; tick: boolean; textVi: string; textEn: string };

function FeatureFormModal({ feature, plans, onClose, onSaved, onToast }: {
  feature: PlanFeatureDto | null;
  plans: PlanDto[];
  onClose: () => void;
  onSaved: (saved: PlanFeatureDto, isNew: boolean) => void;
  onToast: (type: 'success' | 'error', msg: string) => void;
}) {
  const { t, brandGradient } = useApp();
  const isNew = !feature;
  const [busy, setBusy] = useState(false);

  const [groupVi, setGroupVi] = useState(feature?.groupVi ?? '');
  const [groupEn, setGroupEn] = useState(feature?.groupEn ?? '');
  const [nameVi, setNameVi] = useState(feature?.nameVi ?? '');
  const [nameEn, setNameEn] = useState(feature?.nameEn ?? '');
  const [order, setOrder] = useState(String(feature?.displayOrder ?? 0));
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
    };
    const req = isNew
      ? createFeature(input).then((saved) => onSaved(saved, true))
      : updateFeature(feature.id, input).then((saved) => onSaved(saved, false));
    req.catch(() => onToast('error', t.plSaveFail)).finally(() => setBusy(false));
  };

  const two = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 } as const;
  const segBtn = (active: boolean) => ({
    border: '1px solid', borderColor: active ? 'transparent' : '#ece8f6',
    background: active ? '#f3edff' : '#fff', color: active ? '#6d28d9' : '#8a85a0',
    borderRadius: 8, padding: '4px 10px', fontSize: 11.5, fontWeight: 700, cursor: 'pointer',
  } as const);

  return (
    <Modal title={isNew ? t.plAddFeature : `${t.plEditFeature}: ${feature.nameVi}`} onClose={onClose} maxWidth={620}>
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
      <div style={{ marginBottom: 12, maxWidth: 180 }}>
        <label style={labelStyle}>{t.plOrder}</label>
        <input value={order} onChange={(e) => setOrder(e.target.value.replace(/[^\d]/g, ''))} inputMode="numeric" style={fieldStyle} />
      </div>

      <div style={{ ...labelStyle, marginBottom: 8 }}>{t.plValuesTitle}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
        {plans.map((p) => {
          const c = cells[p.code];
          return (
            <div key={p.code} style={{ border: '1px solid #f1eef8', borderRadius: 12, padding: '10px 12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 800, color: '#6d28d9' }}>{p.code}</span>
                <span style={{ fontSize: 11.5, color: '#a59fbb' }}>{p.nameVi}</span>
                <span style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                  <button onClick={() => setCell(p.code, { type: 'tick' })} style={segBtn(c.type === 'tick')}>{t.plTypeTick}</button>
                  <button onClick={() => setCell(p.code, { type: 'text' })} style={segBtn(c.type === 'text')}>{t.plTypeText}</button>
                </span>
              </div>
              {c.type === 'tick' ? (
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => setCell(p.code, { tick: true })} style={segBtn(c.tick)}>{t.plTickYes}</button>
                  <button onClick={() => setCell(p.code, { tick: false })} style={segBtn(!c.tick)}>{t.plTickNo}</button>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <input value={c.textVi} onChange={(e) => setCell(p.code, { textVi: e.target.value })} style={fieldStyle} placeholder={t.plTextViPh} />
                  <input value={c.textEn} onChange={(e) => setCell(p.code, { textEn: e.target.value })} style={fieldStyle} placeholder={t.plTextEnPh} />
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div style={{ display: 'flex', gap: 10 }}>
        <button onClick={onClose} style={{ flex: 1, border: '1px solid #ece8f6', background: '#fff', borderRadius: 10, padding: '10px 0', fontSize: 14, fontWeight: 700, color: '#5b5670', cursor: 'pointer' }}>{t.cancel}</button>
        <button onClick={submit} disabled={!canSave || busy} style={{ flex: 1, border: 'none', borderRadius: 10, padding: '10px 0', fontSize: 14, fontWeight: 700, color: '#fff', background: brandGradient, cursor: canSave && !busy ? 'pointer' : 'default', opacity: canSave && !busy ? 1 : 0.6 }}>{t.save}</button>
      </div>
    </Modal>
  );
}
