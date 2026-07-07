import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AlertTriangle, ArrowRight, Check, PenLine, Plus } from 'lucide-react';
import { useApp } from '../../../context/AppContext';
import { useUiStore } from '../../../store/useUiStore';
import { Card, Icon, PlatformTag } from '../../ui';
import { PLATFORMS, PLATFORM_BG } from '../../../theme';
import { listAllBrandProfiles, type BrandProfile } from '../../../api/brandProfile';
import type { Platform } from '../../../api/brandProfile';
import { listAllContentStrategies, isStrategyRunnable, type ContentStrategy } from '../../../api/contentStrategy';
import {
  saveWizardDraft,
  listAttachableTrends,
  type AttachableTrend,
  type WizardDraft,
} from '../../../api/contentCreationService';
import ConfirmDialog from '../../brand/ConfirmDialog';
import { tagOfPlatform } from '../PlatformTabs';
import StepLayout from '../StepLayout';
import { WizardStepSkeleton } from '../CreateSkeleton';

export interface SourceSelection {
  brand: BrandProfile;
  strategy: ContentStrategy;
  trend: AttachableTrend | null;
  /** Nền tảng sẽ tạo nội dung cho BÀI NÀY (subset platform của chiến lược, tối thiểu 1). */
  platforms: Platform[];
  /** Ghi chú thêm cho AI (tùy chọn) — truyền vào input tạo nội dung. */
  aiNote: string;
}

const selectStyle = {
  width: '100%', border: '1.5px solid #e7e2f2', borderRadius: 12, padding: '10px 14px',
  fontSize: 14, color: '#241f3a', background: '#fbfaff', outline: 'none', cursor: 'pointer',
} as const;
const labelStyle = { display: 'block', fontSize: 12.5, fontWeight: 700, color: '#574f6e', marginBottom: 8 } as const;
const hintStyle = { fontSize: 11.5, color: '#a59fbb', marginTop: 6 } as const;
const softBtn = {
  display: 'inline-flex', alignItems: 'center', gap: 7, border: '1px solid #ece8f6', background: '#fff',
  borderRadius: 10, padding: '9px 14px', fontSize: 12.5, fontWeight: 700, color: '#574f6e', cursor: 'pointer',
} as const;

/**
 * Mốc 1 — Chọn nguồn (khung 2 cột StepLayout): trái = chọn hồ sơ/chiến lược/trend +
 * chip nền tảng riêng cho bài + ghi chú thêm cho AI; phải = panel TỔNG QUAN read-only
 * (sticky, cập nhật ngay khi đổi lựa chọn) → bấm "Xác nhận" mới mở khoá bước 2.
 * Nếu ĐÃ có nội dung được tạo, đổi hồ sơ/chiến lược khác nguồn cũ phải qua dialog
 * xác nhận (nội dung cũ không còn khớp nguồn → bị xóa khỏi phiên).
 */
