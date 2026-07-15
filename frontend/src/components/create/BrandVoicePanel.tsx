import { RefreshCw } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Card, Icon } from '../ui';
import type { BrandVoiceCheck } from '../../api/contentCreationService';

/**
 * Panel "Kiểm tra brand voice": % phù hợp + nhận xét giọng điệu / ngôn từ / thông điệp.
 * `baselineScore` = điểm lúc AI sinh bản này — điểm hiện tại thấp hơn thì cảnh báo nhẹ
 * (dùng ở mốc 3 sau khi sửa tay và mốc 4 như xác nhận cuối).
 */
export default function BrandVoicePanel({
  check,
  busy = false,
  baselineScore,
  onRecheck,
}: {
  check: BrandVoiceCheck | null;
  busy?: boolean;
  baselineScore?: number;
  onRecheck?: () => void;
}) {
  const { t } = useApp();
  const dropped = !!check && baselineScore !== undefined && check.score < baselineScore;
  // Backend brand voice thật chỉ có score + notes (tone/wording/message để trống) — bỏ dòng rỗng.
  const row = (label: string, value: string) =>
    value ? (
      <div style={{ display: 'flex', gap: 8, fontSize: 12.5, lineHeight: 1.5 }}>
        <span style={{ flex: 'none', fontWeight: 700, color: '#574f6e' }}>{label}:</span>
        <span style={{ color: '#6b6680' }}>{value}</span>
      </div>
    ) : null;
  return (
    <Card style={{ padding: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ fontWeight: 700, fontSize: 14.5, color: '#211c38' }}>{t.cwVoiceTitle}</div>
        {onRecheck && (
          <button
            onClick={onRecheck}
            disabled={busy}
            className="btn-soft"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: '1px solid #ece8f6', background: '#fff', borderRadius: 9, padding: '6px 10px', fontSize: 11.5, fontWeight: 700, color: '#7c3aed', cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.6 : 1 }}
          >
            <Icon icon={RefreshCw} size={12} stroke="#7c3aed" />{t.cwVoiceRecheck}
          </button>
        )}
      </div>

      {busy ? (
        <div style={{ fontSize: 12.5, color: '#8a85a0', padding: '10px 0' }}>{t.cwVoiceChecking}</div>
      ) : check ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ background: '#e8f8ee', color: '#16a34a', borderRadius: 9, padding: '4px 12px', fontSize: 13, fontWeight: 800 }}>
              {t.cwVoiceMatch} ({check.score}%)
            </span>
          </div>
          {/* Thanh % phù hợp */}
          <div style={{ height: 7, borderRadius: 99, background: '#f1edfa', overflow: 'hidden' }}>
            <div style={{ width: `${check.score}%`, height: '100%', borderRadius: 99, background: 'linear-gradient(90deg,#22d3ee,#16a34a)' }} />
          </div>
          {/* Cảnh báo nhẹ khi điểm tụt so với bản AI tạo (sau chỉnh sửa tay) */}
          {dropped && (
            <div style={{ fontSize: 12, color: '#92600a', background: '#fdf0dc', borderRadius: 10, padding: '8px 11px', lineHeight: 1.5 }}>
              {t.cwVoiceDropped.replace('{n}', String(baselineScore))}
            </div>
          )}
          <div style={{ fontSize: 12.5, color: '#3f3a55', fontWeight: 600 }}>{check.summary}</div>
          {row(t.cwVoiceTone, check.tone)}
          {row(t.cwVoiceWording, check.wording)}
          {row(t.cwVoiceMessage, check.message)}
        </div>
      ) : (
        // Placeholder mốc 2 lúc chưa tạo — khung giữ nguyên, điểm "đổ vào" sau.
        <div style={{ border: '1.5px dashed #d9cef5', borderRadius: 12, padding: '22px 16px', textAlign: 'center', background: '#fdfcff', fontSize: 12.5, color: '#a59fbb', lineHeight: 1.55 }}>
          {t.cwVoiceEmpty}
        </div>
      )}
    </Card>
  );
}
