import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Eye, EyeOff, Layers, Receipt, SlidersHorizontal, Sparkles, Settings2, X } from 'lucide-react';
import { useApp } from '../../../context/AppContext';
import { useBreakpoint } from '../../../hooks/useBreakpoint';
import Modal from '../../Modal';
import ConfirmModal from '../../ConfirmModal';
import Tooltip from '../../Tooltip';
import Switch from '../Switch';
import SegmentedControl from '../SegmentedControl';
import PlanCard from '../../landing/PlanCard';
import LimitRow from './LimitRow';
import FeatureListEditor from './FeatureListEditor';
import { useToast } from '../../toast/ToastProvider';
import {
  createPlan, updatePlan, toPricingPlans,
  type PlanDto, type PlanSaveInput, type PlanLimitDefaults,
} from '../../../api/plans';
import type { ApiError } from '../../../api/apiClient';
import { PLAN_LIMIT_FIELDS, PLAN_LIMIT_GROUPS, type PlanLimitGroup, type PlanLimitKey } from '../../../api/planLimits';
import type { PlatformEnum } from '../../../api/connections';
import type { Lang } from '../../../types';
import {
  cleanLines, effectiveLimits, featureWarnings, fromLimitDrafts, limitErrors, resetKeys, suggestFeatureLines,
  toLimitDrafts, type LimitDraft, type LimitDrafts,
} from '../../../utils/planForm';
import { getDict } from '../../../i18n';
import { C } from '../../../styles/colors';

// Modal Thêm/Sửa gói (admin): rộng ~1180px, header + footer cố định, chỉ phần nội dung cuộn; menu dọc bên trái
// (chấm đỏ + số lỗi từng mục), form ở giữa, xem trước card gói như landing bên phải. Màn nhỏ → toàn màn hình.

const ERR_PLAN_CODE_EXISTED = 1982;
const ERR_PLAN_LIMIT_VALUE_REQUIRED = 2211;

type Section = 'basic' | 'pricing' | 'limits' | 'display' | 'options';

const SECTION_ICON: Record<Section, typeof Layers> = {
  basic: Layers, pricing: Receipt, limits: SlidersHorizontal, display: Sparkles, options: Settings2,
};

interface FormState {
  code: string;
  nameVi: string; nameEn: string;
  price: string;
  cycleVi: string; cycleEn: string;
  interval: string;
  tokenLimit: string;
  descVi: string; descEn: string;
  featuresVi: string[]; featuresEn: string[];
  teaserVi: string[]; teaserEn: string[];
  ctaVi: string; ctaEn: string;
  highlight: boolean;
  isActive: boolean;
  order: string;
  limits: LimitDrafts;
}

function initialState(plan: PlanDto | null, template: PlanDto | undefined): FormState {
  return {
    code: plan?.code ?? '',
    nameVi: plan?.nameVi ?? '', nameEn: plan?.nameEn ?? '',
    price: String(plan?.price ?? 0),
    cycleVi: plan?.billingCycleVi ?? '/tháng', cycleEn: plan?.billingCycleEn ?? '/month',
    interval: String(plan?.billingIntervalMonths ?? 1),
    tokenLimit: plan?.monthlyTokenLimit == null ? '' : String(plan.monthlyTokenLimit),
    descVi: plan?.descriptionVi ?? '', descEn: plan?.descriptionEn ?? '',
    featuresVi: plan?.featuresVi ?? [], featuresEn: plan?.featuresEn ?? [],
    teaserVi: plan?.teaserFeaturesVi ?? [], teaserEn: plan?.teaserFeaturesEn ?? [],
    ctaVi: plan?.ctaVi ?? '', ctaEn: plan?.ctaEn ?? '',
    highlight: plan?.highlight ?? false,
    isActive: plan?.isActive ?? true,
    order: String(plan?.displayOrder ?? 0),
    // Gói mới: điền sẵn từ gói Free (giá trị cụ thể) — gói tự tạo bắt buộc đủ giới hạn, không có "Mặc định" ngầm.
    limits: toLimitDrafts(plan ? plan.featureLimits : template?.featureLimits ?? null),
  };
}

