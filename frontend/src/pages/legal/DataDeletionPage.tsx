import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { getDataDeletionStatus, type DataDeletionStatus } from '../../api/legal';
import LegalPage from './LegalPage';
import { C } from '../../styles/colors';

// /data-deletion — hướng dẫn xoá dữ liệu; có ?code= (Meta dẫn về sau khi user gửi yêu cầu xoá)
// thì tra cứu và hiện trạng thái yêu cầu ngay đầu trang.
export default function DataDeletionPage() {
  const { t, lang } = useApp();
  const [searchParams] = useSearchParams();
  const code = searchParams.get('code')?.trim() ?? '';
  const [status, setStatus] = useState<DataDeletionStatus | null>(null);
  const [state, setState] = useState<'idle' | 'loading' | 'done' | 'notFound'>('idle');

  useEffect(() => {
    if (!code) return;
    let cancelled = false;
    setState('loading');
    getDataDeletionStatus(code)
      .then((s) => { if (!cancelled) { setStatus(s); setState('done'); } })
      .catch(() => { if (!cancelled) setState('notFound'); });
    return () => { cancelled = true; };
  }, [code]);

  const fmt = (iso: string | null) =>
    iso ? new Date(iso).toLocaleString(lang === 'vi' ? 'vi-VN' : 'en-US') : '—';

  const rows: [string, string][] = status
    ? [
        [t.lgStatusCode, status.confirmationCode],
        [t.lgStatusState, t.lgStatusDone],
        [t.lgStatusRequestedAt, fmt(status.requestedAt)],
        [t.lgStatusCompletedAt, fmt(status.completedAt)],
        [t.lgStatusConnections, String(status.connectionsRemoved)],
        [t.lgStatusSchedules, String(status.schedulesHeld)],
      ]
    : [];

  return (
    <LegalPage docKey="dataDeletion">
      {code && (
        <div role="status" aria-live="polite" style={{ marginTop: 24, border: `1px solid ${C.legacyBordere6dcfb}`, background: C.bg, borderRadius: 16, padding: '18px 20px' }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: C.textStrong, marginBottom: 10 }}>{t.lgStatusTitle}</div>
          {state === 'loading' && <div style={{ fontSize: 14, color: C.textSecondary }}>{t.lgStatusLoading}</div>}
          {state === 'notFound' && <div style={{ fontSize: 14, color: C.legacyTextb42318 }}>{t.lgStatusNotFound}</div>}
          {state === 'done' && (
            <dl style={{ margin: 0, display: 'grid', gridTemplateColumns: 'minmax(140px, auto) 1fr', gap: '6px 16px', fontSize: 14 }}>
              {rows.map(([label, value]) => (
                <div key={label} style={{ display: 'contents' }}>
                  <dt style={{ color: C.textSecondary }}>{label}</dt>
                  <dd style={{ margin: 0, color: C.textStrong, fontWeight: 600, wordBreak: 'break-all' }}>{value}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      )}
    </LegalPage>
  );
}
