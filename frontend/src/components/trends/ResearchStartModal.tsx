import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp, Play, SlidersHorizontal } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import Modal from '../Modal';
import { Icon, PlatformTag } from '../ui';
import { PLATFORMS, PLATFORM_BG } from '../../theme';
import { listAllBrandProfiles, type BrandProfile, type Platform } from '../../api/brandProfile';
import { listAllContentStrategies, type ContentStrategy, type StrategyStatus } from '../../api/contentStrategy';
import { C } from '../../styles/colors';

const selectStyle = {
  width: '100%', border: `1px solid ${C.border}`, borderRadius: 12, padding: '10px 12px',
  fontSize: 13.5, color: C.textStrong, background: C.surface, outline: 'none', cursor: 'pointer',
} as const;

const labelStyle = { fontSize: 12.5, fontWeight: 700, color: C.textSecondary, marginBottom: 6 } as const;

const ARTICLE_COUNTS = [5, 10, 15, 20];

/** Bộ lọc nâng cao — áp dụng cho KẾT QUẢ sau khi research xong (client-side). */
export interface ResearchAdvancedFilters {
  time: '7d' | '30d';
  minFit: 'all' | 'high' | 'medium';
  keyword: string;
}

/** Cấu hình phiên research người dùng chọn trong modal. */
export interface ResearchStartConfig {
  brandProfileId: string;
  strategyId: string;
  platforms: Platform[];
  articleCount: number;
  advanced: ResearchAdvancedFilters | null; // null = không bật bộ lọc nâng cao
}

const tagOfPlatform = (p: Platform) => (p === 'FACEBOOK' ? 'FB' : p === 'INSTAGRAM' ? 'IG' : 'TH');

/**
 * Bước chọn trước khi "Research ngay" (FR-19): hồ sơ thương hiệu + chiến lược + nền tảng
 * (chọn nhiều — research lần lượt) + số ý tưởng mong muốn + bộ lọc nâng cao (tùy chọn).
 * Tự cảnh báo khi chưa có hồ sơ / hồ sơ chưa có chiến lược ACTIVE và dẫn sang trang Thương hiệu.
 */
