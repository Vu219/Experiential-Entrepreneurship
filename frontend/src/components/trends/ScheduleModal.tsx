import { useEffect, useMemo, useState } from 'react';
import { CalendarClock } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import Modal from '../Modal';
import { Icon, PlatformTag } from '../ui';
import { PLATFORMS, PLATFORM_BG } from '../../theme';
import { listAllBrandProfiles, type BrandProfile, type Platform } from '../../api/brandProfile';
import { listAllContentStrategies, type ContentStrategy } from '../../api/contentStrategy';
import { type TrendSchedule } from '../../trendsSchedule';
import { C } from '../../styles/colors';

const selectStyle = {
  width: '100%', border: `1px solid ${C.border}`, borderRadius: 12, padding: '10px 12px',
  fontSize: 13.5, color: C.textStrong, background: C.surface, outline: 'none', cursor: 'pointer',
} as const;

const labelStyle = { fontSize: 12.5, fontWeight: 700, color: C.textSecondary, marginBottom: 6 } as const;

const tagOfPlatform = (p: Platform) => (p === 'FACEBOOK' ? 'FB' : p === 'INSTAGRAM' ? 'IG' : 'TH');

/**
 * Cài đặt "Lịch research tự động": chọn hồ sơ + chiến lược (như modal Research ngay),
 * thêm tần suất (hằng ngày / hằng tuần + thứ), giờ chạy và nền tảng. Lưu localStorage.
 */
