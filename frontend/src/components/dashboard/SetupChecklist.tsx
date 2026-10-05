import { memo } from 'react';
import { Check } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useUiStore } from '../../store/useUiStore';
import { Card } from '../ui';
import type { DashboardOnboarding } from '../../api/dashboard';
import { C } from '../../styles/colors';

/**
 * FR-86 — "Hoàn tất thiết lập AIMA": 4 bước, hiển thị tiến độ x/4 và TỰ ẨN khi đủ 4/4.
 * Trạng thái từng bước do backend suy ra từ dữ liệu thật (không có cột onboarding trong DB),
 * nên thẻ tự hiện lại nếu user xóa hết kết nối/chiến lược — luôn phản ánh đúng thực tế.
 */
function SetupChecklist({ onboarding }: { onboarding: DashboardOnboarding }) {
  const { t, brandGradient, go } = useApp();
  const setBrandInitialTab = useUiStore((s) => s.setBrandInitialTab);

  // Ẩn hẳn khi xong — đây là thẻ hướng dẫn khởi đầu, không phải số liệu thường trực.
  if (onboarding.completed >= onboarding.total) return null;

  const steps: { key: keyof DashboardOnboarding; label: string; onClick: () => void }[] = [
    { key: 'brand', label: t.dbsBrand, onClick: () => go('brand') },
    { key: 'connection', label: t.dbsConnect, onClick: () => go('settings') },
    { key: 'strategy', label: t.dbsStrategy, onClick: () => { setBrandInitialTab('strategy'); go('brand'); } },
    { key: 'content', label: t.dbsContent, onClick: () => go('create') },
  ];

  return (
    <Card>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: 16, color: C.textStrong }}>{t.dbsTitle}</div>
          <div style={{ fontSize: 12.5, color: C.textSecondary, marginTop: 2 }}>{t.dbsSub}</div>
        </div>
        <span style={{ fontSize: 13, fontWeight: 800, color: C.primary }}>
          {onboarding.completed}/{onboarding.total}
        </span>
      </div>

      <div style={{ height: 8, borderRadius: 99, background: C.surfaceMuted, overflow: 'hidden', margin: '12px 0 16px' }}>
        <div style={{
          height: '100%', borderRadius: 99, background: brandGradient, transition: 'width .3s',
          width: `${(onboarding.completed / onboarding.total) * 100}%`,
        }} />
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {steps.map((step) => {
          const done = Boolean(onboarding[step.key]);
          return (
            <button
              key={step.key}
              onClick={step.onClick}
              disabled={done}
              style={{
                display: 'flex', alignItems: 'center', gap: 7, borderRadius: 11, padding: '9px 14px',
                fontSize: 12.5, fontWeight: 700, cursor: done ? 'default' : 'pointer',
                border: `1px solid ${done ? C.successLine : C.border}`,
                background: done ? C.successTint : C.surface,
                color: done ? C.success : C.ink650,
              }}
            >
              <span style={{
                width: 18, height: 18, borderRadius: '50%', display: 'flex', alignItems: 'center',
                justifyContent: 'center', background: done ? '#16a34a' : C.border, color: '#fff',
              }}>
                {done ? <Check size={12} /> : <span style={{ width: 6, height: 6, borderRadius: '50%', background: C.ink350 }} />}
              </span>
              {step.label}
            </button>
          );
        })}
      </div>
    </Card>
  );
}

export default memo(SetupChecklist);
