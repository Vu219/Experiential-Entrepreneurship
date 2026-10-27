import { useEffect, useRef, useState } from 'react';
import { BarChart3, CheckCircle2, Clock, Sparkles, type LucideIcon } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useIsDark } from '../../hooks/useIsDark';
import AimaScene from '../AimaScene';
import { GradIcon } from '../ui';
import { alpha, C } from '../../styles/colors';

// Nửa thông tin của khung đăng nhập/đăng ký (nền C.authPanel — nền sáng cũ của trang, chữ theo token sáng/tối).
// variant "side": cả nửa card trên desktop — logo, tiêu đề theo chế độ, hình minh hoạ, 3 điểm mạnh
// (đăng nhập / hoàn tất hồ sơ) hoặc 3 dòng có dấu tích (đăng ký / quên mật khẩu) và nút chuyển trang.
// Nội dung đổi kèm .auth-swap (key = mode).
// variant "strip": dải đầu card trên màn hẹp — chỉ logo + tiêu đề + mô tả.

export type AuthMode = 'login' | 'register' | 'forgot' | 'profile';

const SCENE_W = 430;
const SCENE_H = 400;

function Logo({ height }: { height: number }) {
  const isDark = useIsDark();
  return <img src={isDark ? '/aima-h-dark.png' : '/aima-h.png'} alt="AIMA" style={{ height, width: 'auto', display: 'block', alignSelf: 'flex-start' }} />;
}

/** Hình minh hoạ co giãn theo chiều cao còn lại của panel (AimaScene có khung cố định 430×400). */
function FittedScene() {
  const boxRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.6);
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setScale(Math.max(0.3, Math.min(0.78, height / SCENE_H, width / SCENE_W)));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <div ref={boxRef} style={{ flex: 1, minHeight: 0, position: 'relative', margin: '8px 0' }}>
      <div style={{ position: 'absolute', left: '50%', top: '50%', width: SCENE_W, height: SCENE_H, transform: `translate(-50%, -50%) scale(${scale})` }}>
        <AimaScene />
      </div>
    </div>
  );
}

export default function AuthBrandPanel({ mode, variant = 'side', onSwitch }: { mode: AuthMode; variant?: 'side' | 'strip'; onSwitch?: () => void }) {
  const { t, lang } = useApp();
  const soft = C.ink550;
  const copy = {
    login: { title: t.authPanelLoginTitle, sub: t.authIntro, points: null, prompt: t.noAccount, action: t.authTabRegister },
    register: { title: t.authPanelRegTitle, sub: t.authPanelRegSub, points: [t.authRegPoint1, t.authRegPoint2, t.authRegPoint3], prompt: t.haveAccount, action: t.authTabLogin },
    forgot: { title: t.authPanelForgotTitle, sub: t.authPanelForgotSub, points: [t.authForgotPoint1, t.authForgotPoint2, t.authForgotPoint3], prompt: t.authRememberPw, action: t.authTabLogin },
    profile: { title: t.authPanelProfileTitle, sub: t.authPanelProfileSub, points: null, prompt: '', action: '' },
  }[mode];
  const { title, sub } = copy;

  if (variant === 'strip') {
    return (
      <div style={{ background: C.authPanel, color: C.ink900, padding: '18px 22px 22px' }}>
        <Logo height={44} />
        <div key={mode} className="auth-swap">
          <div style={{ fontFamily: "'Plus Jakarta Sans'", fontWeight: 800, fontSize: 24, letterSpacing: '-.02em', marginTop: 10 }}>{title}</div>
          <div style={{ fontSize: 14, lineHeight: 1.55, color: soft, marginTop: 6 }}>{sub}</div>
        </div>
      </div>
    );
  }

  const iconTile = { width: 42, height: 42, borderRadius: 12, flex: 'none', background: C.surface, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 10px 22px -14px ${C.legacyShadowrgba12060180_6_}` } as const;

  return (
    <div style={{ position: 'relative', height: '100%', display: 'flex', flexDirection: 'column', padding: '34px 40px 30px', boxSizing: 'border-box', color: C.ink900, overflow: 'clip' }}>
      {/* Vòng tròn trang trí */}
      <span aria-hidden style={{ position: 'absolute', width: 420, height: 420, right: -170, top: -150, borderRadius: '50%', border: `1px solid ${alpha(C.primary, 0.12)}` }} />
      <span aria-hidden style={{ position: 'absolute', width: 300, height: 300, left: -140, bottom: -120, borderRadius: '50%', background: alpha(C.primary, 0.05) }} />

      <Logo height={60} />
      <div key={mode} className="auth-swap" style={{ position: 'relative', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', marginTop: 14 }}>
        <h2 style={{ fontFamily: "'Plus Jakarta Sans'", fontWeight: 800, fontSize: 32, lineHeight: 1.15, letterSpacing: '-.02em', margin: 0, textWrap: 'balance' }}>{title}</h2>
        <p style={{ fontSize: 15, lineHeight: 1.6, color: soft, margin: '10px 0 0', maxWidth: 440 }}>{sub}</p>

        <FittedScene />

        {!copy.points ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
            {pillarsFor(lang).map((p) => (
              <div key={p.title} style={{ minWidth: 0 }}>
                <div style={iconTile}><GradIcon icon={p.icon} /></div>
                <div style={{ fontWeight: 700, fontSize: 14, marginTop: 10, color: C.textStrong }}>{p.title}</div>
                <div style={{ fontSize: 12.5, lineHeight: 1.45, color: C.textSecondary, marginTop: 3 }}>{p.desc}</div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 10 }}>
            {copy.points.map((pt) => (
              <div key={pt} style={{ display: 'flex', alignItems: 'center', gap: 11, fontSize: 14.5, fontWeight: 600, color: C.textStrong }}>
                <CheckCircle2 size={19} strokeWidth={2} color={C.success} style={{ flex: 'none' }} />
                {pt}
              </div>
            ))}
          </div>
        )}

        {onSwitch && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, marginTop: 24, paddingTop: 20, borderTop: `1px solid ${C.border}` }}>
            <span style={{ fontSize: 14, color: soft }}>{copy.prompt}</span>
            <button
              type="button"
              onClick={onSwitch}
              className="btn-outline"
              style={{ flex: 'none', border: `1.5px solid ${C.legacyBorderd9cef5}`, borderRadius: 999, padding: '10px 22px', background: C.surface, color: C.primary, fontWeight: 700, fontSize: 14, cursor: 'pointer' }}
            >
              {copy.action}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function pillarsFor(lang: 'vi' | 'en'): { icon: LucideIcon; title: string; desc: string }[] {
  return lang === 'en'
    ? [
      { icon: Sparkles, title: 'Smart', desc: 'AI analyzes and optimizes content performance' },
      { icon: Clock, title: 'Automatic', desc: 'Schedule and auto-post 24/7' },
      { icon: BarChart3, title: 'Effective', desc: 'Measure and continuously optimize strategy' },
    ]
    : [
      { icon: Sparkles, title: 'Thông minh', desc: 'AI phân tích và tối ưu hiệu quả nội dung' },
      { icon: Clock, title: 'Tự động', desc: 'Lên lịch và đăng bài tự động 24/7' },
      { icon: BarChart3, title: 'Hiệu quả', desc: 'Đo lường và tối ưu chiến lược liên tục' },
    ];
}
