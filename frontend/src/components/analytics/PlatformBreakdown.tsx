import { memo, useMemo } from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts';
import { Plus } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Card, Icon, PlatformTag } from '../ui';
import { formatGroupedNumber } from '../../utils/format';
import { PLATFORM_BG, PLATFORMS } from '../../theme';
import { PLATFORM_TO_TAG } from '../../api/connections';
import RangeBadge from './RangeBadge';
import { PLATFORM_DONUT } from './analyticsTokens';
import type { AnalyticsPlatform } from '../../api/analytics';

/**
 * Khối D — "Hiệu suất theo nền tảng": donut tỷ trọng tương tác BÊN TRÁI + danh sách 3 nền tảng BÊN
 * PHẢI (icon + tên + số + %). Backend luôn trả đủ 3 nền tảng; nền tảng chưa kết nối
 * ({@code connected=false}) hiện CTA "Kết nối ngay" dẫn về Cài đặt (nơi duy nhất chạy OAuth). Cùng
 * mẫu donut với `dashboard/ContentTypeDonut` (tâm ngoài SVG cho chữ sắc nét).
 *
 * Donut/list tự gập xuống một cột bằng `flex-wrap` khi card hẹp (tablet/mobile, hoặc cột 4 ở màn
 * 1280) — không cần breakpoint riêng cho card này.
 */
function PlatformBreakdown({ rows, from, to }: { rows: AnalyticsPlatform[]; from: string; to: string }) {
  const { t, lang } = useApp();

  const totalEngagement = useMemo(() => rows.reduce((s, r) => s + r.engagement, 0), [rows]);
  const slices = useMemo(() => rows.filter((r) => r.engagement > 0), [rows]);

  return (
    <Card style={{ display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 16, color: '#211c38' }}>{t.anaByPlatformTitle}</div>
          <div style={{ fontSize: 12.5, color: '#6b6680', marginTop: 2 }}>{t.anaByPlatformSub}</div>
          {/* Card này KHÔNG chịu bộ lọc nền tảng (ngoại lệ cố ý của backend) → phải nói rõ, nếu không
              người dùng lọc 1 nền tảng sẽ tưởng số liệu ở đây cũng đã lọc. */}
          <div style={{ fontSize: 11.5, color: '#a59fbb', marginTop: 4 }}>{t.anaAllPlatformsNote}</div>
        </div>
        <RangeBadge from={from} to={to} />
      </div>

      {/* Không có tương tác → bỏ donut nhưng VẪN liệt kê nền tảng, vì đó là chỗ duy nhất có CTA
          "Kết nối ngay". Danh sách nhận flex:1 để chân card thẳng với card cạnh bên. */}
      {totalEngagement === 0 ? (
        <>
          <div style={{
            minHeight: 140, display: 'flex', alignItems: 'center', justifyContent: 'center',
            textAlign: 'center', fontSize: 13.5, color: '#8a85a0', padding: '0 20px',
          }}>
            {t.anaByPlatformEmpty}
          </div>
          <div style={{ display: 'flex', flex: 1 }}>
            <PlatformList rows={rows} />
          </div>
        </>
      ) : (
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12, marginTop: 14, flex: 1 }}>
          <div style={{ position: 'relative', width: 132, height: 132, flex: 'none' }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={slices} dataKey="engagement" nameKey="platform" innerRadius={42} outerRadius={60}
                  paddingAngle={2} stroke="none" isAnimationActive={false}>
                  {slices.map((r) => (
                    <Cell key={r.platform} fill={PLATFORM_DONUT[r.platform] ?? '#8b5cf6'} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div style={{
              position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', padding: '0 8px',
            }}>
              <div style={{
                fontFamily: "'Plus Jakarta Sans'", fontWeight: 800, fontSize: 17, color: '#211c38',
                maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>
                {formatGroupedNumber(totalEngagement, lang)}
              </div>
              <div style={{ fontSize: 10.5, color: '#8a85a0' }}>{t.anaEngagement}</div>
            </div>
          </div>
          <PlatformList rows={rows} />
        </div>
      )}
    </Card>
  );
}

/** Danh sách 3 nền tảng — `flex: 1 1 120px` để đứng cạnh donut khi đủ chỗ, tự xuống dòng khi hẹp. */
function PlatformList({ rows }: { rows: AnalyticsPlatform[] }) {
  const { t, go, lang } = useApp();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, flex: '1 1 120px', minWidth: 0 }}>
      {rows.map((row) => {
        const tag = PLATFORM_TO_TAG[row.platform] ?? 'FB';
        const name = PLATFORMS.find((p) => p.tag === tag)?.name ?? row.platform;
        return (
          <div key={row.platform} style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
            <PlatformTag tag={tag} bg={PLATFORM_BG[tag] ?? '#6b7280'} size={28} radius={9} fontSize={12} />
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{
                fontSize: 13, fontWeight: 700, color: '#2b2543',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {name}
              </div>
              <div style={{
                fontSize: 11.5, color: '#8a85a0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {row.connected ? (row.accountName ?? '—') : t.dbNotConnected}
              </div>
            </div>
            {row.connected ? (
              <div style={{ textAlign: 'right', flex: 'none' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#211c38' }}>
                  {formatGroupedNumber(row.engagement, lang)}
                </div>
                <div style={{ fontSize: 11.5, color: '#8a85a0' }}>{row.sharePct}%</div>
              </div>
            ) : (
              <button type="button" onClick={() => go('settings')} className="btn-soft" style={{
                display: 'inline-flex', alignItems: 'center', gap: 4, border: '1px solid #ece8f6',
                background: '#fff', color: '#6d28d9', fontWeight: 700, fontSize: 12,
                borderRadius: 9, padding: '6px 9px', cursor: 'pointer', flex: 'none',
              }}>
                <Icon icon={Plus} size={13} stroke="#6d28d9" />
                {t.anaConnect}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default memo(PlatformBreakdown);
