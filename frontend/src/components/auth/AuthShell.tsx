import type { ReactNode } from 'react';
import { ChevronLeft } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import { LangButton } from '../AppShell';
import ColorModeToggle from '../ColorModeToggle';
import AuthBackdrop from './AuthBackdrop';
import AuthBrandPanel, { type AuthMode } from './AuthBrandPanel';
import { alpha, C } from '../../styles/colors';

// Khung chung của đăng nhập / đăng ký / quên mật khẩu / hoàn tất hồ sơ.
// Desktop (≥ 960px): card nổi chia đôi — form phải, nửa thông tin trái; riêng "register" đảo lại.
// Hai nửa là lớp tuyệt đối trượt ngang (.auth-slide), nên đổi mode trên CÙNG một trang
// (/login ↔ /register dùng chung component Auth) là một chuyển động liền.
// Màn hẹp: một cột — dải thông tin + (tuỳ chọn) tab Đăng nhập | Đăng ký + form.
// overflow: clip (không phải hidden) để ô nhập tự focus trong lúc trượt không cuộn lệch card.

export const AUTH_SPLIT_MIN_WIDTH = 960;

export default function AuthShell({ mode, back, onSwitch, onTab, children }: {
  mode: AuthMode;
  /** Nút góc trên trái (mặc định không có). */
  back?: { label: string; onClick: () => void };
  /** Nút chuyển ở cuối nửa thông tin (desktop). */
  onSwitch?: () => void;
  /** Tab Đăng nhập | Đăng ký trên màn hẹp — chỉ trang Auth truyền. */
  onTab?: (m: 'login' | 'register') => void;
  children: ReactNode;
}) {
  const { t } = useApp();
  const { width } = useBreakpoint();
  const split = width >= AUTH_SPLIT_MIN_WIDTH;
  const isMobile = width < 760;
  const formLeft = mode === 'register';
  const cardShadow = `0 40px 90px -40px ${alpha(C.ink900, 0.45)}, 0 18px 40px -28px ${C.legacyShadowrgba8040140_5_}`;

  return (
    <>
      <AuthBackdrop compact={!split} />

      <div className="view-pop" style={{ position: 'relative', zIndex: 1, minHeight: '100vh', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: split ? '84px 24px 40px' : '76px 14px 28px' }}>
        <div style={{ position: 'absolute', top: 18, left: split ? 24 : 14, right: split ? 24 : 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          {back ? (
            <button className="btn-soft" onClick={back.onClick} aria-label={back.label} style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 'none', whiteSpace: 'nowrap', background: alpha(C.surface, 0.8), backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', border: `1px solid ${C.border}`, borderRadius: 999, padding: isMobile ? 9 : '8px 16px 8px 10px', fontSize: 14, fontWeight: 600, color: C.ink650, cursor: 'pointer' }}>
              <ChevronLeft size={18} color={C.textSecondary} strokeWidth={1.8} />
              {!isMobile && back.label}
            </button>
          ) : <span />}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 'none', whiteSpace: 'nowrap' }}>
            <LangButton />
            <ColorModeToggle />
          </div>
        </div>

        {split ? (
          <div style={{ position: 'relative', width: 'min(1120px, 100%)', height: 'clamp(640px, calc(100vh - 124px), 860px)', borderRadius: 28, overflow: 'clip', background: C.surface, border: `1px solid ${C.border}`, boxShadow: cardShadow }}>
            <div className="auth-slide" style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: '50%', transform: `translateX(${formLeft ? 0 : 100}%)`, overflowY: 'auto', display: 'flex' }}>
              <div style={{ margin: 'auto', width: '100%', maxWidth: 580, padding: '24px 44px', boxSizing: 'border-box' }}>{children}</div>
            </div>
            <div className="auth-slide" style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: '50%', zIndex: 2, transform: `translateX(${formLeft ? 100 : 0}%)`, background: C.authPanel }}>
              <AuthBrandPanel mode={mode} onSwitch={onSwitch} />
            </div>
          </div>
        ) : (
          <div style={{ width: '100%', maxWidth: 480, borderRadius: 24, overflow: 'clip', background: C.surface, border: `1px solid ${C.border}`, boxShadow: cardShadow }}>
            <AuthBrandPanel mode={mode} variant="strip" />
            {onTab && (mode === 'login' || mode === 'register') && (
              <AuthTabs active={mode} onChange={onTab} labels={[t.authTabLogin, t.authTabRegister]} />
            )}
            <div style={{ padding: '22px 20px 26px' }}>{children}</div>
          </div>
        )}
      </div>
    </>
  );
}

// Tab Đăng nhập | Đăng ký trên màn hẹp — vạch nền trượt theo tab đang chọn.
function AuthTabs({ active, onChange, labels }: { active: 'login' | 'register'; onChange: (m: 'login' | 'register') => void; labels: [string, string] }) {
  const modes = ['login', 'register'] as const;
  return (
    <div role="tablist" style={{ position: 'relative', display: 'grid', gridTemplateColumns: '1fr 1fr', margin: '16px 20px 0', padding: 4, borderRadius: 14, background: C.surfaceMuted }}>
      <span aria-hidden className="auth-tab-indicator" style={{ position: 'absolute', top: 4, bottom: 4, left: 4, width: 'calc(50% - 4px)', borderRadius: 11, background: C.surface, boxShadow: `0 6px 16px -10px ${alpha(C.ink900, 0.4)}`, transform: `translateX(${active === 'register' ? 100 : 0}%)` }} />
      {modes.map((m, i) => (
        <button
          key={m} type="button" role="tab" aria-selected={active === m}
          onClick={() => { if (active !== m) onChange(m); }}
          style={{ position: 'relative', border: 'none', background: 'transparent', padding: '10px 0', fontSize: 14.5, fontWeight: 700, color: active === m ? C.textStrong : C.textMuted, cursor: 'pointer' }}
        >
          {labels[i]}
        </button>
      ))}
    </div>
  );
}