export default function ScheduleModal({
  initial,
  onClose,
  onSave,
}: {
  initial: TrendSchedule | null;
  onClose: () => void;
  onSave: (schedule: TrendSchedule) => void;
}) {
  const { t } = useApp();
  const dayLabels = t.trDayShorts.split(',');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [brands, setBrands] = useState<BrandProfile[]>([]);
  const [strategies, setStrategies] = useState<ContentStrategy[]>([]);

  const [enabled, setEnabled] = useState(initial?.enabled ?? true);
  const [brandId, setBrandId] = useState(initial?.brandId ?? '');
  const [strategyId, setStrategyId] = useState(initial?.strategyId ?? '');
  const [platformTags, setPlatformTags] = useState<string[]>(initial?.platforms ?? ['FB']);
  const [frequency, setFrequency] = useState<'daily' | 'weekly'>(initial?.frequency ?? 'daily');
  const [days, setDays] = useState<number[]>(initial?.days ?? []);
  const [time, setTime] = useState(initial?.time ?? '02:00');
  const [dayError, setDayError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [bs, ss] = await Promise.all([listAllBrandProfiles(), listAllContentStrategies()]);
        if (cancelled) return;
        setBrands(bs);
        setStrategies(ss);
        // Chưa có cấu hình cũ (hoặc brand cũ đã xóa) → chọn brand đang hoạt động + chiến lược ACTIVE.
        const saved = bs.find((b) => b.id === initial?.brandId);
        const preferred = saved ?? bs.find((b) => b.isActive) ?? bs[0];
        if (preferred && !saved) {
          setBrandId(preferred.id);
          setPlatformTags([tagOfPlatform(preferred.platforms[0] ?? 'FACEBOOK')]);
          const active = ss.find((s) => s.brandId === preferred.id && s.status === 'ACTIVE');
          setStrategyId(active?.id ?? '');
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
  const brandStrategies = useMemo(() => strategies.filter((s) => s.brandId === brandId), [strategies, brandId]);
  const platformOptions = useMemo(() => {
    const brandPlatforms = brand?.platforms ?? [];
    const all = PLATFORMS.map((p) => p.name.toUpperCase() as Platform);
    return (brandPlatforms.length > 0 ? all.filter((p) => brandPlatforms.includes(p)) : all).map(tagOfPlatform);
  }, [brand]);

  const pickBrand = (id: string) => {
    setBrandId(id);
    const next = brands.find((b) => b.id === id);
    setPlatformTags([tagOfPlatform(next?.platforms[0] ?? 'FACEBOOK')]);
    const active = strategies.find((s) => s.brandId === id && s.status === 'ACTIVE');
    setStrategyId(active?.id ?? '');
  };

  const toggleTag = (tag: string) =>
    setPlatformTags((prev) => {
      if (prev.includes(tag)) return prev.length > 1 ? prev.filter((x) => x !== tag) : prev;
      return [...prev, tag];
    });

  const toggleDay = (d: number) => {
    setDayError(false);
    setDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort((a, b) => a - b)));
  };

  const strategy = brandStrategies.find((s) => s.id === strategyId) ?? null;
  const canSave = !!brand && !!strategy && platformTags.length > 0;

  const save = () => {
    if (!canSave || !brand || !strategy) return;
    if (frequency === 'weekly' && days.length === 0) {
      setDayError(true);
      return;
    }
    onSave({
      enabled,
      brandId: brand.id,
      brandName: brand.brandName,
      strategyId: strategy.id,
      strategyName: strategy.name,
      platforms: platformTags,
      frequency,
      days: frequency === 'weekly' ? days : [],
      time,
    });
  };

  return (
    <Modal title={t.trSideSchedule} subtitle={t.trScheduleSub} onClose={onClose} maxWidth={500}>
      {loading ? (
        <div style={{ padding: '18px 0', fontSize: 13.5, color: C.textMuted, textAlign: 'center' }}>{t.trLoading}</div>
      ) : error ? (
        <div role="alert" style={{ fontSize: 13, color: C.danger }}>{error}</div>
      ) : brands.length === 0 ? (
        <div style={{ fontSize: 13.5, color: C.ink650, lineHeight: 1.6 }}>{t.trStartNoBrand}</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Bật/tắt */}
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 12, padding: '10px 12px', cursor: 'pointer' }}>
            <Icon icon={CalendarClock} size={16} stroke={C.violetLight} />
            <span style={{ flex: 1, fontSize: 13.5, fontWeight: 700, color: C.ink750 }}>{t.trScheduleEnable}</span>
            <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} style={{ width: 17, height: 17, accentColor: '#8b5cf6', cursor: 'pointer' }} />
          </label>

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

          {/* Chiến lược */}
          <div>
            <div style={labelStyle}>{t.trStrategy}</div>
            {brandStrategies.length === 0 ? (
              <div style={{ fontSize: 12.5, color: C.textMuted }}>{t.trStrategyNone}</div>
            ) : (
              <select value={strategyId} onChange={(e) => setStrategyId(e.target.value)} style={selectStyle}>
                {brandStrategies.map((s) => (
                  <option key={s.id} value={s.id} disabled={s.status !== 'ACTIVE'}>
                    {s.name} · {s.status === 'ACTIVE' ? t.trStrategyActive : s.status === 'DRAFT' ? t.trStrategyDraft : t.trStrategyPaused}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Nền tảng */}
          <div>
            <div style={labelStyle}>{t.trPickPlatforms}</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {platformOptions.map((tag) => {
                const on = platformTags.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleTag(tag)}
                    aria-pressed={on}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 7, padding: '7px 12px',
                      border: on ? `1.5px solid ${C.violetLight}` : `1px solid ${C.border}`, borderRadius: 11,
                      background: on ? C.border : C.surface, cursor: 'pointer',
                      fontSize: 12.5, fontWeight: 700, color: on ? C.primaryStrong : C.ink650,
                    }}
                  >
                    <PlatformTag tag={tag} bg={PLATFORM_BG[tag]} size={18} radius={6} fontSize={9} />
                    {PLATFORMS.find((pl) => pl.tag === tag)?.name ?? tag}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Tần suất + giờ chạy */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <div style={labelStyle}>{t.trScheduleFreq}</div>
              <select value={frequency} onChange={(e) => setFrequency(e.target.value as 'daily' | 'weekly')} style={selectStyle}>
                <option value="daily">{t.trFreqDaily}</option>
                <option value="weekly">{t.trFreqWeekly}</option>
              </select>
            </div>
            <div>
              <div style={labelStyle}>{t.trScheduleTime}</div>
              <input type="time" value={time} onChange={(e) => setTime(e.target.value)} style={{ ...selectStyle, cursor: 'text' }} />
            </div>
          </div>

          {/* Thứ trong tuần (weekly) */}
          {frequency === 'weekly' && (
            <div>
              <div style={labelStyle}>{t.trPickDays}</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {dayLabels.map((label, d) => {
                  const on = days.includes(d);
                  return (
                    <button
                      key={label}
                      type="button"
                      onClick={() => toggleDay(d)}
                      aria-pressed={on}
                      style={{
                        width: 42, padding: '7px 0', border: on ? `1.5px solid ${C.violetLight}` : `1px solid ${C.border}`,
                        borderRadius: 10, background: on ? C.border : C.surface, cursor: 'pointer',
                        fontSize: 12, fontWeight: 700, color: on ? C.primaryStrong : C.ink650,
                      }}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
              {dayError && <div style={{ fontSize: 12, color: C.danger, marginTop: 6 }}>{t.trSchedulePickDayReq}</div>}
            </div>
          )}

          <button
            type="button"
            onClick={save}
            disabled={!canSave}
            className="btn-grad"
            style={{
              border: 'none', borderRadius: 12, padding: '11px 18px', fontWeight: 700, fontSize: 13.5,
              color: C.onBrand, background: 'var(--brand)',
              cursor: !canSave ? 'not-allowed' : 'pointer', opacity: !canSave ? 0.55 : 1,
            }}
          >
            {t.trScheduleSave}
          </button>
        </div>
      )}
    </Modal>
  );
}