export default function PlanFormModal({ plan, plans, limitDefaults, lockedPlatforms, onClose, onSaved }: {
  plan: PlanDto | null;
  plans: PlanDto[];
  limitDefaults?: PlanLimitDefaults;
  lockedPlatforms: PlatformEnum[];
  onClose: () => void;
  onSaved: (saved: PlanDto, isNew: boolean) => void;
}) {
  const { t, lang, brandGradient } = useApp();
  const dict = t as unknown as Record<string, string>;
  const toast = useToast();
  const { isMobile, width } = useBreakpoint();
  const narrow = width < 1100;
  const isNew = !plan;
  const isCore = !!plan?.core;
  const freeTemplate = plans.find((p) => p.code === 'FREE');

  const [form, setForm] = useState<FormState>(() => initialState(plan, freeTemplate));
  const initialRef = useRef(JSON.stringify(form));
  const dirty = JSON.stringify(form) !== initialRef.current;
  const [section, setSection] = useState<Section>('basic');
  const [contentLang, setContentLang] = useState<Lang>(lang);
  const [previewLang, setPreviewLang] = useState<Lang>(lang);
  // Mục Giới hạn cần chỗ rộng (2 cột) → mặc định thu xem trước; mục khác mở.
  const [previewOpen, setPreviewOpen] = useState(!narrow);
  const [busy, setBusy] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [saveConfirmOpen, setSaveConfirmOpen] = useState(false);
  const scrollerRef = useRef<HTMLDivElement>(null);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }));
  const setLimit = useCallback((key: PlanLimitKey, next: LimitDraft) =>
    setForm((f) => ({ ...f, limits: { ...f.limits, [key]: next } })), []);

  useEffect(() => { scrollerRef.current?.scrollTo({ top: 0 }); }, [section]);
  useEffect(() => { if (section === 'limits' && !narrow) setPreviewOpen(false); }, [section, narrow]);

  // ===== Kiểm tra theo mục (chấm đỏ + số lỗi trên menu) =====
  const codeOk = !isNew || /^[A-Z0-9_]{2,20}$/.test(form.code.trim().toUpperCase());
  const priceNum = Number(form.price) || 0;
  const tokenLimitMissing = form.isActive && priceNum > 0 && form.tokenLimit.trim() === '';
  const limitErrs = limitErrors(form.limits, isCore);
  const errors: Record<Section, string[]> = {
    basic: [
      ...(isNew && !codeOk ? [t.plfErrCode] : []),
      ...(!form.nameVi.trim() ? [t.plfErrNameVi] : []),
      ...(!form.nameEn.trim() ? [t.plfErrNameEn] : []),
    ],
    pricing: tokenLimitMissing ? [t.plTokenLimitRequired] : [],
    limits: Object.keys(limitErrs).map((k) => dict[`plk_${k}`] ?? k),
    display: [],
    options: [],
  };
  const totalErrors = Object.values(errors).reduce((n, e) => n + e.length, 0);

  // ===== Cảnh báo dòng tính năng nói khác giới hạn thật =====
  const effective = useMemo(() => effectiveLimits(form.limits, limitDefaults?.featureLimits), [form.limits, limitDefaults]);
  const featureLines = contentLang === 'en' ? form.featuresEn : form.featuresVi;
  const teaserLines = contentLang === 'en' ? form.teaserEn : form.teaserVi;
  const featureWarns = useMemo(() => featureWarnings(featureLines, effective, lockedPlatforms), [featureLines, effective, lockedPlatforms]);
  const teaserWarns = useMemo(() => featureWarnings(teaserLines, effective, lockedPlatforms), [teaserLines, effective, lockedPlatforms]);
  // Gợi ý theo đúng ngôn ngữ đang soạn (không theo ngôn ngữ giao diện).
  const suggest = () => suggestFeatureLines(effective, getDict(contentLang) as unknown as Record<string, string>, lockedPlatforms);

  // ===== Lưu =====
  const buildInput = (): PlanSaveInput => {
    const tokenRaw = form.tokenLimit.trim();
    const monthlyTokenLimit = tokenRaw !== '' ? Number(tokenRaw)
      : isNew ? null
        // Xoá trắng khi sửa = không giới hạn (-1); để trống từ đầu = giữ nguyên (null).
        : plan?.monthlyTokenLimit != null ? -1 : null;
    return {
      nameVi: form.nameVi.trim(), nameEn: form.nameEn.trim(),
      price: priceNum,
      billingCycleVi: form.cycleVi.trim() || null, billingCycleEn: form.cycleEn.trim() || null,
      billingIntervalMonths: Number(form.interval) || 1,
      monthlyTokenLimit,
      featureLimits: fromLimitDrafts(form.limits),
      resetToDefault: isCore ? resetKeys(form.limits, plan?.featureLimits) : undefined,
      descriptionVi: form.descVi.trim() || null, descriptionEn: form.descEn.trim() || null,
      featuresVi: cleanLines(form.featuresVi), featuresEn: cleanLines(form.featuresEn),
      teaserFeaturesVi: cleanLines(form.teaserVi), teaserFeaturesEn: cleanLines(form.teaserEn),
      ctaVi: form.ctaVi.trim() || null, ctaEn: form.ctaEn.trim() || null,
      highlight: form.highlight, displayOrder: Number(form.order) || 0, isActive: form.isActive,
    };
  };

  const submit = () => {
    setSaveConfirmOpen(false);
    setBusy(true);
    const input = buildInput();
    const req = isNew
      ? createPlan({ ...input, code: form.code.trim().toUpperCase() }).then((saved) => onSaved(saved, true))
      : updatePlan(plan!.id, input).then((saved) => onSaved(saved, false));
    req
      .catch((e) => {
        const code = (e as ApiError).code;
        toast.error(code === ERR_PLAN_CODE_EXISTED ? t.plCodeExists
          : code === ERR_PLAN_LIMIT_VALUE_REQUIRED ? t.plfErrLimitsRequired : (e as Error).message || t.plSaveFail);
      })
      .finally(() => setBusy(false));
  };

  const onSave = () => {
    if (busy) return;
    if (totalErrors > 0) {
      const first = (Object.keys(errors) as Section[]).find((s) => errors[s].length > 0);
      if (first) setSection(first);
      toast.error(t.plfFixErrors.replace('{n}', String(totalErrors)));
      return;
    }
    // Gói đang có người dùng: giới hạn mới áp dụng NGAY cho họ — xác nhận số người bị ảnh hưởng.
    if (!isNew && (plan?.subscriberCount ?? 0) > 0) {
      setSaveConfirmOpen(true);
      return;
    }
    submit();
  };

  const requestClose = () => {
    if (busy) return;
    if (dirty) setDiscardOpen(true);
    else onClose();
  };

  // ===== Xem trước card (như landing) =====
  const previewPlan = useMemo(() => {
    const input = buildInput();
    const dto: PlanDto = {
      ...input, id: plan?.id ?? 'preview', code: (form.code || 'NEW').toUpperCase(), core: isCore,
      tokenQuota: input.monthlyTokenLimit, monthlyTokenLimit: input.monthlyTokenLimit,
      featureLimits: input.featureLimits,
    } as PlanDto;
    return toPricingPlans({ plans: [dto], features: [] }, previewLang)[0];
  }, [form, previewLang]); // eslint-disable-line react-hooks/exhaustive-deps

  // ===== Bố cục =====
  const sections: { key: Section; label: string }[] = [
    { key: 'basic', label: t.plfSecBasic },
    { key: 'pricing', label: t.plfSecPricing },
    { key: 'limits', label: t.plfSecLimits },
    { key: 'display', label: t.plfSecDisplay },
    { key: 'options', label: t.plfSecOptions },
  ];

  const navItem = (s: { key: Section; label: string }, horizontal: boolean) => {
    const active = section === s.key;
    const count = errors[s.key].length;
    const Icon = SECTION_ICON[s.key];
    return (
      <button key={s.key} type="button" onClick={() => setSection(s.key)} aria-current={active ? 'page' : undefined}
        title={count ? errors[s.key].join(' · ') : undefined}
        style={{
          display: 'flex', alignItems: 'center', gap: 9, width: horizontal ? 'auto' : '100%', flex: horizontal ? 'none' : undefined,
          border: 'none', borderRadius: 11, padding: horizontal ? '8px 12px' : '10px 12px', cursor: 'pointer', textAlign: 'left',
          background: active ? C.primarySoft : 'transparent', color: active ? C.primaryStrong : C.textSecondary,
          fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap',
        }}>
        <Icon size={16} strokeWidth={2.1} aria-hidden style={{ flex: 'none' }} />
        <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.label}</span>
        {count > 0 && (
          <span aria-label={t.plfErrCount.replace('{n}', String(count))} style={{
            display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 800, color: C.danger,
          }}>
            <span aria-hidden style={{ width: 7, height: 7, borderRadius: '50%', background: C.danger }} />{count}
          </span>
        )}
      </button>
    );
  };

  const showPreviewColumn = previewOpen && !narrow;
  const showPreviewInstead = previewOpen && narrow;

  return (
    <>
      <Modal bare title={isNew ? t.plNewPlan : `${t.plEditPlan}: ${plan!.nameVi}`} onClose={requestClose}
        maxWidth={1180} fullScreen={isMobile}>
        <div style={{ display: 'flex', flexDirection: 'column', height: isMobile ? '100dvh' : 'min(880px, calc(100vh - 36px))', minHeight: 0 }}>
          {/* Header cố định */}
          <div style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 12, padding: isMobile ? '14px 16px' : '18px 22px',
            borderBottom: `1px solid ${C.surfaceMuted}` }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontFamily: "'Plus Jakarta Sans'", fontWeight: 800, fontSize: 19, color: C.textStrong, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {isNew ? t.plNewPlan : `${t.plEditPlan}: ${lang === 'en' ? plan!.nameEn : plan!.nameVi}`}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 4, fontSize: 12, color: C.textMuted }}>
                {!isNew && <span style={pill}>{plan!.code}</span>}
                {isCore && <span style={pill}>{t.plfCoreBadge}</span>}
                {!isNew && <span>{t.plfSubscribers.replace('{n}', String(plan!.subscriberCount ?? 0))}</span>}
                {dirty && <span style={{ color: C.warning, fontWeight: 700 }}>• {t.plfUnsaved}</span>}
              </div>
            </div>
            <button type="button" onClick={() => setPreviewOpen((v) => !v)} aria-pressed={previewOpen}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: `1px solid ${C.border}`, background: C.surface,
                borderRadius: 10, padding: '7px 12px', fontSize: 12.5, fontWeight: 700, color: C.textSecondary, cursor: 'pointer' }}>
              {previewOpen ? <EyeOff size={15} aria-hidden /> : <Eye size={15} aria-hidden />}
              {!isMobile && (previewOpen ? t.plfHidePreview : t.plfShowPreview)}
            </button>
            <button type="button" onClick={requestClose} aria-label={t.cancel}
              style={{ width: 34, height: 34, flex: 'none', border: 'none', borderRadius: 10, background: C.surfaceMuted, color: C.textSecondary,
                cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
              <X size={17} strokeWidth={2} />
            </button>
          </div>

          {/* Thân: menu dọc | form | xem trước — chỉ phần này cuộn */}
          <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: narrow ? 'column' : 'row' }}>
            {narrow ? (
              <nav aria-label={t.plfNav} style={{ flex: 'none', display: 'flex', gap: 4, overflowX: 'auto', padding: '8px 12px',
                borderBottom: `1px solid ${C.surfaceMuted}` }}>
                {sections.map((s) => navItem(s, true))}
              </nav>
            ) : (
              <nav aria-label={t.plfNav} style={{ flex: '0 0 210px', display: 'flex', flexDirection: 'column', gap: 4, padding: 14,
                borderRight: `1px solid ${C.surfaceMuted}`, overflowY: 'auto', background: C.surfaceSubtle }}>
                {sections.map((s) => navItem(s, false))}
              </nav>
            )}

            {!showPreviewInstead && (
              <div ref={scrollerRef} style={{ flex: 1, minWidth: 0, minHeight: 0, overflowY: 'auto', padding: isMobile ? '16px 16px 24px' : '20px 24px 28px' }}>
                {section === 'basic' && (
                  <SectionBody title={t.plfSecBasic} desc={t.plfSecBasicDesc}>
                    <div style={grid2}>
                      <Field label={t.plCode} tip={isNew ? t.plCodeHint : t.plCore} error={isNew && !codeOk && form.code ? t.plfErrCode : undefined}>
                        <input value={form.code} onChange={(e) => set('code', e.target.value.toUpperCase())} disabled={!isNew}
                          style={{ ...input, background: isNew ? C.surface : C.surfaceMuted, color: isNew ? C.textStrong : C.textMuted }}
                          placeholder="TEAM" aria-invalid={isNew && !codeOk && !!form.code} />
                      </Field>
                      <div />
                      <Field label={t.plNameVi} error={!form.nameVi.trim() ? t.plfErrNameVi : undefined}>
                        <input value={form.nameVi} onChange={(e) => set('nameVi', e.target.value)} style={input} aria-invalid={!form.nameVi.trim()} />
                      </Field>
                      <Field label={t.plNameEn} error={!form.nameEn.trim() ? t.plfErrNameEn : undefined}>
                        <input value={form.nameEn} onChange={(e) => set('nameEn', e.target.value)} style={input} aria-invalid={!form.nameEn.trim()} />
                      </Field>
                    </div>
                  </SectionBody>
                )}

                {section === 'pricing' && (
                  <SectionBody title={t.plfSecPricing} desc={t.plfSecPricingDesc}>
                    <div style={grid2}>
                      <Field label={t.plPrice} suffix="đ">
                        <input value={form.price} onChange={(e) => set('price', e.target.value.replace(/[^\d]/g, ''))} inputMode="numeric" style={input} placeholder="499000" />
                      </Field>
                      <Field label={t.plInterval} tip={t.plIntervalHint} suffix={t.plu_months}>
                        <input value={form.interval} onChange={(e) => set('interval', e.target.value.replace(/[^\d]/g, ''))} inputMode="numeric" style={input} placeholder="1" />
                      </Field>
                      <Field label={t.plCycleVi} tip={t.plfCycleTip}>
                        <input value={form.cycleVi} onChange={(e) => set('cycleVi', e.target.value)} style={input} placeholder="/tháng" />
                      </Field>
                      <Field label={t.plCycleEn}>
                        <input value={form.cycleEn} onChange={(e) => set('cycleEn', e.target.value)} style={input} placeholder="/month" />
                      </Field>
                      <Field label={t.plTokenLimit} tip={t.plfTokenTip} suffix={t.plu_tokens}
                        error={tokenLimitMissing ? t.plTokenLimitRequired : undefined}>
                        <input value={form.tokenLimit} onChange={(e) => set('tokenLimit', e.target.value.replace(/[^\d]/g, ''))} inputMode="numeric"
                          style={input} placeholder={t.plfTokenUnlimitedPh} aria-invalid={tokenLimitMissing} />
                      </Field>
                    </div>
                    <p style={note}>{t.plfTokenQuotaNote}</p>
                    {plan?.code === UNLIMITED_PLAN_CODE && <p style={{ ...note, color: C.success }}>{t.plfUnlimitedNote}</p>}
                  </SectionBody>
                )}

                {section === 'limits' && plan?.code === UNLIMITED_PLAN_CODE && (
                  <p style={{ ...note, color: C.success, marginBottom: 10 }}>{t.plfUnlimitedNote}</p>
                )}
                {section === 'limits' && (
                  <LimitsSection drafts={form.limits} onChange={setLimit} isCore={isCore} errors={limitErrs}
                    defaults={limitDefaults} lockedPlatforms={lockedPlatforms} scroller={scrollerRef} />
                )}

                {section === 'display' && (
                  <SectionBody title={t.plfSecDisplay} desc={t.plfSecDisplayDesc}
                    aside={
                      <SegmentedControl size="sm" ariaLabel={t.plfContentLang} value={contentLang}
                        options={[{ value: 'vi', label: `VI${missing(form, 'vi') ? ' •' : ''}` }, { value: 'en', label: `EN${missing(form, 'en') ? ' •' : ''}` }]}
                        onChange={(v) => setContentLang(v as Lang)} />
                    }>
                    <Field label={contentLang === 'en' ? t.plDescEn : t.plDescVi}>
                      <AutoTextarea value={contentLang === 'en' ? form.descEn : form.descVi}
                        onChange={(v) => set(contentLang === 'en' ? 'descEn' : 'descVi', v)} />
                    </Field>
                    <FeatureListEditor label={contentLang === 'en' ? t.plFeaturesEn : t.plFeaturesVi}
                      items={featureLines} onChange={(v) => set(contentLang === 'en' ? 'featuresEn' : 'featuresVi', v)}
                      warnings={featureWarns} onSuggest={suggest} placeholder={t.plfFeaturePh} />
                    <FeatureListEditor label={contentLang === 'en' ? t.plTeaserEn : t.plTeaserVi}
                      items={teaserLines} onChange={(v) => set(contentLang === 'en' ? 'teaserEn' : 'teaserVi', v)}
                      warnings={teaserWarns} placeholder={t.plfFeaturePh} />
                    <div style={grid2}>
                      <Field label={contentLang === 'en' ? t.plCtaEn : t.plCtaVi}>
                        <input value={contentLang === 'en' ? form.ctaEn : form.ctaVi}
                          onChange={(e) => set(contentLang === 'en' ? 'ctaEn' : 'ctaVi', e.target.value)} style={input} />
                      </Field>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <ToggleRow label={t.plHighlight} tip={t.plfHighlightTip} checked={form.highlight} onChange={(v) => set('highlight', v)} />
                      <ToggleRow label={t.plActive} tip={t.plfActiveTip} checked={form.isActive} onChange={(v) => set('isActive', v)} />
                    </div>
                  </SectionBody>
                )}

                {section === 'options' && (
                  <SectionBody title={t.plfSecOptions} desc={t.plfSecOptionsDesc}>
                    <div style={grid2}>
                      <Field label={t.plOrder} tip={t.plfOrderTip}>
                        <input value={form.order} onChange={(e) => set('order', e.target.value.replace(/[^\d]/g, ''))} inputMode="numeric" style={input} />
                      </Field>
                      <Field label={t.plfCopyLimits} tip={t.plfCopyLimitsTip}>
                        <select value="" onChange={(e) => {
                          const src = plans.find((p) => p.id === e.target.value);
                          if (src) set('limits', toLimitDrafts(src.featureLimits));
                        }} style={{ ...input, cursor: 'pointer' }}>
                          <option value="">{t.plfCopyLimitsPick}</option>
                          {plans.filter((p) => p.id !== plan?.id).map((p) => (
                            <option key={p.id} value={p.id}>{p.code} — {lang === 'en' ? p.nameEn : p.nameVi}</option>
                          ))}
                        </select>
                      </Field>
                    </div>
                    {isCore && <p style={note}>{t.plfCoreNote}</p>}
                  </SectionBody>
                )}
              </div>
            )}

            {(showPreviewColumn || showPreviewInstead) && (
              <aside aria-label={t.plfPreview} style={{
                flex: narrow ? 1 : '0 0 360px', minHeight: 0, overflowY: 'auto', padding: 18,
                borderLeft: narrow ? 'none' : `1px solid ${C.surfaceMuted}`, background: C.surfaceSubtle,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                  <span style={{ fontSize: 12.5, fontWeight: 800, color: C.textStrong, flex: 1 }}>{t.plfPreview}</span>
                  <SegmentedControl size="sm" ariaLabel={t.plfPreviewLang} value={previewLang}
                    options={[{ value: 'vi', label: 'VI' }, { value: 'en', label: 'EN' }]} onChange={(v) => setPreviewLang(v as Lang)} />
                </div>
                {/* pointerEvents none: xem trước thuần hiển thị — CTA không điều hướng */}
                <div style={{ pointerEvents: 'none', display: 'flex', paddingTop: 14 }}>
                  {previewPlan && <PlanCard plan={previewPlan} stacked popularLabel={t.prPopular} />}
                </div>
                <p style={{ ...note, marginTop: 12 }}>{t.plfPreviewNote}</p>
              </aside>
            )}
          </div>

          {/* Footer cố định */}
          <div style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: isMobile ? '12px 16px' : '14px 22px',
            borderTop: `1px solid ${C.surfaceMuted}`, background: C.surface }}>
            <span role="status" style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: totalErrors ? C.danger : C.textMuted }}>
              {totalErrors ? t.plfFixErrors.replace('{n}', String(totalErrors)) : dirty ? t.plfUnsaved : ''}
            </span>
            <button type="button" onClick={requestClose} style={{ border: `1px solid ${C.border}`, background: C.surface, borderRadius: 10,
              padding: '10px 18px', fontSize: 14, fontWeight: 700, color: C.textSecondary, cursor: 'pointer' }}>{t.cancel}</button>
            <button type="button" onClick={onSave} disabled={busy} style={{ border: 'none', borderRadius: 10, padding: '10px 22px', fontSize: 14,
              fontWeight: 700, color: C.onBrand, background: brandGradient, cursor: busy ? 'wait' : 'pointer', opacity: busy ? 0.6 : 1 }}>
              {busy ? t.processing : t.save}
            </button>
          </div>
        </div>
      </Modal>

      {discardOpen && (
        <ConfirmModal variant="warning" title={t.plfDiscardTitle} message={t.plfDiscardMsg} confirmLabel={t.plfDiscard}
          onConfirm={() => { setDiscardOpen(false); onClose(); }} onClose={() => setDiscardOpen(false)} />
      )}
      {saveConfirmOpen && (
        <ConfirmModal variant="warning" title={t.plfSaveConfirmTitle}
          message={t.plfSaveConfirmMsg.replace('{n}', String(plan?.subscriberCount ?? 0))}
          confirmLabel={t.save} busy={busy} onConfirm={submit} onClose={() => setSaveConfirmOpen(false)} />
      )}
    </>
  );
}

