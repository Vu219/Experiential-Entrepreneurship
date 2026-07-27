import { AlertTriangle } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Icon } from '../ui';
import { TONE_COLORS } from '../../statusTokens';

/**
 * Lỗi ở CẤP MỘT KHỐI (không phải cả trang): giữ nguyên khung card của khối, chỉ thay phần thân
 * bằng thông báo + nút Thử lại. Trang Tổng quan tải nhiều nguồn độc lập nên một khối hỏng không
 * được phép làm mất các khối còn lại.
 *
 * Cùng ngôn ngữ hình ảnh với trạng thái lỗi của `AdminListPage` (icon tam giác nền đỏ nhạt,
 * nút gradient thương hiệu), chỉ gọn hơn để nhét vừa trong một card.
 */
export default function BlockError({ onRetry, message }: { onRetry: () => void; message?: string }) {
  const { t, brandGradient } = useApp();
  const danger = TONE_COLORS.danger;

  return (
    <div style={{ textAlign: 'center', padding: '30px 16px', color: '#8a85a0' }}>
      <div style={{ width: 42, height: 42, borderRadius: 12, background: danger.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
        <Icon icon={AlertTriangle} size={19} stroke={danger.color} />
      </div>
      <div style={{ fontSize: 13.5, fontWeight: 600, color: '#5b5670', marginBottom: 12 }}>
        {message ?? t.listError}
      </div>
      <button
        onClick={onRetry}
        style={{ border: 'none', borderRadius: 10, padding: '8px 16px', fontWeight: 700, fontSize: 12.5, color: '#fff', background: brandGradient, cursor: 'pointer' }}
      >
        {t.retry}
      </button>
    </div>
  );
}
