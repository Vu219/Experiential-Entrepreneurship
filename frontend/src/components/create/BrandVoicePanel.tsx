import { useState } from 'react';
import { ChevronDown, ChevronUp, RefreshCw } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Card, Icon } from '../ui';
import type { BrandVoiceCheck } from '../../api/contentCreationService';
import { DEFAULT_VOICE_THRESHOLD } from './useReadiness';

/**
 * Panel "Kiểm tra brand voice": % phù hợp + nhận xét giọng điệu / ngôn từ / thông điệp.
 * `baselineScore` = điểm lúc AI sinh bản này — điểm hiện tại thấp hơn thì cảnh báo nhẹ
 * (dùng ở mốc 3 sau khi sửa tay và mốc 4 như xác nhận cuối).
 * Điểm 0 = chưa kiểm tra (bản đã định dạng chưa có điểm) → "Chưa kiểm tra" + nút "Kiểm tra", KHÔNG hiện
 * "Phù hợp (0%)". Nhãn Phù hợp / Cần xem lại theo `threshold` (ngưỡng của user, mặc định 70%).
 * `collapsible` → header là dòng tóm tắt, thân mặc định thu gọn (mốc 3).
 */
export default function BrandVoicePanel({
  check,
  busy = false,
  baselineScore,
  onRecheck,
  threshold = DEFAULT_VOICE_THRESHOLD,
  collapsible = false,
}: {
  check: BrandVoiceCheck | null;
  busy?: boolean;
  baselineScore?: number;
  onRecheck?: () => void;
  threshold?: number;
  collapsible?: boolean;
}) {
  const { t } = useApp();
  const [open, setOpen] = useState(!collapsible);
  const checked = !!check && check.score > 0;
  const aligned = checked && check.score >= threshold;
  const dropped = checked && baselineScore !== undefined && baselineScore > 0 && check.score < baselineScore;
  const verdict = aligned
    ? { text: t.cwVoiceMatch, color: '#16a34a', bg: '#e8f8ee', bar: 'linear-gradient(90deg,#22d3ee,#16a34a)' }
    : { text: t.cwVoiceReview, color: '#b45309', bg: '#fdf0dc', bar: 'linear-gradient(90deg,#fbbf24,#d97706)' };
  // Backend brand voice thật chỉ có score + notes (tone/wording/message để trống) — bỏ dòng rỗng.
  const row = (label: string, value: string) =>
    value ? (
      <div style={{ display: 'flex', gap: 8, fontSize: 12.5, lineHeight: 1.5 }}>
        <span style={{ flex: 'none', fontWeight: 700, color: '#574f6e' }}>{label}:</span>
        <span style={{ color: '#6b6680' }}>{value}</span>
      </div>
    ) : null;

  const badge = checked ? (
    <span style={{ background: verdict.bg, color: verdict.color, borderRadius: 9, padding: '4px 12px', fontSize: 13, fontWeight: 800 }}>
      {verdict.text} ({check.score}%)
    </span>
  ) : null;

  const actionBtn = onRecheck && (
    <button
      onClick={onRecheck}
      disabled={busy}
      className="btn-soft"
      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flex: 'none', border: '1px solid #ece8f6', background: '#fff', borderRadius: 9, padding: '6px 10px', fontSize: 11.5, fontWeight: 700, color: '#7c3aed', cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.6 : 1 }}
    >
      <Icon icon={RefreshCw} size={12} stroke="#7c3aed" />{checked ? t.cwVoiceRecheck : t.cwVoiceCheck}
    </button>
  );

  // Dòng tóm tắt khi thu gọn: "Phù hợp · 88%" / "Cần xem lại · 55%" / "Chưa kiểm tra".
  const summary = busy ? t.cwVoiceChecking : checked ? `${verdict.text} · ${check.score}%` : check ? t.cwVoiceUnchecked : null;

  const body = busy ? (
    <div style={{ fontSize: 12.5, color: '#8a85a0', padding: '10px 0' }}>{t.cwVoiceChecking}</div>
  ) : checked ? (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        {badge}
        <span style={{ fontSize: 11.5, color: '#a59fbb' }}>{t.cwVoiceThresholdNote.replace('{n}', String(threshold))}</span>
      </div>
      {/* Thanh % phù hợp */}
      <div style={{ height: 7, borderRadius: 99, background: '#f1edfa', overflow: 'hidden' }}>
        <div style={{ width: `${check.score}%`, height: '100%', borderRadius: 99, background: verdict.bar }} />
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
  ) : check ? (
    // Có bản nhưng chưa có điểm (vd bản vừa định dạng) — mời kiểm tra, không hiện 0%.
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12.5, color: '#8a85a0' }}>
      <span style={{ background: '#f4f2fb', color: '#6b6680', borderRadius: 9, padding: '4px 12px', fontSize: 12.5, fontWeight: 700 }}>{t.cwVoiceUnchecked}</span>
    </div>
  ) : (
    // Placeholder mốc 2 lúc chưa tạo — khung giữ nguyên, điểm "đổ vào" sau.
    <div style={{ border: '1.5px dashed #d9cef5', borderRadius: 12, padding: '22px 16px', textAlign: 'center', background: '#fdfcff', fontSize: 12.5, color: '#a59fbb', lineHeight: 1.55 }}>
      {t.cwVoiceEmpty}
    </div>
  );

  if (collapsible) {
    return (
      <Card style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px' }}>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: 'block', fontSize: 12.5, fontWeight: 800, color: '#211c38' }}>{t.cwVoiceTitle}</span>
            {summary && <span style={{ display: 'block', fontSize: 11.5, fontWeight: 600, color: checked && !busy ? verdict.color : '#8a85a0' }}>{summary}</span>}
          </span>
          {actionBtn}
          <button
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-label={open ? t.cwSecCollapse : t.cwSecExpand}
            title={open ? t.cwSecCollapse : t.cwSecExpand}
            style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flex: 'none', width: 28, height: 28, border: '1px solid #ece8f6', borderRadius: 8, background: '#fff', cursor: 'pointer' }}
          >
            <Icon icon={open ? ChevronUp : ChevronDown} size={15} stroke="#a59fbb" />
          </button>
        </div>
        {open && <div style={{ padding: '10px 14px 14px', borderTop: '1px solid #f1edfa' }}>{body}</div>}
      </Card>
    );
  }

  return (
    <Card style={{ padding: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ fontWeight: 700, fontSize: 14.5, color: '#211c38' }}>{t.cwVoiceTitle}</div>
        {actionBtn}
      </div>
      {body}
    </Card>
  );
}
