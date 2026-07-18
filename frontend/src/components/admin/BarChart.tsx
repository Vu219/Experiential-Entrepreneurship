/**
 * Biểu đồ cột thuần div — trích từ mẫu inline của Revenue.tsx (không thêm thư viện,
 * không CDN). Nhãn trục ẩn khi quá dày: hiện tất cả khi ≤ 12 cột, ngược lại mỗi 5 cột.
 */
export default function BarChart({
  series,
  background,
  height = 180,
}: {
  series: { label: string; value: number }[];
  /** CSS background của cột (thường là brandGradient). */
  background: string;
  height?: number;
}) {
  const maxVal = Math.max(...series.map((s) => s.value), 1);
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: series.length > 16 ? 3 : 6, height }}>
      {series.map((s, i) => (
        <div
          key={i}
          title={`${s.label}: ${s.value.toLocaleString('vi-VN')}`}
          style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, height: '100%', justifyContent: 'flex-end' }}
        >
          <div style={{ width: '100%', height: `${(s.value / maxVal) * 100}%`, borderRadius: 5, background, minHeight: s.value > 0 ? 4 : 2, opacity: s.value > 0 ? 1 : 0.25 }} />
          {(series.length <= 12 || i % 5 === 0) && <span style={{ fontSize: 10.5, color: '#a59fbb' }}>{s.label}</span>}
        </div>
      ))}
    </div>
  );
}
