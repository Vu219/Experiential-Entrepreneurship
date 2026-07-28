import type { CSSProperties, ReactNode } from 'react';

/**
 * Khung xương phản chiếu đúng bố cục Bảng điều khiển (kể cả 2 cột ở desktop) để lúc tải
 * không bị "nhảy" layout hay tràn/lệch card. Dùng class `.sk` (shimmer) sẵn có trong index.css.
 */
export default function DashboardSkeleton({ isMobile, isTablet }: { isMobile: boolean; isTablet: boolean }) {
  const isDesktop = !isMobile && !isTablet;
  const statCols = isMobile ? '1fr' : isTablet ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)';
  const pairCols = isMobile ? '1fr' : 'minmax(0, 1fr) minmax(0, 1fr)';

  // 1. Banner chào mừng
  const heroBanner = (
    <div style={{
      borderRadius: 22,
      padding: isMobile ? '24px 22px' : '28px 34px',
      background: '#fff',
      border: '1px solid #efeaf8',
      boxShadow: '0 18px 38px -34px rgba(80,40,140,.4)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 24,
      flexWrap: 'wrap',
      minHeight: isMobile ? 150 : 132,
    }}>
      <div style={{ flex: 1, minWidth: 240 }}>
        <div className="sk" style={{ width: 140, height: 14 }} />
        <div className="sk" style={{ width: 280, height: 26, margin: '8px 0 10px', borderRadius: 8 }} />
        <div className="sk" style={{ width: '80%', maxWidth: 440, height: 14 }} />
      </div>
      <div className="sk" style={{ width: isMobile ? '100%' : 140, height: 44, borderRadius: 13, flex: 'none' }} />
    </div>
  );

  // 2. Tiến độ thiết lập (Setup Checklist)
  const checklist = (
    <div style={{ ...skCard, minHeight: 136 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <div>
          <div className="sk" style={{ width: 180, height: 16 }} />
          <div className="sk" style={{ width: 220, height: 12, marginTop: 6 }} />
        </div>
        <div className="sk" style={{ width: 30, height: 16, borderRadius: 6 }} />
      </div>
      <div className="sk" style={{ width: '100%', height: 8, borderRadius: 99, margin: '14px 0 16px' }} />
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="sk" style={{ width: 125, height: 36, borderRadius: 11 }} />
        ))}
      </div>
    </div>
  );

  // 3. Hàng 4 thẻ số liệu (Stat Cards)
  const stats = (
    <div style={{ display: 'grid', gridTemplateColumns: statCols, gap: 16 }}>
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} style={{ ...skCard, padding: 20, borderRadius: 18, display: 'flex', flexDirection: 'column', gap: 12, minHeight: 175 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
            <div className="sk" style={{ width: 38, height: 38, borderRadius: 11, flex: 'none' }} />
            <div className="sk" style={{ width: 90, height: 13 }} />
          </div>
          <div className="sk" style={{ width: 70, height: 28, borderRadius: 6 }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <div className="sk" style={{ width: 55, height: 20, borderRadius: 999 }} />
            <div className="sk" style={{ width: 95, height: 11.5 }} />
          </div>
          <div style={{ height: 42, margin: '-2px -4px 0', display: 'flex', alignItems: 'flex-end', gap: 4, paddingBottom: 4 }}>
            {Array.from({ length: 8 }).map((_, j) => (
              <div
                key={j}
                className="sk"
                style={{
                  flex: 1,
                  height: `${25 + (j % 4) * 18}%`,
                  borderRadius: 4,
                  opacity: 0.5 + (j % 3) * 0.2,
                }}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );

  // 4. Biểu đồ hiệu suất (PerformanceChart)
  const perf = (
    <div style={{ ...skCard, minHeight: 380, display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 16 }}>
        <div>
          <div className="sk" style={{ width: 160, height: 18 }} />
          <div style={{ display: 'flex', gap: 14, marginTop: 8 }}>
            <div className="sk" style={{ width: 90, height: 12 }} />
            <div className="sk" style={{ width: 95, height: 12 }} />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <div className="sk" style={{ width: 50, height: 28, borderRadius: 8 }} />
          <div className="sk" style={{ width: 50, height: 28, borderRadius: 8 }} />
        </div>
      </div>
      <div style={{ height: 260, marginTop: 8, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', position: 'relative' }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} style={{ borderBottom: '1px dashed #efeaf8', width: '100%' }} />
        ))}
        <div style={{ position: 'absolute', inset: '10px 0 24px', display: 'flex', alignItems: 'flex-end', gap: 8 }}>
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="sk" style={{ flex: 1, height: `${30 + ((i * 37) % 60)}%`, borderRadius: '6px 6px 0 0', opacity: 0.45 }} />
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 8 }}>
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="sk" style={{ width: 32, height: 10 }} />
          ))}
        </div>
      </div>
    </div>
  );

  // 5. Top chủ đề (TopTopics)
  const topTopics = (
    <div style={{ ...skCard, minHeight: 340, display: 'flex', flexDirection: 'column' }}>
      <div className="sk" style={{ width: 150, height: 16 }} />
      <div className="sk" style={{ width: 190, height: 12, marginTop: 4 }} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 16, flex: 1 }}>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 7 }}>
              <div className="sk" style={{ width: '45%', height: 13.5 }} />
              <div className="sk" style={{ width: 60, height: 12 }} />
            </div>
            <div className="sk" style={{ width: '100%', height: 6, borderRadius: 99 }} />
          </div>
        ))}
      </div>
    </div>
  );

  // 6. Phân bổ loại nội dung (ContentTypeDonut)
  const contentType = (
    <div style={{ ...skCard, minHeight: 340, display: 'flex', flexDirection: 'column' }}>
      <div className="sk" style={{ width: 120, height: 16 }} />
      <div className="sk" style={{ width: 150, height: 12, marginTop: 4 }} />
      <div style={{ height: 190, marginTop: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
        <div className="sk" style={{
          width: 150,
          height: 150,
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <div style={{ width: 90, height: 90, borderRadius: '50%', background: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
            <div className="sk" style={{ width: 35, height: 22, borderRadius: 4 }} />
            <div className="sk" style={{ width: 50, height: 11 }} />
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginTop: 12, flexWrap: 'wrap' }}>
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div className="sk" style={{ width: 10, height: 10, borderRadius: '50%' }} />
            <div className="sk" style={{ width: 45, height: 11 }} />
          </div>
        ))}
      </div>
    </div>
  );

  // 7. Nền tảng đã kết nối (PlatformPanel)
  const platforms = (
    <div style={{ ...skCard, minHeight: 280 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <div className="sk" style={{ width: 150, height: 16 }} />
          <div className="sk" style={{ width: 190, height: 12, marginTop: 4 }} />
        </div>
        <div className="sk" style={{ width: 60, height: 14 }} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 12, marginTop: 16 }}>
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} style={{ border: '1px solid #efeaf8', borderRadius: 14, padding: 14, background: '#fcfbfe', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div className="sk" style={{ width: 34, height: 34, borderRadius: 10, flex: 'none' }} />
              <div style={{ flex: 1 }}>
                <div className="sk" style={{ width: 70, height: 13.5 }} />
                <div className="sk" style={{ width: 90, height: 12, marginTop: 4 }} />
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div className="sk" style={{ width: 65, height: 20, borderRadius: 999 }} />
              <div className="sk" style={{ width: 60, height: 24, borderRadius: 9 }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  // 8. Hoạt động gần đây (ActivityTimeline)
  const activity = (
    <div style={{ ...skCard, minHeight: 360 }}>
      <div className="sk" style={{ width: 150, height: 16, marginBottom: 18 }} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div className="sk" style={{ width: 32, height: 32, borderRadius: 10, flex: 'none' }} />
            <div style={{ flex: 1 }}>
              <div className="sk" style={{ width: `${60 + (i % 3) * 15}%`, height: 13.5 }} />
              <div className="sk" style={{ width: '35%', height: 11.5, marginTop: 5 }} />
            </div>
          </div>
        ))}
      </div>
      <div className="sk" style={{ width: '100%', height: 38, borderRadius: 11, marginTop: 16 }} />
    </div>
  );

  const pair = (
    <div style={{ display: 'grid', gridTemplateColumns: pairCols, gap: 18, alignItems: 'stretch' }}>
      {topTopics}
      {contentType}
    </div>
  );

  return (
    <div aria-hidden="true" style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      {heroBanner}
      {checklist}
      {stats}

      {isDesktop ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)', gap: 18, alignItems: 'start' }}>
          <Column>{perf}{pair}</Column>
          <Column>{platforms}{activity}</Column>
        </div>
      ) : (
        <>
          {perf}
          {platforms}
          {pair}
          {activity}
        </>
      )}
    </div>
  );
}

function Column({ children }: { children: ReactNode }) {
  return <div style={{ display: 'flex', flexDirection: 'column', gap: 18, minWidth: 0 }}>{children}</div>;
}

const skCard: CSSProperties = {
  background: '#fff',
  border: '1px solid #efeaf8',
  borderRadius: 20,
  padding: 24,
  boxShadow: '0 18px 38px -34px rgba(80,40,140,.5)',
  minWidth: 0,
};

