import { useEffect, useState } from 'react';
import { useApp } from '../../context/AppContext';
import StatusBadge, { type Tone } from './StatusBadge';
import { getAiServiceStatus } from '../../api/adminAi';

/**
 * Badge trạng thái AI service đặt trên các trang "Cấu hình AI" — click điều hướng sang
 * trang Trạng thái hệ thống (giữ trang System riêng, không gộp vào Cấu hình AI).
 */
export default function AiServiceStatusBadge() {
  const { t, go } = useApp();
  const [status, setStatus] = useState<'loading' | 'UP' | 'DOWN' | 'UNKNOWN'>('loading');

  useEffect(() => {
    let cancelled = false;
    getAiServiceStatus().then((s) => {
      if (!cancelled) setStatus(s);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const meta: { tone: Tone; label: string } =
    status === 'UP' ? { tone: 'success', label: t.aiSvcUp }
    : status === 'DOWN' ? { tone: 'danger', label: t.aiSvcDown }
    : status === 'loading' ? { tone: 'neutral', label: t.aiSvcChecking }
    : { tone: 'neutral', label: t.aiSvcUnknown };

  return (
    <button
      onClick={() => go('adminSystem')}
      title={t.aiSvcGoto}
      style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer' }}
    >
      <StatusBadge tone={meta.tone} label={meta.label} />
    </button>
  );
}
