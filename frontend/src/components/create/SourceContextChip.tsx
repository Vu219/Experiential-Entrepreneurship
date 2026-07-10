import { useApp } from '../../context/AppContext';
import { useUiStore } from '../../store/useUiStore';
import { PlatformTag } from '../ui';
import { PLATFORM_BG } from '../../theme';
import { tagOfPlatform } from './PlatformTabs';
import type { SourceSelection } from './steps/SourceStep';

/**
 * Chip NGỮ CẢNH NGUỒN gọn (không phải card lớn) — neo trên cùng panel phải ở các mốc 2–4:
 * avatar/logo + tên nguồn, chiến lược · trend đang dùng, icon nền tảng đã chọn.
 * Bấm vào mở nhanh trang Hồ sơ thương hiệu. KHÔNG nhồi điểm brand voice vào đây —
 * đã có ô "Kiểm tra brand voice" riêng ngay bên dưới, tránh trùng lặp.
 */
export default function SourceContextChip({ source }: { source: SourceSelection }) {
  const { t, go, brandGradient } = useApp();
  const open = () => {
    useUiStore.getState().setBrandInitialTab('brand');
    go('brand');
  };
  const subtitle = [source.strategy.name, source.trend?.title].filter(Boolean).join(' · ');
  const { logoUrl, brandName } = source.brand;

  return (
    <button
      onClick={open}
      title={t.cwCtxOpen}
      className="btn-soft"
      style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left', border: '1px solid #ece8f6', background: '#fff', borderRadius: 13, padding: '9px 12px', cursor: 'pointer' }}
    >
      <span aria-hidden style={{ width: 30, height: 30, flex: 'none', borderRadius: 9, overflow: 'hidden', background: logoUrl ? '#fff' : brandGradient, border: '1px solid #efe6fb', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontFamily: "'Plus Jakarta Sans'", fontWeight: 800, fontSize: 13 }}>
        {logoUrl ? <img src={logoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : (brandName || 'A')[0].toUpperCase()}
      </span>
      <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#211c38', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{brandName}</span>
        {subtitle && (
          <span style={{ fontSize: 11.5, color: '#8a85a0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{subtitle}</span>
        )}
      </span>
      <span style={{ display: 'inline-flex', gap: 4, flex: 'none' }} aria-hidden>
        {source.platforms.map((p) => {
          const tag = tagOfPlatform(p);
          return <PlatformTag key={p} tag={tag} bg={PLATFORM_BG[tag]} size={18} radius={5} fontSize={8} />;
        })}
      </span>
    </button>
  );
}
