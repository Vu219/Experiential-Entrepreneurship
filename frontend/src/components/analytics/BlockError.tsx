import { RefreshCw } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Card } from '../ui';

/**
 * Trạng thái lỗi của MỘT khối trên trang Phân tích. Mỗi khối tải độc lập nên một khối hỏng chỉ
 * thay chỗ của chính nó (kèm nút "Thử lại"), không làm sập cả trang.
 */
export default function BlockError({ onRetry, minHeight = 180 }: { onRetry: () => void; minHeight?: number }) {
  const { t } = useApp();
  return (
    <Card>
      <div style={{
        minHeight, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        gap: 12, textAlign: 'center', padding: '20px 16px',
      }}>
        <div style={{ fontSize: 13.5, color: '#8a85a0' }}>{t.anaBlockError}</div>
        <button type="button" onClick={onRetry} style={{
          display: 'inline-flex', alignItems: 'center', gap: 7, minHeight: 44, padding: '0 16px',
          border: '1px solid #ece8f6', background: '#fff', borderRadius: 11,
          fontSize: 13, fontWeight: 700, color: '#7c3aed', cursor: 'pointer',
        }}>
          <RefreshCw size={15} strokeWidth={2} />
          {t.anaRetry}
        </button>
      </div>
    </Card>
  );
}
