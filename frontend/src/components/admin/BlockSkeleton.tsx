import type { CSSProperties } from 'react';

/**
 * Khung xương CẤP KHỐI cho trang Tổng quan quản trị — mỗi khối tự hiện skeleton của riêng nó
 * (không dùng spinner toàn trang), phản chiếu đúng bố cục thật để lúc dữ liệu về layout không
 * "nhảy". Dùng lại hiệu ứng shimmer `.sk` và style card của `analytics/AnalyticsSkeleton`.
 */

/** Hàng 4 thẻ KPI: icon + nhãn cùng hàng, số lớn, dòng delta, sparkline góc phải. */
export function KpiRowSkeleton({ columns }: { columns: string }) {
  return (
    <div aria-hidden="true" style={{ display: 'grid', gridTemplateColumns: columns, gap: 18 }}>
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} style={{ ...skCard, padding: 20, borderRadius: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
            <div className="sk" style={{ width: 38, height: 38, borderRadius: 11 }} />
            <div className="sk" style={{ width: 96, height: 12 }} />
          </div>
          <div className="sk" style={{ width: '52%', height: 26, marginTop: 14 }} />
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, marginTop: 12 }}>
            <div className="sk" style={{ width: '58%', height: 12 }} />
            <div className="sk" style={{ width: 64, height: 30, borderRadius: 8 }} />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Bảng "Người dùng gần đây" — thân bảng, header do SectionCard lo. */
export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div aria-hidden="true" style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '18px 20px' }}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div className="sk" style={{ width: 32, height: 32, borderRadius: '50%', flex: 'none' }} />
          <div style={{ flex: 2, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div className="sk" style={{ width: '52%', height: 12 }} />
            <div className="sk" style={{ width: '72%', height: 10 }} />
          </div>
          <div className="sk" style={{ width: 54, height: 22, borderRadius: 999 }} />
          <div className="sk" style={{ width: 66, height: 22, borderRadius: 999 }} />
          <div className="sk" style={{ width: 40, height: 12 }} />
          <div className="sk" style={{ width: 56, height: 12 }} />
        </div>
      ))}
    </div>
  );
}

/** Danh sách dòng nhãn + thanh tiến trình (card "Phân bổ gói"). */
export function BarListSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div aria-hidden="true" style={{ display: 'flex', flexDirection: 'column', gap: 15 }}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 7 }}>
            <div className="sk" style={{ width: 64, height: 12 }} />
            <div className="sk" style={{ width: 82, height: 12 }} />
          </div>
          <div className="sk" style={{ width: '100%', height: 9, borderRadius: 99 }} />
        </div>
      ))}
    </div>
  );
}

/** Danh sách dịch vụ (card "Tình trạng hệ thống"): icon + tên + badge + giá trị. */
export function ServiceListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div aria-hidden="true" style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div className="sk" style={{ width: 30, height: 30, borderRadius: 9, flex: 'none' }} />
          <div className="sk" style={{ flex: 1, height: 12 }} />
          <div className="sk" style={{ width: 68, height: 22, borderRadius: 999 }} />
          <div className="sk" style={{ width: 52, height: 12 }} />
        </div>
      ))}
      <div className="sk" style={{ width: '100%', height: 52, borderRadius: 14, marginTop: 4 }} />
    </div>
  );
}

const skCard: CSSProperties = {
  background: '#fff',
  border: '1px solid #efeaf8',
  borderRadius: 20,
  padding: 24,
  boxShadow: '0 18px 38px -34px rgba(80,40,140,.5)',
};