export default function ResearchStartModal({
  onClose,
  onStart,
}: {
  onClose: () => void;
  onStart: (config: ResearchStartConfig) => void;
}) {
  const { t, go } = useApp();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [brands, setBrands] = useState<BrandProfile[]>([]);
  const [strategies, setStrategies] = useState<ContentStrategy[]>([]);
  const [brandId, setBrandId] = useState('');
  const [strategyId, setStrategyId] = useState('');
  const [platforms, setPlatforms] = useState<Platform[]>(['FACEBOOK']);
  const [articleCount, setArticleCount] = useState(10);
  // Bộ lọc nâng cao (mặc định ẩn)
  const [advOpen, setAdvOpen] = useState(false);
  const [advTime, setAdvTime] = useState<'7d' | '30d'>('7d');
  const [advMinFit, setAdvMinFit] = useState<'all' | 'high' | 'medium'>('all');
  const [advKeyword, setAdvKeyword] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [bs, ss] = await Promise.all([listAllBrandProfiles(), listAllContentStrategies()]);
        if (cancelled) return;
        setBrands(bs);
        setStrategies(ss);
        const preferred = bs.find((b) => b.isActive) ?? bs[0];
        if (preferred) {
          setBrandId(preferred.id);
          setPlatforms([preferred.platforms[0] ?? 'FACEBOOK']);
          const active = ss.find((s) => s.brandId === preferred.id && s.status === 'ACTIVE');
          if (active) setStrategyId(active.id);
        }
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      }
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const brand = brands.find((b) => b.id === brandId) ?? null;
  // Nền tảng chọn được: trong scope FB/IG/TH và thuộc hồ sơ đã chọn (hồ sơ trống → cả 3).
  const platformOptions = useMemo(() => {
    const brandPlatforms = brand?.platforms ?? [];
    const all = PLATFORMS.map((p) => p.name.toUpperCase() as Platform);
    return brandPlatforms.length > 0 ? all.filter((p) => brandPlatforms.includes(p)) : all;
  }, [brand]);
  const brandStrategies = useMemo(() => strategies.filter((s) => s.brandId === brandId), [strategies, brandId]);
  const hasActiveStrategy = brandStrategies.some((s) => s.status === 'ACTIVE');
  const strategyStatusLabel: Record<StrategyStatus, string> = {
    ACTIVE: t.trStrategyActive,
    DRAFT: t.trStrategyDraft,
    PAUSED: t.trStrategyPaused,
  };

  const pickBrand = (id: string) => {
    setBrandId(id);
    const next = brands.find((b) => b.id === id);
    setPlatforms([next?.platforms[0] ?? 'FACEBOOK']);
    const active = strategies.find((s) => s.brandId === id && s.status === 'ACTIVE');
    setStrategyId(active?.id ?? '');
  };

  const togglePlatform = (p: Platform) =>
    setPlatforms((prev) => {
      if (prev.includes(p)) return prev.length > 1 ? prev.filter((x) => x !== p) : prev; // giữ tối thiểu 1
      return [...prev, p];
    });

  const goBrandPage = () => {
    onClose();
    go('brand');
  };

  const canStart = !!brand && hasActiveStrategy && !!strategyId && platforms.length > 0;

  const start = () => {
    if (!canStart || !brand) return;
    onStart({
      brandProfileId: brand.id,
      strategyId,
      platforms,
      articleCount,
      advanced: advOpen ? { time: advTime, minFit: advMinFit, keyword: advKeyword.trim() } : null,
    });
  };

  return (
    <Modal title={t.trStartTitle} subtitle={t.trStartSub} onClose={onClose} maxWidth={520}>
      {loading ? (
        <div style={{ padding: '18px 0', fontSize: 13.5, color: C.textMuted, textAlign: 'center' }}>{t.trLoading}</div>
      ) : error ? (
        <div role="alert" style={{ fontSize: 13, color: C.danger }}>{error}</div>
      ) : brands.length === 0 ? (
        <div>
          <div style={{ fontSize: 13.5, color: C.ink650, lineHeight: 1.6 }}>{t.trStartNoBrand}</div>
          <button
            type="button"
            onClick={goBrandPage}
            className="btn-grad"
            style={{ marginTop: 16, width: '100%', border: 'none', borderRadius: 12, padding: '11px 18px', fontWeight: 700, fontSize: 13.5, color: C.onBrand, background: 'var(--brand)', cursor: 'pointer' }}
          >
            {t.trStartGoBrand}
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Hồ sơ thương hiệu */}
          <div>
            <div style={labelStyle}>{t.trStartBrand}</div>
            <select value={brandId} onChange={(e) => pickBrand(e.target.value)} style={selectStyle}>
              {brands.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.brandName} — {b.industry}{b.isActive ? ` · ${t.trStartActive}` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Chiến lược nội dung (chỉ chiến lược ACTIVE dùng được — BE chặn mã 1902) */}
          <div>
            <div style={labelStyle}>{t.trStrategy}</div>
            {brandStrategies.length === 0 ? (
              <div style={{ fontSize: 12.5, color: C.textMuted }}>{t.trStrategyNone}</div>
            ) : (
              <select value={strategyId} onChange={(e) => setStrategyId(e.target.value)} style={selectStyle}>
                {brandStrategies.map((s) => (
                  <option key={s.id} value={s.id} disabled={s.status !== 'ACTIVE'}>
                    {s.name} · {strategyStatusLabel[s.status]}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Nền tảng nghiên cứu — chọn nhiều, research lần lượt từng nền tảng */}
          <div>
            <div style={labelStyle}>{t.trPickPlatforms}</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {platformOptions.map((p) => {
                const tag = tagOfPlatform(p);
                const on = platforms.includes(p);
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => togglePlatform(p)}
                    aria-pressed={on}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 7, padding: '8px 13px',
                      border: on ? `1.5px solid ${C.violetLight}` : `1px solid ${C.border}`, borderRadius: 11,
                      background: on ? C.border : C.surface, cursor: 'pointer',
                      fontSize: 13, fontWeight: 700, color: on ? C.primaryStrong : C.ink650,
                    }}
                  >
                    <PlatformTag tag={tag} bg={PLATFORM_BG[tag]} size={20} radius={6} fontSize={9.5} />
                    {PLATFORMS.find((pl) => pl.tag === tag)?.name ?? p}
                  </button>
                );
              })}
            </div>
            <div style={{ fontSize: 11.5, color: C.ink350, marginTop: 6 }}>{t.trPickPlatformsHint}</div>
          </div>

          {/* Số ý tưởng mong muốn (maxIdeas gửi cho AI, 1–20) */}
          <div>
            <div style={labelStyle}>{t.trArticleCount}</div>
            <div style={{ display: 'inline-flex', gap: 4, background: C.surfaceMuted, border: `1px solid ${C.border}`, borderRadius: 12, padding: 4 }}>
              {ARTICLE_COUNTS.map((n) => {
                const on = articleCount === n;
                return (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setArticleCount(n)}
                    aria-pressed={on}
                    style={{ border: 'none', borderRadius: 9, padding: '7px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer', color: on ? C.primaryStrong : C.textSecondary, background: on ? C.surface : 'transparent', boxShadow: on ? `0 4px 10px -6px ${C.legacyShadowrgba8040140_4_}` : 'none' }}
                  >
                    {n}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Bộ lọc nâng cao (tùy chọn) */}
          <div style={{ border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden' }}>
            <button
              type="button"
              onClick={() => setAdvOpen((o) => !o)}
              aria-expanded={advOpen}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, border: 'none', background: advOpen ? C.bg : C.surface, padding: '10px 12px', cursor: 'pointer', fontSize: 13, fontWeight: 700, color: C.ink650 }}
            >
              <Icon icon={SlidersHorizontal} size={14} stroke={C.primary} />
              <span style={{ flex: 1, textAlign: 'left' }}>{t.trAdvFilter}</span>
              <Icon icon={advOpen ? ChevronUp : ChevronDown} size={15} stroke={C.textMuted} />
            </button>
            {advOpen && (
              <div style={{ padding: '12px 12px 14px', borderTop: `1px solid ${C.surfaceMuted}`, display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ fontSize: 11.5, color: C.ink350 }}>{t.trAdvHint}</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <div style={labelStyle}>{t.trTime}</div>
                    <select value={advTime} onChange={(e) => setAdvTime(e.target.value as '7d' | '30d')} style={selectStyle}>
                      <option value="7d">{t.trLast7d}</option>
                      <option value="30d">{t.trLast30d}</option>
                    </select>
                  </div>
                  <div>
                    <div style={labelStyle}>{t.trMinFit}</div>
                    <select value={advMinFit} onChange={(e) => setAdvMinFit(e.target.value as 'all' | 'high' | 'medium')} style={selectStyle}>
                      <option value="all">{t.trAll}</option>
                      <option value="high">{t.trFitHigh}</option>
                      <option value="medium">{t.trFitMed}</option>
                    </select>
                  </div>
                </div>
                <div>
                  <div style={labelStyle}>{t.trKeyword}</div>
                  <input
                    value={advKeyword}
                    onChange={(e) => setAdvKeyword(e.target.value)}
                    placeholder={t.trKeywordPh}
                    style={{ ...selectStyle, cursor: 'text' }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Cảnh báo thiếu chiến lược ACTIVE (BE sẽ chặn với mã 1911) */}
          {!hasActiveStrategy && (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, background: C.warningSoft, borderRadius: 12, padding: '10px 12px' }}>
              <Icon icon={AlertTriangle} size={15} stroke={C.warning} />
              <div style={{ flex: 1, fontSize: 12.5, color: C.legacyText92600a, lineHeight: 1.55 }}>
                {t.trStartNoStrategy}{' '}
                <button
                  type="button"
                  onClick={goBrandPage}
                  className="link-underline"
                  style={{ border: 'none', background: 'transparent', padding: 0, fontSize: 12.5, fontWeight: 700, color: C.amberText, cursor: 'pointer' }}
                >
                  {t.trStartGoBrand}
                </button>
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={start}
            disabled={!canStart}
            className="btn-grad"
            style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              border: 'none', borderRadius: 12, padding: '11px 18px', fontWeight: 700, fontSize: 13.5,
              color: C.onBrand, background: 'var(--brand)',
              cursor: !canStart ? 'not-allowed' : 'pointer',
              opacity: !canStart ? 0.55 : 1,
            }}
          >
            <Icon icon={Play} size={15} stroke={C.onBrand} />
            {t.trStartBtn}
          </button>
        </div>
      )}
    </Modal>
  );
}
