import { useCallback } from 'react';
import { useApp } from '../context/AppContext';
import { useAppStore } from '../store/useAppStore';
import { useUiStore } from '../store/useUiStore';
import type { ActionId, SearchTarget } from '../search/types';

/**
 * Thực thi đích của một mục TĨNH trong ô tìm kiếm toàn cục: đi tới trang/tab, tới khu vực trong trang
 * (`?focus=` → hooks/useSectionFocus cuộn + tô sáng) hoặc chạy hành động nhanh. Tách khỏi registry vì cần hook.
 */
export function useSearchActions() {
  const { go, toggleLang, logout } = useApp();
  const setColorMode = useAppStore((s) => s.setColorMode);

  const runAction = useCallback((action: ActionId) => {
    const ui = useUiStore.getState();
    switch (action) {
      case 'createContent':
        go('createWizard');
        return;
      case 'newStrategy':
        // Cùng cơ chế nút "Tạo chiến lược mới" ở trang Thương hiệu: mở tab Chiến lược rồi bắn nonce mở form.
        go('brand', '?tab=strategy&new=1');
        return;
      case 'researchNow':
        go('trends', '?research=1');
        return;
      case 'connectFacebook':
      case 'connectInstagram':
      case 'connectThreads':
        // Chốt: không mở OAuth trực tiếp — chọn Trang/kênh và xem lỗi ở tab Kết nối.
        go('settings', '?tab=connections');
        return;
      case 'toggleLang':
        toggleLang();
        return;
      case 'colorLight':
        setColorMode('light');
        return;
      case 'colorDark':
        setColorMode('dark');
        return;
      case 'colorSystem':
        setColorMode('system');
        return;
      case 'openNotifications':
        ui.setNotificationsOpen(true);
        return;
      case 'logout':
        logout();
        return;
    }
  }, [go, toggleLang, logout, setColorMode]);

  return useCallback((target: SearchTarget) => {
    if (target.kind === 'route') go(target.route, target.search);
    else if (target.kind === 'section') go(target.route, `?focus=${encodeURIComponent(target.sectionId)}`);
    else runAction(target.action);
  }, [go, runAction]);
}
