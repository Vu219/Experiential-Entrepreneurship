/**
 * Helper khoảng ngày dùng chung cho thanh lọc trang Phân tích (thay `AnalyticsToolbar` cũ).
 * Tính theo giờ MÁY (không UTC) để "hôm nay" đúng với người dùng, khớp cách backend mặc định
 * 7 ngày gần nhất.
 */

const pad = (n: number) => String(n).padStart(2, '0');

export const toISO = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const todayISO = () => toISO(new Date());
export const shiftISO = (iso: string, days: number) => {
  const [y, m, d] = iso.split('-').map(Number);
  return toISO(new Date(y, m - 1, d + days));
};

/** Khoảng mặc định của trang: 7 ngày gần nhất (khớp mặc định backend). */
export function defaultRange(): { from: string; to: string } {
  const to = todayISO();
  return { from: shiftISO(to, -6), to };
}

export type PresetKey = 'today' | 'd7' | 'd30' | 'd90' | 'custom';

/** Preset khoảng ngày: nhãn i18n + số ngày (today = 1 ngày). */
export const PRESETS: { key: Exclude<PresetKey, 'custom'>; days: number }[] = [
  { key: 'today', days: 1 },
  { key: 'd7', days: 7 },
  { key: 'd30', days: 30 },
  { key: 'd90', days: 90 },
];

/** Khoảng tương ứng một preset (kết thúc ở hôm nay). */
export function rangeOfPreset(days: number): { from: string; to: string } {
  const to = todayISO();
  return { from: shiftISO(to, -(days - 1)), to };
}

/** Suy preset đang chọn từ from/to; không khớp preset nào (kể cả to ≠ hôm nay) → 'custom'. */
export function activePreset(from: string, to: string): PresetKey {
  if (to !== todayISO()) return 'custom';
  const match = PRESETS.find((p) => from === shiftISO(to, -(p.days - 1)));
  return match ? match.key : 'custom';
}

/** Nhãn nút khoảng ngày: `13/07/2026 - 19/07/2026`. */
export const formatRangeLabel = (from: string, to: string) => `${ddmmyyyy(from)} - ${ddmmyyyy(to)}`;

/** Nhãn rút gọn (bỏ năm) cho badge góc card: `13/07 – 19/07`. Bản đầy đủ vẫn ở tooltip. */
export const formatRangeShort = (from: string, to: string) =>
  `${from.slice(8, 10)}/${from.slice(5, 7)} – ${to.slice(8, 10)}/${to.slice(5, 7)}`;

const ddmmyyyy = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
