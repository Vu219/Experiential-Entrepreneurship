import { Lock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { Card } from './ui';
import { planLimitLabel, type PlanLimitKey } from '../api/planLimits';
import { C } from '../styles/colors';

/** Ô thay cho một khối tính năng gói hiện tại chưa gồm (V18) — nói rõ tính năng gì + nút nâng cấp. */
export default function PlanLockedCard({ feature, minHeight = 160 }: { feature: PlanLimitKey; minHeight?: number }) {
  const { t, brandGradient } = useApp();
  const navigate = useNavigate();
  const label = planLimitLabel(t as unknown as Record<string, string>, feature);
  return (
    <Card style={{ minHeight, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, textAlign: 'center', padding: 20 }}>
      <span aria-hidden style={{ width: 40, height: 40, borderRadius: 12, background: C.surfaceMuted, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Lock size={18} strokeWidth={2.2} color={C.textMuted} />
      </span>
      <div style={{ fontWeight: 800, fontSize: 14.5, color: C.textStrong }}>{t.plgLockedTitle}</div>
      <div style={{ fontSize: 13, color: C.textMuted, maxWidth: 320 }}>{t.plgLockedDesc.replace('{feature}', label)}</div>
      <button onClick={() => navigate('/billing')} className="btn-grad"
        style={{ border: 'none', borderRadius: 10, padding: '8px 16px', fontWeight: 700, fontSize: 13, color: C.onBrand, background: brandGradient, cursor: 'pointer' }}>
        {t.plgUpgrade}
      </button>
    </Card>
  );
}