export default function SourceStep({
  value,
  draft,
  draftId,
  generatedSource,
  onDiscardGenerated,
  onNext,
}: {
  value: SourceSelection | null;
  /** Nháp khôi phục từ danh sách ("Tiếp tục") — chỉ chứa id, dữ liệu fetch lại mới. */
  draft: WizardDraft | null;
  draftId?: string;
  /** Nguồn đã dùng để tạo nội dung trong phiên (null nếu chưa tạo) — đổi khác phải xác nhận. */
  generatedSource: { brandId: string; strategyId: string } | null;
  onDiscardGenerated: () => void;
  onNext: (sel: SourceSelection) => void;
}) {
  const { t, go, brandGradient, activeBrandId } = useApp();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [brands, setBrands] = useState<BrandProfile[]>([]);
  const [strategies, setStrategies] = useState<ContentStrategy[]>([]);
  // Trend/idea THẬT từ phiên research của user (tab Xu hướng) — key dạng "kind:id".
  const [trendOptions, setTrendOptions] = useState<AttachableTrend[]>([]);
  const [brandId, setBrandId] = useState(value?.brand.id ?? draft?.brandId ?? '');
  const [strategyId, setStrategyId] = useState(value?.strategy.id ?? draft?.strategyId ?? '');
  const [trendKey, setTrendKey] = useState(
    value?.trend ? `${value.trend.kind}:${value.trend.id}`
      : draft?.trendId ? `trend:${draft.trendId}`
      : draft?.ideaId ? `idea:${draft.ideaId}`
      : '',
  );
  const [picked, setPicked] = useState<Platform[]>(value?.platforms ?? draft?.platforms ?? []);
  const [aiNote, setAiNote] = useState(value?.aiNote ?? draft?.note ?? '');
  // Quay lùi từ mốc 2 (value có sẵn) coi như đã xác nhận; đổi lựa chọn sẽ reset.
  const [confirmed, setConfirmed] = useState(!!value);
  // Đổi hồ sơ/chiến lược khi đã có nội dung → giữ thay đổi chờ dialog xác nhận.
  const [pendingChange, setPendingChange] = useState<{ apply: () => void } | null>(null);
  const currentDraftId = useRef(draftId);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Luôn fetch mới (không dùng bản chụp cũ) — hồ sơ/chiến lược vừa sửa sẽ hiện đúng.
        // Trend/idea lỗi tải không chặn bước (tùy chọn) — coi như danh sách rỗng.
        const [bs, ss, trs] = await Promise.all([
          listAllBrandProfiles(),
          listAllContentStrategies(),
          listAttachableTrends().catch(() => [] as AttachableTrend[]),
        ]);
        if (cancelled) return;
        setBrands(bs);
        setStrategies(ss);
        setTrendOptions(trs);
        if (!brandId || !bs.some((b) => b.id === brandId)) {
          const preferred = bs.find((b) => b.id === activeBrandId) ?? bs.find((b) => b.isActive) ?? bs[0];
          if (preferred) setBrandId(preferred.id);
        }
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Chiến lược ACTIVE của hồ sơ đã chọn (FR-13/BR-03: chỉ ACTIVE mới được tạo nội dung).
  const activeStrategies = useMemo(
    () => strategies.filter((s) => s.brandId === brandId && isStrategyRunnable(s)),
    [strategies, brandId],
  );
  // 1 chiến lược → tự nạp; nhiều chiến lược → người dùng chọn.
  useEffect(() => {
    if (activeStrategies.length === 0) setStrategyId('');
    else if (!activeStrategies.some((s) => s.id === strategyId)) setStrategyId(activeStrategies[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeStrategies]);

  const brand = brands.find((b) => b.id === brandId) ?? null;
  const strategy = activeStrategies.find((s) => s.id === strategyId) ?? null;
  const trend = trendOptions.find((tr) => `${tr.kind}:${tr.id}` === trendKey) ?? null;

  // Đổi chiến lược → chip nền tảng reset theo chiến lược mới (giữ lựa chọn cũ nếu vẫn hợp lệ).
  useEffect(() => {
    if (!strategy) {
      setPicked([]);
      return;
    }
    setPicked((prev) => {
      const valid = prev.filter((p) => strategy.platforms.includes(p));
      return valid.length > 0 ? valid : strategy.platforms;
    });
  }, [strategy?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Đổi lựa chọn ảnh hưởng tới nội dung sẽ tạo → phải xác nhận lại tổng quan.
  useEffect(() => {
    setConfirmed(false);
  }, [brandId, strategyId, trendKey, picked]);

  const ready = !!brand && !!strategy && picked.length > 0;

  // Bỏ/thêm chip nền tảng cho riêng bài này (tối thiểu 1; thêm lại theo thứ tự chiến lược).
  const togglePlatform = (p: Platform) => {
    if (!strategy) return;
    setPicked((prev) =>
      prev.includes(p)
        ? prev.length > 1 ? prev.filter((x) => x !== p) : prev
        : strategy.platforms.filter((x) => x === p || prev.includes(x)),
    );
  };

  // Đổi hồ sơ/chiến lược KHÁC nguồn đã tạo nội dung → hỏi trước, xác nhận mới áp dụng.
  const changeBrand = (id: string) => {
    if (generatedSource && id !== generatedSource.brandId) setPendingChange({ apply: () => setBrandId(id) });
    else setBrandId(id);
  };
  const changeStrategy = (id: string) => {
    if (generatedSource && id !== generatedSource.strategyId) setPendingChange({ apply: () => setStrategyId(id) });
    else setStrategyId(id);
  };

  // Lưu NGẦM bản nháp phiên tạo rồi điều hướng sang trang Thương hiệu (đúng tab).
  // Nút chỉ điều hướng — không mở form phụ hay sửa gì trong wizard.
  const leaveToBrand = async (tab: 'brand' | 'strategy') => {
    try {
      const saved = await saveWizardDraft({
        draftId: currentDraftId.current,
        step: 1,
        brandId: brandId || undefined,
        brandName: brand?.brandName,
        strategyId: strategyId || undefined,
        trendId: trend?.kind === 'trend' ? trend.id : undefined,
        ideaId: trend?.kind === 'idea' ? trend.id : undefined,
        platforms: picked.length ? picked : undefined,
        note: aiNote || undefined,
      });
      currentDraftId.current = saved.draftId;
    } catch {
      // Lưu nháp thất bại không chặn điều hướng (lưu ngầm, không hỏi người dùng).
    }
    useUiStore.getState().setBrandInitialTab(tab);
    go('brand');
  };

  if (loading) return <WizardStepSkeleton />;
  if (error)
    return <div style={{ fontSize: 13.5, color: '#d1435b', background: '#fdf1f3', borderRadius: 12, padding: '14px 16px' }}>{error}</div>;

  if (brands.length === 0)
    return (
      <Card style={{ maxWidth: 560, margin: '0 auto', textAlign: 'center' }}>
        <div style={{ fontSize: 13.5, color: '#4b4660', lineHeight: 1.6 }}>{t.cwSrcNoBrand}</div>
        <button onClick={() => leaveToBrand('brand')} className="btn-grad" style={{ marginTop: 16, border: 'none', borderRadius: 12, padding: '11px 22px', fontWeight: 700, fontSize: 13.5, color: '#fff', background: brandGradient, cursor: 'pointer' }}>
          {t.cwSrcGoBrand}
        </button>
      </Card>
    );

  // Một dòng thông tin trong panel tổng quan (read-only).
  const row = (label: string, content: ReactNode) => (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.04em', color: '#a59fbb', textTransform: 'uppercase', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 13, color: '#3f3a55', lineHeight: 1.55 }}>{content}</div>
    </div>
  );

  // Cột trái — chọn nguồn + nền tảng cho bài + ghi chú thêm cho AI.
  const selectionCard = (
    <Card>
      <div style={{ fontWeight: 700, fontSize: 16, color: '#211c38' }}>{t.cwSrcTitle}</div>
      <div style={{ fontSize: 12.5, color: '#8a85a0', marginBottom: 20 }}>{t.cwSrcSub}</div>

      <label style={labelStyle}>{t.cwSrcBrand}</label>
      <select value={brandId} onChange={(e) => changeBrand(e.target.value)} style={selectStyle}>
        {brands.map((b) => (
          <option key={b.id} value={b.id}>
            {b.brandName} — {b.industry}{b.isActive ? ` · ${t.cwSrcActive}` : ''}
          </option>
        ))}
      </select>

      <label style={{ ...labelStyle, marginTop: 18 }}>{t.cwSrcStrategy}</label>
      {activeStrategies.length === 0 ? (
        // Empty state: chưa có chiến lược ACTIVE → chặn sang bước 2, mời tạo chiến lược.
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, background: '#fdf0dc', borderRadius: 12, padding: '12px 14px' }}>
          <Icon icon={AlertTriangle} size={16} stroke="#d97706" />
          <div style={{ flex: 1, fontSize: 12.5, color: '#92600a', lineHeight: 1.55 }}>
            {t.cwSrcNoStrategy}
            <div style={{ marginTop: 10 }}>
              <button onClick={() => leaveToBrand('strategy')} className="btn-grad" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: 'none', borderRadius: 10, padding: '8px 14px', fontSize: 12.5, fontWeight: 700, color: '#fff', background: brandGradient, cursor: 'pointer' }}>
                <Icon icon={Plus} size={14} stroke="#fff" />{t.cwSrcCreateStrategy}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <>
          <select value={strategyId} onChange={(e) => changeStrategy(e.target.value)} style={selectStyle} disabled={activeStrategies.length === 1}>
            {activeStrategies.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <div style={hintStyle}>{t.cwSrcStrategyAuto}</div>
        </>
      )}

      <label style={{ ...labelStyle, marginTop: 18 }}>{t.cwSrcTrend}</label>
      {/* Dữ liệu THẬT từ phiên research COMPLETED gần nhất của user (tab Xu hướng) */}
      <select value={trendKey} onChange={(e) => setTrendKey(e.target.value)} style={selectStyle} disabled={trendOptions.length === 0}>
        <option value="">{t.cwSrcTrendNone}</option>
        {trendOptions.map((tr) => (
          <option key={`${tr.kind}:${tr.id}`} value={`${tr.kind}:${tr.id}`}>
            {tr.kind === 'trend' ? t.cwTrendWord : t.cwIdeaWord}: {tr.title}
          </option>
        ))}
      </select>
      {trendOptions.length === 0 && <div style={hintStyle}>{t.cwSrcNoTrends}</div>}

      {/* Nền tảng cho RIÊNG bài này — mặc định toàn bộ theo chiến lược, bỏ bớt được (≥1) */}
      {strategy && (
        <>
          <label style={{ ...labelStyle, marginTop: 18 }}>{t.cwSrcPickPlatforms}</label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {strategy.platforms.map((p) => {
              const tag = tagOfPlatform(p);
              const on = picked.includes(p);
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => togglePlatform(p)}
                  aria-pressed={on}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 7, padding: '8px 13px',
                    border: on ? '1.5px solid #8b5cf6' : '1px solid #ece8f6', borderRadius: 11,
                    background: on ? '#f6f1ff' : '#fff', cursor: 'pointer',
                    fontSize: 13, fontWeight: 700, color: on ? '#6d28d9' : '#a59fbb',
                    opacity: on ? 1 : 0.75,
                  }}
                >
                  <PlatformTag tag={tag} bg={on ? PLATFORM_BG[tag] : '#c4bdd6'} size={20} radius={6} fontSize={10} />
                  {PLATFORMS.find((pl) => pl.tag === tag)?.name ?? p}
                  {on && <Icon icon={Check} size={13} stroke="#6d28d9" />}
                </button>
              );
            })}
          </div>
          <div style={hintStyle}>{t.cwSrcPickHint}</div>
        </>
      )}

      {/* Ghi chú thêm cho AI — truyền vào input tạo nội dung ở mốc 2 */}
      <label style={{ ...labelStyle, marginTop: 18 }}>{t.cwSrcNoteLabel}</label>
      <textarea
        value={aiNote}
        onChange={(e) => setAiNote(e.target.value)}
        placeholder={t.cwSrcNotePh}
        style={{ ...selectStyle, cursor: 'text', resize: 'vertical', minHeight: 76, lineHeight: 1.55 }}
      />
    </Card>
  );

  // Cột phải — panel TỔNG QUAN read-only, cập nhật ngay khi đổi lựa chọn; chỉ hiển thị,
  // không sửa tại đây. Thiếu chiến lược thì các mục liên quan hiện "—".
  const overviewCard = brand && (
    <Card>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, flexWrap: 'wrap', marginBottom: 18 }}>
        <div style={{ flex: 1, minWidth: 170 }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: '#211c38' }}>{t.cwSrcOverview}</div>
          <div style={{ fontSize: 12, color: '#8a85a0' }}>{t.cwSrcOverviewSub}</div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={() => leaveToBrand('brand')} className="btn-soft" style={softBtn}>
            <Icon icon={PenLine} size={13} stroke="#574f6e" />{t.cwSrcEditBrand}
          </button>
          <button onClick={() => leaveToBrand('strategy')} className="btn-soft" style={softBtn}>
            <Icon icon={PenLine} size={13} stroke="#574f6e" />{t.cwSrcEditStrategy}
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        {row(t.cwSrcBrand, <span style={{ fontWeight: 700, color: '#211c38' }}>{brand.brandName}</span>)}
        {row(t.cwSrcIndustry, brand.industry)}
        {row(t.cwSrcTone, brand.brandVoice || '—')}
        {row(t.cwSrcAudience, brand.targetAudience || '—')}
        {row(
          t.cwSrcPlatforms,
          picked.length ? (
            <span style={{ display: 'inline-flex', gap: 6, flexWrap: 'wrap' }}>
              {picked.map((p) => {
                const tag = tagOfPlatform(p);
                return (
                  <span key={p} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: '1px solid #ece8f6', borderRadius: 8, padding: '3px 9px', fontSize: 12, fontWeight: 600, background: '#fcfbfe' }}>
                    <PlatformTag tag={tag} bg={PLATFORM_BG[tag]} size={17} radius={5} fontSize={9} />
                    {PLATFORMS.find((pl) => pl.tag === tag)?.name ?? p}
                  </span>
                );
              })}
            </span>
          ) : '—',
        )}
        {row(t.cwSrcGoal, strategy?.goals.length ? strategy.goals.join(' · ') : '—')}
        {row(t.cwSrcStyles, strategy?.styles.length ? strategy.styles.join(' · ') : '—')}
        {row(t.cwSrcCtas, strategy?.ctas.length ? strategy.ctas.join(' · ') : '—')}
        {trend && row(t.cwSrcTrend, `${trend.kind === 'trend' ? t.cwTrendWord : t.cwIdeaWord}: ${trend.title}`)}
        {aiNote.trim() && row(t.cwSrcNoteLabel, aiNote)}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginTop: 18, borderTop: '1px solid #f1edfa', paddingTop: 14 }}>
        <div style={{ flex: 1, minWidth: 160, fontSize: 11.5, color: '#a59fbb', lineHeight: 1.5 }}>{t.cwSrcEditHint}</div>
        <button
          onClick={() => setConfirmed(true)}
          disabled={confirmed || !ready}
          aria-pressed={confirmed}
          className={confirmed || !ready ? undefined : 'btn-grad'}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 7, border: 'none', borderRadius: 11,
            padding: '10px 20px', fontSize: 13.5, fontWeight: 700,
            color: confirmed ? '#16a34a' : '#fff',
            background: confirmed ? '#e8f8ee' : brandGradient,
            cursor: confirmed ? 'default' : ready ? 'pointer' : 'not-allowed',
            opacity: confirmed || ready ? 1 : 0.55,
          }}
        >
          {confirmed ? t.cwSrcConfirmed : (<><Icon icon={Check} size={15} stroke="#fff" />{t.cwSrcConfirm}</>)}
        </button>
      </div>
    </Card>
  );

  // Nút sang bước 2 — chỉ mở khi đã Xác nhận tổng quan nguồn.
  const action = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <button
        disabled={!ready || !confirmed}
        onClick={() => ready && confirmed && onNext({ brand: brand!, strategy: strategy!, trend, platforms: picked, aiNote: aiNote.trim() })}
        className="btn-grad"
        style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', border: 'none', borderRadius: 12, padding: 13, fontWeight: 700, fontSize: 14, color: '#fff', background: brandGradient, cursor: ready && confirmed ? 'pointer' : 'not-allowed', opacity: ready && confirmed ? 1 : 0.55 }}
      >
        {t.cwNext}<Icon icon={ArrowRight} size={16} stroke="#fff" />
      </button>
      {ready && !confirmed && <div style={{ fontSize: 11.5, color: '#a59fbb', textAlign: 'center' }}>{t.cwSrcConfirmHint}</div>}
    </div>
  );

  return (
    <>
      <StepLayout main={selectionCard} side={overviewCard} action={action} />
      {/* Xác nhận đổi nguồn khi đã có nội dung — nội dung cũ sẽ bị xóa khỏi phiên */}
      {pendingChange && (
        <ConfirmDialog
          title={t.cwChangeSrcTitle}
          message={t.cwChangeSrcMsg}
          confirmLabel={t.cwChangeSrcConfirm}
          variant="warning"
          onConfirm={() => {
            pendingChange.apply();
            onDiscardGenerated();
            setPendingChange(null);
          }}
          onClose={() => setPendingChange(null)}
        />
      )}
    </>
  );
}
