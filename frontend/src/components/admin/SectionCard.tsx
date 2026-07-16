import type { CSSProperties, ReactNode } from 'react';
import { Card } from '../ui';

/**
 * Card có header chuẩn (tiêu đề trái + action phải) cho các khối nội dung trang Quản trị —
 * gộp mẫu lặp ở Overview/Revenue. `flush` = thân sát mép (bảng DataTable), header có kẻ dưới;
 * mặc định = padding Card thường, header cách thân 14px.
 */
export default function SectionCard({
  title,
  action,
  flush = false,
  children,
  style,
}: {
  title: string;
  action?: ReactNode;
  flush?: boolean;
  children: ReactNode;
  style?: CSSProperties;
}) {
  const heading = <div style={{ fontWeight: 700, fontSize: 16, color: '#211c38' }}>{title}</div>;

  if (flush) {
    return (
      <Card style={{ padding: 0, overflow: 'hidden', ...style }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #f1eef8', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          {heading}
          {action}
        </div>
        {children}
      </Card>
    );
  }

  return (
    <Card style={style}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
        {heading}
        {action}
      </div>
      {children}
    </Card>
  );
}
