import { useEffect, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Card, Loader } from '../ui';
import Switch from '../admin/Switch';
import { useToast } from '../toast/ToastProvider';
import type { ApiError } from '../../api/apiClient';
import {
  getNotificationPreferences, updateEmailPublishErrors, type NotificationPreferences,
} from '../../api/notificationPreferences';
import { formatDateTimeVN } from '../../utils/format';
import { C } from '../../styles/colors';

// Cài đặt → Thông báo: email khi bài đăng cần xử lý (opt-in, failed-posts đợt 2 — C). Lưu ngay khi bật/tắt;
// thông báo trong ứng dụng không phụ thuộc lựa chọn này.

export default function PublishErrorEmailCard() {
  const { t } = useApp();
  const toast = useToast();
  const [prefs, setPrefs] = useState<NotificationPreferences | null>(null);
  const [load, setLoad] = useState<'loading' | 'error' | 'ok'>('loading');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getNotificationPreferences()
      .then((p) => { setPrefs(p); setLoad('ok'); })
      .catch(() => setLoad('error'));
  }, []);

  const toggle = async (enable: boolean) => {
    if (saving) return;
    setSaving(true);
    try {
      setPrefs(await updateEmailPublishErrors(enable));
      toast.success(t.seEmailSaved);
    } catch (e) {
      toast.error((e as ApiError).message);
    } finally {
      setSaving(false);
    }
  };

  if (load === 'loading') return <Card><Loader label={t.listLoading} /></Card>;
  if (load === 'error' || !prefs) return <Card style={{ padding: 26, color: C.rose, fontSize: 13.5 }}>{t.psLoadError}</Card>;

  return (
    <Card style={{ padding: 26, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13.5, color: C.text, fontWeight: 600 }}>{t.seEmailErrors}</div>
          <div style={{ fontSize: 12, color: C.textMuted, marginTop: 2, lineHeight: 1.45 }}>{t.seEmailErrorsSub}</div>
        </div>
        <Switch checked={prefs.emailPublishErrors} onChange={toggle} title={t.seEmailErrors} />
      </div>
      {prefs.emailPublishErrors && prefs.consentAt && (
        <div style={{ fontSize: 11.5, color: C.textMuted }}>
          {t.seEmailConsentAt.replace('{time}', formatDateTimeVN(prefs.consentAt))}
        </div>
      )}
      {!prefs.emailAvailable && <div style={{ fontSize: 12, color: C.amberText }}>{t.seEmailUnavailable}</div>}
      <div style={{ fontSize: 11.5, color: C.textMuted }}>{t.seInAppAlways}</div>
    </Card>
  );
}
