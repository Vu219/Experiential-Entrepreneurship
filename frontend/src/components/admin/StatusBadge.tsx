import type { CSSProperties } from 'react';
import { TONE_COLORS, type Tone } from '../../statusTokens';

/**
 * Badge trạng thái thống nhất toàn hệ thống. Một nguồn màu duy nhất
 * (TONE_COLORS trong src/statusTokens.ts) cho mọi loại trạng thái — user, bài
 * đăng, log, dịch vụ — để màu sắc đồng nhất. Mỗi nơi dùng chỉ cần truyền
 * `tone` (ngữ nghĩa) + `label` (chữ hiển thị, đã i18n).
 */
export type { Tone };

export default function StatusBadge({
  tone,
  label,
  style,
}: {
  tone: Tone;
  label: string;
  style?: CSSProperties;
}) {
  const c = TONE_COLORS[tone];
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        fontSize: 12,
        fontWeight: 700,
        color: c.color,
        background: c.bg,
        padding: '4px 10px',
        borderRadius: 999,
        whiteSpace: 'nowrap',
        ...style,
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: c.color, flex: 'none' }} />
      {label}
    </span>
  );
}
