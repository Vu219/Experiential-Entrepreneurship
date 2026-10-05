// QA-only entry: served by Vite for verify-shared.mjs, never imported by the app.
import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider, useAuth } from '../../src/auth/AuthContext';
import { useAppStore } from '../../src/store/useAppStore';
import Modal from '../../src/components/Modal';
import Drawer from '../../src/components/Drawer';
import ConfirmModal from '../../src/components/ConfirmModal';
import DatePicker from '../../src/components/DatePicker';
import OnboardingModal from '../../src/components/OnboardingModal';
import ChangePasswordModal from '../../src/components/ChangePasswordModal';
import Settings from '../../src/pages/Settings';
import { ToastProvider, useToast } from '../../src/components/toast/ToastProvider';
import '../../src/index.css';

const baseline = location.port === '3101';
const sync = baseline ? () => {} : (await import(/* @vite-ignore */ '/src/hooks/useColorModeSync.ts')).useColorModeSync;
function Preview() {
  sync();
  const { loading } = useAuth();
  const kind = new URLSearchParams(location.search).get('preview') || 'modal';
  const [open, setOpen] = useState(true);
  const [date, setDate] = useState('2026-10-15');
  const toast = useToast();
  useEffect(() => {
    if (kind === 'toast') for (const variant of ['success', 'error', 'warning', 'info', 'loading'] as const) {
      toast[variant]('Thông báo mẫu để kiểm tra chữ, màu nền và thao tác đóng.', { duration: 999999 });
    }
  }, [kind, toast]);
  if (loading) return null;
  const close = () => setOpen(false);
  const body = <><p>Thông tin chi tiết và nội dung cần xem lại.</p><input aria-label="Nội dung" placeholder="Nhập nội dung" /><button>Hoàn tất</button></>;
  return <main style={{ padding: 24, maxWidth: 1100, margin: 'auto' }}>
    <button data-trigger onClick={() => setOpen(true)}>Mở lại</button>
    {!baseline && <button data-dark onClick={() => useAppStore.getState().setColorMode('dark')}>Tối</button>}
    {kind === 'settings' && <Settings />}
    {kind === 'date' && <div style={{ maxWidth: 320, margin: '190px auto 0' }}><DatePicker value={date} onChange={setDate} min="2026-10-05" max="2026-10-25" ariaLabel="Ngày đăng" /><output>{date}</output></div>}
    {open && kind === 'modal' && <Modal title="Xem chi tiết" subtitle="Kiểm tra giao diện dùng chung" onClose={close}>{body}</Modal>}
    {open && kind === 'drawer' && <Drawer title="Chi tiết bài viết" onClose={close} footer={<button>Đóng panel</button>}>{body}</Drawer>}
    {open && kind === 'docked' && <Drawer title="Chi tiết bài viết" variant="docked" width={280} onClose={close}>{body}</Drawer>}
    {open && kind === 'confirm' && <ConfirmModal title="Xóa hồ sơ?" message="Bạn có muốn xóa hồ sơ thương hiệu này?" confirmLabel="Xóa hồ sơ" onClose={close} onConfirm={close} />}
    {open && kind === 'onboarding' && <OnboardingModal onClose={close} />}
    {open && kind === 'password' && <ChangePasswordModal onClose={close} onSuccess={() => toast.success('Đã đổi mật khẩu')} />}
  </main>;
}
createRoot(document.getElementById('root')!).render(<BrowserRouter><AuthProvider><ToastProvider><Preview /></ToastProvider></AuthProvider></BrowserRouter>);
