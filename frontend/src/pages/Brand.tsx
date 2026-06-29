import { useEffect, useState } from 'react';
import { HelpCircle } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useUiStore } from '../store/useUiStore';
import { Icon } from '../components/ui';
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
        {tab === 'strategy' && (
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
            <a href="#" onClick={(e) => e.preventDefault()} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 13, fontWeight: 700, color: '#7c3aed', background: '#f4ecff', border: '1px solid #e7d9fb', borderRadius: 10, padding: '9px 14px', cursor: 'pointer' }}>
              <Icon icon={HelpCircle} size={16} stroke="#7c3aed" />{t.csGuide}
            </a>
          </div>
        )}
      </div>

      {tab === 'brand' ? <BrandProfileList /> : <StrategyManager />}
    </div>
  );
}
