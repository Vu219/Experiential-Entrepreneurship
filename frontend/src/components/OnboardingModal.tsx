import { Building2, PencilRuler, Share2, Sparkles } from 'lucide-react';
import Modal from './Modal';
import { useApp } from '../context/AppContext';
import { C } from '../styles/colors';

const DISMISS_KEY = 'aima.onboarding.dismissed';

export const isOnboardingDismissed = (): boolean => {
  try {
    return localStorage.getItem(DISMISS_KEY) === '1';
  } catch {
    return true;
  }
};

const dismiss = () => {
  try {
    localStorage.setItem(DISMISS_KEY, '1');
  } catch {
    // localStorage bị chặn (private mode) — modal chỉ không nhớ trạng thái, không sao.
  }
};

/**
 * FR-85 — chào mừng lần đầu: giới thiệu 4 bước thiết lập (hồ sơ thương hiệu → kết nối MXH →
 * chiến lược → nội dung đầu tiên). Các bước dùng chính các trang thật; tiến độ theo dõi bằng
 * thẻ FR-86 trên Dashboard. Chỉ hiện khi user chưa làm bước nào và chưa từng đóng modal.
 */
export default function OnboardingModal({ onClose }: { onClose: () => void }) {
  const { t, brandGradient, go } = useApp();

  const close = () => {
    dismiss();
    onClose();
  };
  const start = () => {
    dismiss();
    onClose();
    go('brand');
  };

  const steps = [
    { icon: Building2, title: t.dbsBrand, sub: t.obBrandSub },
    { icon: Share2, title: t.dbsConnect, sub: t.obConnectSub },
    { icon: PencilRuler, title: t.dbsStrategy, sub: t.obStrategySub },
    { icon: Sparkles, title: t.dbsContent, sub: t.obContentSub },
  ];

  return (
    <Modal title={t.obTitle} subtitle={t.obSub} onClose={close} maxWidth={480} animateScale>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {steps.map((s, i) => (
          <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', border: `1px solid ${C.border}`, borderRadius: 13, padding: '12px 14px', background: C.surfaceSubtle }}>
            <span style={{ width: 36, height: 36, flex: 'none', borderRadius: 11, background: C.purpleSoft, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <s.icon size={17} color={C.primary} />
            </span>
            <div>
              <div style={{ fontSize: 13.5, fontWeight: 800, color: C.textStrong }}>
                <span style={{ color: C.ink350, marginRight: 6 }}>{i + 1}.</span>{s.title}
              </div>
              <div style={{ fontSize: 12.5, color: C.textSecondary, lineHeight: 1.5, marginTop: 2 }}>{s.sub}</div>
            </div>
          </div>
        ))}

        <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
          <button onClick={close} style={{ flex: 1, border: `1px solid ${C.border}`, background: C.surface, borderRadius: 12, padding: '12px 16px', fontSize: 13.5, fontWeight: 700, color: C.ink550, cursor: 'pointer' }}>
            {t.obLater}
          </button>
          <button onClick={start} className="btn-grad" style={{ flex: 2, border: 'none', borderRadius: 12, padding: '12px 16px', fontSize: 13.5, fontWeight: 800, color: C.onBrand, background: brandGradient, cursor: 'pointer' }}>
            {t.obStart}
          </button>
        </div>
      </div>
    </Modal>
  );
}