// ===== Mục Giới hạn tính năng =====

function LimitsSection({ drafts, onChange, isCore, errors, defaults, lockedPlatforms, scroller }: {
  drafts: LimitDrafts;
  onChange: (key: PlanLimitKey, next: LimitDraft) => void;
  isCore: boolean;
  errors: Partial<Record<PlanLimitKey, 'required' | 'invalid'>>;
  defaults?: PlanLimitDefaults;
  lockedPlatforms: PlatformEnum[];
  scroller: React.RefObject<HTMLDivElement | null>;
}) {
  const { t } = useApp();
  const dict = t as unknown as Record<string, string>;
  const navRef = useRef<HTMLDivElement>(null);
  // Đích tính THEO VÙNG CUỘN (offsetTop đo theo khung modal nên lệch phần đầu modal) và trừ chiều cao mục lục
  // dính — trước đây tiêu đề nhóm bị cuộn khuất dưới mục lục.
  const jump = (g: PlanLimitGroup) => {
    const el = document.getElementById(`plf-group-${g}`);
    const box = scroller.current;
    if (!el || !box) return;
    const top = el.getBoundingClientRect().top - box.getBoundingClientRect().top + box.scrollTop
      - (navRef.current?.offsetHeight ?? 0);
    box.scrollTo({ top, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  };
  const defaultText = (key: PlanLimitKey): string | undefined => {
    const f = PLAN_LIMIT_FIELDS.find((x) => x.key === key)!;
    const raw = defaults?.featureLimits ? (defaults.featureLimits as unknown as Record<string, unknown>)[f.field] : undefined;
    if (raw === undefined) return undefined;
    if (f.type === 'FLAG') return raw ? t.plFlagOn : t.plFlagOff;
    if (f.type === 'SET') return (raw as string[] | null)?.join(' · ') || '—';
    const n = raw as number | null;
    return n == null || n === -1 ? t.plModeUnlimited : n === 0 ? t.plModeOff : `${n.toLocaleString('vi-VN')}${f.unit ? ` ${dict[`plu_${f.unit}`]}` : ''}`;
  };
  return (
    <div>
      <div style={{ marginBottom: 6 }}>
        <h3 style={sectionTitle}>{t.plfSecLimits}</h3>
        <p style={{ ...note, marginTop: 4 }}>{isCore ? t.plfLimitsDescCore : t.plfLimitsDesc}</p>
      </div>
      {/* Mục lục dính trên cùng — nhảy nhanh tới từng nhóm */}
      <div ref={navRef} role="navigation" aria-label={t.plfLimitsToc} style={{
        position: 'sticky', top: -20, zIndex: 2, display: 'flex', gap: 6, flexWrap: 'wrap', padding: '10px 0',
        margin: '0 0 6px', background: C.surface, borderBottom: `1px solid ${C.surfaceMuted}`,
      }}>
        {PLAN_LIMIT_GROUPS.map((g) => {
          const count = PLAN_LIMIT_FIELDS.filter((f) => f.group === g && errors[f.key]).length;
          return (
            <button key={g} type="button" onClick={() => jump(g)} style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, border: `1px solid ${count ? C.danger : C.border}`,
              background: C.surface, color: count ? C.danger : C.textSecondary, borderRadius: 999, padding: '5px 12px',
              fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
            }}>
              {dict[`plGroup_${g}`]}
              {count > 0 && <span style={{ fontWeight: 800 }}>{count}</span>}
            </button>
          );
        })}
      </div>
      {PLAN_LIMIT_GROUPS.map((g) => (
        <section key={g} id={`plf-group-${g}`} aria-labelledby={`plf-group-title-${g}`} style={{ paddingTop: 14 }}>
          <h4 id={`plf-group-title-${g}`} style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 800, color: C.primary }}>{dict[`plGroup_${g}`]}</h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 330px), 1fr))', gap: 10 }}>
            {PLAN_LIMIT_FIELDS.filter((f) => f.group === g).map((f) => (
              <LimitRow key={f.key} field={f} draft={drafts[f.key]} isCore={isCore} error={errors[f.key]}
                defaultText={defaultText(f.key)} lockedPlatforms={lockedPlatforms}
                onChange={(next) => onChange(f.key, next)} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

// ===== Thành phần nhỏ =====

const input: CSSProperties = {
  width: '100%', minWidth: 0, boxSizing: 'border-box', border: `1.5px solid ${C.border}`, borderRadius: 10, padding: '9px 12px',
  fontSize: 13.5, color: C.textStrong, outline: 'none', background: C.surface, textOverflow: 'ellipsis',
};
const grid2: CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 260px), 1fr))', gap: 14 };
/** Gói không giới hạn của hệ thống — khớp `Plan.UNLIMITED_CODE` backend: token + mọi giới hạn bị bỏ qua. */
const UNLIMITED_PLAN_CODE = 'PRO';

