import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Play } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import Modal from '../Modal';
import { Icon, PlatformTag } from '../ui';
import { PLATFORMS, PLATFORM_BG } from '../../theme';
import { listAllBrandProfiles, type BrandProfile, type Platform } from '../../api/brandProfile';
import { listAllContentStrategies, type ContentStrategy } from '../../api/contentStrategy';

const selectStyle = {
  width: '100%', border: '1px solid #ece8f6', borderRadius: 12, padding: '10px 12px',
  fontSize: 13.5, color: '#241f3a', background: '#fff', outline: 'none', cursor: 'pointer',
} as const;

const labelStyle = { fontSize: 12.5, fontWeight: 700, color: '#6b6680', marginBottom: 6 } as const;

/**
 * Bước chọn trước khi "Research ngay" (FR-19): hồ sơ thương hiệu + nền tảng chính của phiên.
 * Tự cảnh báo khi chưa có hồ sơ / hồ sơ chưa có chiến lược ACTIVE và dẫn sang trang Thương hiệu.
 */
export default function ResearchStartModal({
  onClose,
  onStart,
}: {
  onClose: () => void;
  onStart: (brandProfileId: string, platform: Platform) => void;
}) {
  const { t, go } = useApp();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [brands, setBrands] = useState<BrandProfile[]>([]);
  const [strategies, setStrategies] = useState<ContentStrategy[]>([]);
  const [brandId, setBrandId] = useState('');
  const [platform, setPlatform] = useState<Platform>('FACEBOOK');

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
          setPlatform(preferred.platforms[0] ?? 'FACEBOOK');
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
  const hasActiveStrategy = useMemo(
    () => strategies.some((s) => s.brandId === brandId && s.status === 'ACTIVE'),
    [strategies, brandId],
  );

  const pickBrand = (id: string) => {
    setBrandId(id);
    const next = brands.find((b) => b.id === id);
    setPlatform(next?.platforms[0] ?? 'FACEBOOK');
  };

  const goBrandPage = () => {
    onClose();
    go('brand');
  };

  const tagOfPlatform = (p: Platform) => (p === 'FACEBOOK' ? 'FB' : p === 'INSTAGRAM' ? 'IG' : 'TH');

  return (
    <Modal title={t.trStartTitle} subtitle={t.trStartSub} onClose={onClose}>
      {loading ? (
        <div style={{ padding: '18px 0', fontSize: 13.5, color: '#8a85a0', textAlign: 'center' }}>{t.trLoading}</div>
      ) : error ? (
        <div role="alert" style={{ fontSize: 13, color: '#dc2626' }}>{error}</div>
      ) : brands.length === 0 ? (
        <div>
          <div style={{ fontSize: 13.5, color: '#4b4660', lineHeight: 1.6 }}>{t.trStartNoBrand}</div>
          <button
            type="button"
            onClick={goBrandPage}
            className="btn-grad"
            style={{ marginTop: 16, width: '100%', border: 'none', borderRadius: 12, padding: '11px 18px', fontWeight: 700, fontSize: 13.5, color: '#fff', background: 'var(--brand)', cursor: 'pointer' }}
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

          {/* Nền tảng chính của phiên */}
          <div>
            <div style={labelStyle}>{t.trPlatform}</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {platformOptions.map((p) => {
                const tag = tagOfPlatform(p);
                const on = platform === p;
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPlatform(p)}
                    aria-pressed={on}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 7, padding: '8px 13px',
                      border: on ? '1.5px solid #8b5cf6' : '1px solid #ece8f6', borderRadius: 11,
                      background: on ? '#f6f1ff' : '#fff', cursor: 'pointer',
                      fontSize: 13, fontWeight: 700, color: on ? '#6d28d9' : '#4b4660',
                    }}
                  >
                    <PlatformTag tag={tag} bg={PLATFORM_BG[tag]} size={20} radius={6} fontSize={9.5} />
                    {PLATFORMS.find((pl) => pl.tag === tag)?.name ?? p}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Cảnh báo thiếu chiến lược ACTIVE (BE sẽ chặn với mã 1911) */}
          {!hasActiveStrategy && (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, background: '#fdf0dc', borderRadius: 12, padding: '10px 12px' }}>
              <Icon icon={AlertTriangle} size={15} stroke="#d97706" />
              <div style={{ flex: 1, fontSize: 12.5, color: '#92600a', lineHeight: 1.55 }}>
                {t.trStartNoStrategy}{' '}
                <button
                  type="button"
                  onClick={goBrandPage}
                  className="link-underline"
                  style={{ border: 'none', background: 'transparent', padding: 0, fontSize: 12.5, fontWeight: 700, color: '#b45309', cursor: 'pointer' }}
                >
                  {t.trStartGoBrand}
                </button>
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={() => brand && onStart(brand.id, platform)}
            disabled={!brand || !hasActiveStrategy}
            className="btn-grad"
            style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              border: 'none', borderRadius: 12, padding: '11px 18px', fontWeight: 700, fontSize: 13.5,
              color: '#fff', background: 'var(--brand)',
              cursor: !brand || !hasActiveStrategy ? 'not-allowed' : 'pointer',
              opacity: !brand || !hasActiveStrategy ? 0.55 : 1,
            }}
          >
            <Icon icon={Play} size={15} stroke="#fff" />
            {t.trStartBtn}
          </button>
        </div>
      )}
    </Modal>
  );
}
