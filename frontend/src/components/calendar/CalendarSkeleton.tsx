import { cardStyle } from '../ui.tsx';

// Skeleton phản chiếu layout trang Lịch đăng bài (UI-07 redesign): hàng KPI + lưới tháng + panel.
// Trang cha bọc role="status" aria-busy + text srOnly; ở đây chỉ là khối hình aria-hidden.

export default function CalendarSkeleton({ stacked, isMobile }: { stacked: boolean; isMobile: boolean }) {
  return (
    <div aria-hidden="true" style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? 16 : 20 }}>
      <div className="grid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16 }}>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} style={{ ...cardStyle, padding: 18, borderRadius: 18, display: 'flex', gap: 13 }}>
            <div className="sk" style={{ width: 40, height: 40, borderRadius: 11, flex: 'none' }} />
            <div style={{ flex: 1 }}>
              <div className="sk" style={{ width: '40%', height: 22 }} />
              <div className="sk" style={{ width: '70%', height: 12, margin: '7px 0' }} />
              <div className="sk" style={{ width: '55%', height: 11 }} />
            </div>
          </div>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: stacked ? '1fr' : '1.5fr 1fr', gap: 20, alignItems: 'start' }}>
        <div style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 18 }}>
            <div className="sk" style={{ width: 150, height: 22 }} />
            <div className="sk" style={{ width: 150, height: 30, borderRadius: 10 }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 6 }}>
            {Array.from({ length: 42 }).map((_, i) => (
              <div key={i} className="sk" style={{ height: isMobile ? 48 : 84, borderRadius: 11 }} />
            ))}
          </div>
        </div>
        {!isMobile && (
          <div style={cardStyle}>
            <div className="sk" style={{ width: 130, height: 18, marginBottom: 14 }} />
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="sk" style={{ width: 64, height: 26, borderRadius: 999 }} />
              ))}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[0, 1, 2].map((i) => (
                <div key={i} className="sk" style={{ height: 74, borderRadius: 14 }} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