const note: CSSProperties = { margin: 0, fontSize: 12, color: C.textMuted, lineHeight: 1.5 };
const pill: CSSProperties = { fontSize: 10.5, fontWeight: 800, letterSpacing: '.06em', color: C.primaryStrong, background: C.primarySoft, border: `1px solid ${C.accentLine}`, borderRadius: 999, padding: '1px 8px' };
const sectionTitle: CSSProperties = { margin: 0, fontFamily: "'Plus Jakarta Sans'", fontSize: 16, fontWeight: 800, color: C.textStrong };

function SectionBody({ title, desc, aside, children }: { title: string; desc?: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3 style={sectionTitle}>{title}</h3>
          {desc && <p style={{ ...note, marginTop: 4 }}>{desc}</p>}
        </div>
        {aside}
      </div>
      {children}
    </div>
  );
}

function Field({ label, tip, error, suffix, children }: { label: string; tip?: string; error?: string; suffix?: string; children: ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12.5, fontWeight: 700, color: C.textStrong }}>
        {label}{tip && <Tooltip text={tip} />}
      </span>
      {suffix ? (
        <span style={{ display: 'flex', alignItems: 'stretch', minWidth: 0 }}>
          <span style={{ flex: 1, minWidth: 0 }}>{children}</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', padding: '0 10px', marginLeft: -1, fontSize: 12, color: C.textMuted,
            background: C.surfaceMuted, border: `1.5px solid ${C.border}`, borderRadius: '0 10px 10px 0', whiteSpace: 'nowrap' }}>{suffix}</span>
        </span>
      ) : children}
      {error && <span role="alert" style={{ fontSize: 11.5, fontWeight: 600, color: C.danger }}>{error}</span>}
    </label>
  );
}

