import { useState } from 'react';
import { C } from '../../styles/colors';

/**
 * Avatar người dùng: hiển thị ảnh thật; nếu không có URL hoặc ảnh lỗi (onError) thì
 * fallback về initials trên nền brandGradient. Dùng chung ở bảng danh sách & modal chi tiết.
 */
export default function Avatar({
  url,
  initials,
  size = 32,
  gradient,
}: {
  url?: string;
  initials: string;
  size?: number;
  gradient: string;
}) {
  const [broken, setBroken] = useState(false);
  const base = { width: size, height: size, flex: 'none' as const, borderRadius: '50%' };

  if (url && !broken) {
    return (
      <img
        src={url}
        alt={initials}
        onError={() => setBroken(true)}
        style={{ ...base, objectFit: 'cover' }}
      />
    );
  }
  return (
    <span
      style={{
        ...base,
        background: gradient,
        color: C.onBrand,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: size * 0.38,
        fontWeight: 700,
      }}
    >
      {initials}
    </span>
  );
}
