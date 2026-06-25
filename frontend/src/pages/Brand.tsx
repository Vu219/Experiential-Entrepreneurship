import { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import { useUiStore } from '../store/useUiStore';
import { Icon } from '../components/ui';
import { resetMockData } from '../api/mockSeed';
import BrandProfileList from '../components/brand/BrandProfileList';
import StrategyManager from '../components/brand/StrategyManager';

type Tab = 'brand' | 'strategy';

/**
 * /brand — màn list-first gộp 2 tab: "Thương hiệu" (hồ sơ thương hiệu, danh sách
 * card) và "Chiến lược content" (list-left + detail-right). Tiêu đề trang do Topbar lo.
 */
export default function Brand() {
  const { t, brandGradient } = useApp();
  const [tab, setTab] = useState<Tab>('brand');
  const setSidebarCollapsed = useUiStore((s) => s.setSidebarCollapsed);

  // Tự thu gọn sidebar khi ở trang Hồ sơ thương hiệu để có không gian rộng hơn cho
  // form full-page; trả lại trạng thái trước đó khi rời trang (dùng đúng cơ chế collapse
  // sẵn có). Bỏ qua nếu user đang bật chế độ auto-collapse (hover-to-expand).
  useEffect(() => {
    const ui = useUiStore.getState();
    if (ui.autoCollapse) return;
    const prev = ui.sidebarCollapsed;
    setSidebarCollapsed(true);
    return () => setSidebarCollapsed(prev);
  }, [setSidebarCollapsed]);

  // Nút tiện dụng để xem lại UI với dữ liệu mẫu sạch (mock localStorage, không gọi backend).
  const onReset = () => { resetMockData(); window.location.reload(); };

  const tabBtn = (key: Tab, label: string) => {
    const active = tab === key;
    return (
      <button
        key={key}
        onClick={() => setTab(key)}
        style={{ border: 'none', background: active ? brandGradient : 'transparent', color: active ? '#fff' : '#5b5670', borderRadius: 11, padding: '9px 18px', fontSize: 14, fontWeight: 700, cursor: 'pointer', boxShadow: active ? '0 12px 24px -14px rgba(139,92,246,.8)' : 'none', transition: 'background .15s' }}
      >
        {label}
      </button>
    );
  };

  return (
    <div className="view-pop" style={{ maxWidth: 1180, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 6, background: '#fff', border: '1px solid #efeaf8', borderRadius: 14, padding: 5 }}>
          {tabBtn('brand', t.bpTabBrand)}
          {tabBtn('strategy', t.bpTabStrategy)}
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          {tab === 'strategy' && (
            <a href="#" onClick={(e) => e.preventDefault()} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 13, fontWeight: 700, color: '#7c3aed', background: '#f4ecff', border: '1px solid #e7d9fb', borderRadius: 10, padding: '9px 14px', cursor: 'pointer' }}>
              <Icon path="M12 17h.01M12 13a2 2 0 10-2-2 M12 21a9 9 0 110-18 9 9 0 010 18z" size={16} stroke="#7c3aed" />{t.csGuide}
            </a>
          )}
          {/* MOCK: reset & nạp lại dữ liệu mẫu (xem api/mockSeed.ts). Bỏ khi nối backend thật. */}
          <button onClick={onReset} title={t.bpResetMock} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 13, fontWeight: 700, color: '#6b6680', background: '#f4f2fb', border: '1px solid #ece8f6', borderRadius: 10, padding: '9px 14px', cursor: 'pointer' }}>
            <Icon path="M3 12a9 9 0 1 0 3-6.7L3 8M3 4v4h4" size={15} stroke="#6b6680" />{t.bpResetMock}
          </button>
        </div>
      </div>

      {tab === 'brand' ? <BrandProfileList /> : <StrategyManager />}
    </div>
  );
}
