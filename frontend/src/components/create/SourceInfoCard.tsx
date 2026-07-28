import { useState, type ReactNode } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useUiStore } from '../../store/useUiStore';
import { Card, Icon, PlatformTag } from '../ui';
import { PLATFORMS, PLATFORM_BG } from '../../theme';
import type { Platform } from '../../api/brandProfile';
import { tagOfPlatform } from './PlatformTabs';
import type { SourceSelection } from './steps/SourceStep';

const rowLabel = { fontSize: 10.5, fontWeight: 700, letterSpacing: '.04em', color: '#a59fbb', textTransform: 'uppercase' as const, marginBottom: 3 };
const rowValue = { fontSize: 13, color: '#3f3a55', lineHeight: 1.5 };

/** Dữ liệu chuẩn hoá cho card "Thông tin nguồn" — tách khỏi SourceSelection để dùng lại được
 *  cả ở màn xem chi tiết (chỉ có brand + nền tảng). Dòng thiếu dữ liệu bị ẩn hẳn. */
export interface SourceInfoData {
  brandName: string;
  logoUrl?: string | null;
  industry?: string | null;
  strategyName?: string | null;
  trend?: { kind: 'trend' | 'idea'; title: string } | null;
  goals?: string[] | null;
  platforms: Platform[];
}

/** Map SourceSelection (luồng tạo/sửa) → SourceInfoData. */
export function sourceToInfo(source: SourceSelection): SourceInfoData {
  return {
    brandName: source.brand.brandName,
    logoUrl: source.brand.logoUrl,
    industry: source.brand.industry,
    strategyName: source.strategy?.name ?? null,
    trend: source.trend ? { kind: source.trend.kind, title: source.trend.title } : null,
    goals: source.strategy?.goals ?? null,
    platforms: source.platforms,
  };
}

/**
 * Card "Thông tin nguồn" — neo cột phải ở các màn tạo/xem/sửa. Gom nguồn AI dùng để sinh nội dung.
 * - Mở rộng: Hồ sơ thương hiệu, Ngành hàng, Chiến lược, Trend/Ý tưởng, Mục tiêu content, Nền tảng.
 * - Thu gọn: CHỈ còn header (logo + tên thương hiệu) — toàn bộ phần thân bị ẩn.
 * - Dòng thiếu dữ liệu bị ẩn hẳn. `defaultOpen=false` → mở ra ở dạng thu gọn (màn xem/duyệt).
 */
export default function SourceInfoCard({ info, defaultOpen = true }: { info: SourceInfoData; defaultOpen?: boolean }) {
  const { t, go, brandGradient } = useApp();
  const [open, setOpen] = useState(defaultOpen);
  const { brandName, logoUrl, industry, strategyName, trend, goals } = info;
  const platforms = info.platforms ?? [];

  const openBrand = () => {
    useUiStore.getState().setBrandInitialTab('brand');
    go('brand');
  };

  // Dòng thông tin — bỏ qua khi không có dữ liệu (không render dòng trống).
  const row = (label: string, value: ReactNode | null | undefined | false) =>
    value ? (
      <div style={{ minWidth: 0 }}>
        <div style={rowLabel}>{label}</div>
        <div style={rowValue}>{value}</div>
      </div>
    ) : null;

  const platformsRow = platforms.length ? (
    <span style={{ display: 'inline-flex', gap: 6, flexWrap: 'wrap' }}>
      {platforms.map((p) => {
        const tag = tagOfPlatform(p);
        return (
          <span key={p} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: '1px solid #ece8f6', borderRadius: 8, padding: '3px 9px', fontSize: 12, fontWeight: 600, background: '#fcfbfe' }}>
            <PlatformTag tag={tag} bg={PLATFORM_BG[tag]} size={16} radius={5} fontSize={9} />
            {PLATFORMS.find((pl) => pl.tag === tag)?.name ?? p}
          </span>
        );
      })}
    </span>
  ) : null;

  return (
    <Card style={{ padding: 0, overflow: 'hidden' }}>
      {/* Header: logo + tên thương hiệu + nút thu gọn/mở rộng */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px' }}>
        <button
          onClick={openBrand}
          title={t.cwCtxOpen}
          className="btn-soft"
          style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0, border: 'none', background: 'transparent', padding: 0, cursor: 'pointer', textAlign: 'left' }}
        >
          <span aria-hidden style={{ width: 30, height: 30, flex: 'none', borderRadius: 9, overflow: 'hidden', background: logoUrl ? '#fff' : brandGradient, border: '1px solid #efe6fb', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontFamily: "'Plus Jakarta Sans'", fontWeight: 800, fontSize: 13 }}>
            {logoUrl ? <img src={logoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : (brandName || 'A')[0].toUpperCase()}
          </span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: 'block', fontSize: 12.5, fontWeight: 800, color: '#211c38' }}>{t.cwSrcInfoTitle}</span>
            <span style={{ display: 'block', fontSize: 11.5, color: '#8a85a0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{brandName}</span>
          </span>
        </button>
        <button
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label={open ? t.cwSrcInfoCollapse : t.cwSrcInfoExpand}
          title={open ? t.cwSrcInfoCollapse : t.cwSrcInfoExpand}
          style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flex: 'none', width: 28, height: 28, border: '1px solid #ece8f6', borderRadius: 8, background: '#fff', color: '#a59fbb', cursor: 'pointer' }}
        >
          <Icon icon={open ? ChevronUp : ChevronDown} size={15} stroke="#a59fbb" />
        </button>
      </div>

      {/* Thu gọn = ẩn TOÀN BỘ phần thân, không chừa lại vài dòng "chính" — header đã có tên
          thương hiệu nên giữ thêm nửa card lúc thu gọn chỉ làm nút thu gọn mất tác dụng. */}
      {open && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '10px 14px 14px', borderTop: '1px solid #f1edfa' }}>
          {row(t.cwSrcBrand, <span style={{ fontWeight: 700, color: '#211c38' }}>{brandName}</span>)}
          {row(t.cwSrcIndustry, industry)}
          {row(t.cwSrcStrategy, strategyName)}
          {row(t.cwSrcTrendIdea, trend ? `${trend.kind === 'trend' ? t.cwTrendWord : t.cwIdeaWord}: ${trend.title}` : null)}
          {row(t.cwSrcGoal, goals && goals.length ? goals.join(' · ') : null)}
          {row(t.cwSrcPlatforms, platformsRow)}
        </div>
      )}
    </Card>
  );
}
