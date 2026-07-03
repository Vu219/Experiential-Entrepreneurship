import type { CSSProperties } from 'react';

/**
 * Badge trạng thái thống nhất toàn hệ thống. Một nguồn màu duy nhất (TONES) cho
 * mọi loại trạng thái — user, bài đăng, log, dịch vụ — để màu sắc đồng nhất.
 * Mỗi nơi dùng chỉ cần truyền `tone` (ngữ nghĩa) + `label` (chữ hiển thị, đã i18n).
 */
export type Tone = 'success' | 'danger' | 'warning' | 'info' | 'purple' | 'neutral';

const TONES: Record<Tone, { color: string; bg: string }> = {
  success: { color: '#16a34a', bg: '#e8f8ee' }, // Posted / Active / Operational
  danger: { color: '#dc2626', bg: '#fde8e8' }, // Failed / Locked / Down / ERROR
  warning: { color: '#d97706', bg: '#fdf0dc' }, // Pending / Retrying / Degraded / WARN
  info: { color: '#0e7490', bg: '#e0f7fb' }, // INFO / Plus
  purple: { color: '#7c3aed', bg: '#f1e9ff' }, // Scheduled / Need review / Pro
  neutral: { color: '#64748b', bg: '#eef2f7' }, // Draft / Idle / DEBUG
};

export default function StatusBadge({
  tone,
  label,
  style,
}: {
  tone: Tone;
  label: string;
  style?: CSSProperties;
}) {
  const c = TONES[tone];
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