function ToggleRow({ label, tip, checked, onChange }: { label: string; tip?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', border: `1px solid ${C.surfaceMuted}`, borderRadius: 12 }}>
      <Switch checked={checked} onChange={onChange} title={label} />
      <span style={{ fontSize: 13, fontWeight: 700, color: C.textStrong }}>{label}</span>
      {tip && <Tooltip text={tip} />}
    </div>
  );
}

/** Textarea tự giãn theo nội dung — chữ dài không bị che, không cần kéo tay. */
function AutoTextarea({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight + 2, 320)}px`;
  }, [value]);
  return <textarea ref={ref} value={value} onChange={(e) => onChange(e.target.value)} rows={3}
    style={{ ...input, resize: 'vertical', lineHeight: 1.5, fontFamily: 'inherit', overflowY: 'auto' }} />;
}

/** Ngôn ngữ nội dung còn thiếu (mô tả / tính năng / CTA trống) → chấm trên công tắc VI/EN. */
function missing(f: FormState, l: Lang): boolean {
  return l === 'en'
    ? !f.descEn.trim() || cleanLines(f.featuresEn).length === 0 || !f.ctaEn.trim()
    : !f.descVi.trim() || cleanLines(f.featuresVi).length === 0 || !f.ctaVi.trim();
}
