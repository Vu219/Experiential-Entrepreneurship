import { useEffect, useState } from 'react';
import { Lock } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../auth/AuthContext';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import { Card, Loader } from '../ui';
import Switch from '../admin/Switch';
import { useToast } from '../toast/ToastProvider';
import type { ApiError } from '../../api/apiClient';
import {
  getNotificationPreferences, updateEmailPublishErrors, updateNotificationChannel,
  type NotificationChannel, type NotificationPreferences,
} from '../../api/notificationPreferences';
import { formatDateTimeVN } from '../../utils/format';
import { C } from '../../styles/colors';

/**
 * Cài đặt → Thông báo: ma trận nhóm × kênh (Trong app / Toast / Email), lưu ngay mỗi lần bật/tắt (lạc quan + toast).
 * Nhóm bắt buộc: "Trong app" khoá ở bật. Email chỉ có ở Lỗi đăng bài + Tài khoản và dùng CHUNG một đồng ý
 * (`emailPublishErrors`, có link huỷ nhận trong email) — D8. Nhóm Quản trị chỉ admin thấy.
 */
export default function NotificationChannelsCard() {
  const { t } = useApp();
  const { user } = useAuth();
  const { isMobile } = useBreakpoint();
  const toast = useToast();
  const [prefs, setPrefs] = useState<NotificationPreferences | null>(null);
  const [load, setLoad] = useState<'loading' | 'error' | 'ok'>('loading');
  const [saving, setSaving] = useState(false);
  const dict = t as unknown as Record<string, string>;
  const isAdmin = user?.role === 'ADMIN';

  useEffect(() => {
    getNotificationPreferences()
      .then((p) => { setPrefs(p); setLoad('ok'); })
      .catch(() => setLoad('error'));
  }, []);

  const save = async (optimistic: NotificationPreferences, request: () => Promise<NotificationPreferences>) => {
    if (saving || !prefs) return;
    const previous = prefs;
    setPrefs(optimistic);
    setSaving(true);
    try {
      setPrefs(await request());
      toast.success(t.seNtfSaved);
    } catch (e) {
      setPrefs(previous);
      toast.error((e as ApiError).message);
    } finally {
      setSaving(false);
    }
  };

  const setChannel = (row: NotificationChannel, change: { inApp?: boolean; toast?: boolean }) => {
    if (!prefs?.channels) return;
    const channels = prefs.channels.map((c) => (c.category === row.category ? { ...c, ...change } : c));
    save({ ...prefs, channels }, () => updateNotificationChannel(row.category, change));
  };

  const setEmail = (enable: boolean) => {
    if (!prefs) return;
    save({ ...prefs, emailPublishErrors: enable }, () => updateEmailPublishErrors(enable));
  };

  if (load === 'loading') return <Card><Loader label={t.listLoading} /></Card>;
  if (load === 'error' || !prefs) return <Card style={{ padding: 26, color: C.rose, fontSize: 13.5 }}>{t.seNtfLoadErr}</Card>;

  const rows = (prefs.channels ?? []).filter((c) => !c.adminOnly || isAdmin);

  const inAppCell = (row: NotificationChannel) => row.mandatoryInApp ? (
    <span title={t.seNtfLocked} aria-label={`${t.seNtfColInApp}: ${t.seNtfLocked}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <Switch checked disabled onChange={() => undefined} title={t.seNtfLocked} />
      <Lock size={13} color={C.ink350} aria-hidden />
    </span>
  ) : (
    <Switch checked={row.inApp} onChange={(v) => setChannel(row, { inApp: v })} title={`${dict[`ntfCat_${row.category}`]} — ${t.seNtfColInApp}`} />
  );

  const toastCell = (row: NotificationChannel) => (
    <Switch
      checked={row.inApp && row.toast}
      disabled={!row.inApp}
      onChange={(v) => setChannel(row, { toast: v })}
      title={row.inApp ? `${dict[`ntfCat_${row.category}`]} — ${t.seNtfColToast}` : t.seNtfToastNeedsInApp}
    />
  );

  const emailCell = (row: NotificationChannel) => row.emailCapable ? (
    <Switch checked={prefs.emailPublishErrors} onChange={setEmail} title={`${t.seNtfColEmail} — ${t.seNtfEmailShared}`} />
  ) : (
    <span title={t.seNtfNoEmail} aria-label={t.seNtfNoEmail} style={{ color: C.ink350, fontSize: 13 }}>—</span>
  );

  const label = (row: NotificationChannel) => (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: 13.5, fontWeight: 600, color: C.text }}>{dict[`ntfCat_${row.category}`]}</div>
      <div style={{ fontSize: 12, color: C.textMuted, marginTop: 2, lineHeight: 1.45 }}>{dict[`seNtfDesc_${row.category}`]}</div>
    </div>
  );

  const colHead = { fontSize: 11.5, fontWeight: 700, color: C.textMuted, textTransform: 'uppercase' as const, letterSpacing: 0.4 };

  return (
    <Card style={{ padding: isMobile ? 18 : 26, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div>
        <div style={{ fontWeight: 700, fontSize: 16, color: C.textStrong }}>{t.seNtfMatrixTitle}</div>
        <div style={{ fontSize: 12.5, color: C.textMuted, marginTop: 4, lineHeight: 1.5 }}>{t.seNtfMatrixSub}</div>
      </div>

      {isMobile ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {rows.map((row) => (
            <div key={row.category} style={{ border: `1px solid ${C.border}`, borderRadius: 14, padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {label(row)}
              {([[t.seNtfColInApp, inAppCell(row)], [t.seNtfColToast, toastCell(row)], [t.seNtfColEmail, emailCell(row)]] as const).map(([name, cell]) => (
                <div key={name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                  <span style={{ fontSize: 13, color: C.textSecondary }}>{name}</span>
                  {cell}
                </div>
              ))}
            </div>
          ))}
        </div>
      ) : (
        <div role="table" aria-label={t.seNtfMatrixTitle} style={{ display: 'flex', flexDirection: 'column' }}>
          <div role="row" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 96px 96px 96px', gap: 12, padding: '0 0 10px', borderBottom: `1px solid ${C.border}` }}>
            <span role="columnheader" style={colHead}>{t.seNtfColGroup}</span>
            <span role="columnheader" style={{ ...colHead, textAlign: 'center' }}>{t.seNtfColInApp}</span>
            <span role="columnheader" style={{ ...colHead, textAlign: 'center' }}>{t.seNtfColToast}</span>
            <span role="columnheader" style={{ ...colHead, textAlign: 'center' }}>{t.seNtfColEmail}</span>
          </div>
          {rows.map((row) => (
            <div key={row.category} role="row" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 96px 96px 96px', gap: 12, alignItems: 'center', padding: '12px 0', borderBottom: `1px solid ${C.surfaceMuted}` }}>
              <div role="cell">{label(row)}</div>
              <div role="cell" style={{ display: 'flex', justifyContent: 'center' }}>{inAppCell(row)}</div>
              <div role="cell" style={{ display: 'flex', justifyContent: 'center' }}>{toastCell(row)}</div>
              <div role="cell" style={{ display: 'flex', justifyContent: 'center' }}>{emailCell(row)}</div>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ fontSize: 11.5, color: C.textMuted }}>{t.seNtfEmailShared} {t.seEmailErrorsSub}</div>
        {prefs.emailPublishErrors && prefs.consentAt && (
          <div style={{ fontSize: 11.5, color: C.textMuted }}>
            {t.seEmailConsentAt.replace('{time}', formatDateTimeVN(prefs.consentAt))}
          </div>
        )}
        {!prefs.emailAvailable && <div style={{ fontSize: 12, color: C.amberText }}>{t.seEmailUnavailable}</div>}
      </div>
    </Card>
  );
}
