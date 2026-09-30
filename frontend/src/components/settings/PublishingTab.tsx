import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { useApp } from '../../context/AppContext';
import { Card, Loader } from '../ui';
import Switch from '../admin/Switch';
import { useToast } from '../toast/ToastProvider';
import type { ApiError } from '../../api/apiClient';
import { getPublishingSettings, updatePublishingSettings, type PublishingSettings } from '../../api/schedules';
import { validatePublishingSettings } from '../../validations/publishingSettingsValidation';

// Tab "Đăng bài" trong Cài đặt (Phase 2): múi giờ đăng, bắt buộc duyệt (bật/tắt áp lại cho mọi lịch
// chưa đăng — BE xử lý), cửa sổ cảnh báo trùng lịch, chặn brand voice dưới ngưỡng.

const inputStyle: CSSProperties = {
  width: '100%', border: '1.5px solid #e7e2f2', borderRadius: 11, padding: '9px 12px',
  fontSize: 13.5, color: '#241f3a', background: '#fbfaff', outline: 'none',
};
const errStyle: CSSProperties = { fontSize: 12, color: '#e23d6e', marginTop: 6 };

// Danh sách IANA của trình duyệt (lib TS của dự án chưa khai báo Intl.supportedValuesOf — ES2022);
// bảo đảm múi giờ đang lưu luôn có trong select.
const intl = Intl as typeof Intl & { supportedValuesOf?: (key: 'timeZone') => string[] };
const zoneList = (current: string): string[] => {
  const zones = intl.supportedValuesOf ? intl.supportedValuesOf('timeZone') : [];
  return zones.includes(current) ? zones : [current, ...zones];
};

function Row({ title, sub, control, children }: { title: string; sub: string; control?: ReactNode; children?: ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingTop: 18, borderTop: '1px solid #f1eef8' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13.5, color: '#3f3a55', fontWeight: 600 }}>{title}</div>
          <div style={{ fontSize: 12, color: '#8a85a0', marginTop: 2, lineHeight: 1.45 }}>{sub}</div>
        </div>
        {control}
      </div>
      {children}
    </div>
  );
}

export default function PublishingTab() {
  const { t } = useApp();
  const toast = useToast();
  const [load, setLoad] = useState<'loading' | 'error' | 'ok'>('loading');
  const [form, setForm] = useState<PublishingSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    getPublishingSettings()
      .then((s) => { setForm(s); setLoad('ok'); })
      .catch(() => setLoad('error'));
  }, []);

  const errors = useMemo(() => (form ? validatePublishingSettings(form) : {}), [form]);
  const zones = useMemo(() => zoneList(form?.timezone ?? 'Asia/Ho_Chi_Minh'), [form?.timezone]);

  if (load === 'loading') return <Card><Loader label={t.listLoading} /></Card>;
  if (load === 'error' || !form) return <Card style={{ padding: 26, color: '#e23d6e', fontSize: 13.5 }}>{t.psLoadError}</Card>;

  const set = (patch: Partial<PublishingSettings>) => { setForm({ ...form, ...patch }); setTouched(true); };
  const toInt = (v: string): number | null => (v.trim() === '' ? null : Number(v));

  const save = async () => {
    if (saving || Object.keys(errors).length > 0) return;
    setSaving(true);
    try {
      const saved = await updatePublishingSettings(form);
      setForm(saved);
      setTouched(false);
      toast.success(t.psSaved);
    } catch (e) {
      toast.error(`${t.psSaveError}: ${(e as ApiError).message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card style={{ padding: 26, display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div>
        <div style={{ fontWeight: 700, fontSize: 16, color: '#211c38' }}>{t.psTitle}</div>
        <div style={{ fontSize: 12, color: '#8a85a0', marginTop: 4 }}>{t.psSub}</div>
      </div>

      <Row title={t.psTimezone} sub={t.psTimezoneSub}>
        <select aria-label={t.psTimezone} value={form.timezone} onChange={(e) => set({ timezone: e.target.value })} style={{ ...inputStyle, maxWidth: 360 }}>
          {zones.map((z) => <option key={z} value={z}>{z}</option>)}
        </select>
      </Row>

      <Row
        title={t.psRequireApproval}
        sub={t.psRequireApprovalSub}
        control={<Switch checked={form.requireApproval} onChange={(v) => set({ requireApproval: v })} title={t.psRequireApproval} />}
      />

      <Row title={t.psConflict} sub={t.psConflictSub}>
        <input
          type="number" min={0} max={1440} aria-label={t.psConflict}
          value={Number.isNaN(form.conflictWindowMinutes) ? '' : form.conflictWindowMinutes}
          onChange={(e) => set({ conflictWindowMinutes: toInt(e.target.value) ?? Number.NaN })}
          style={{ ...inputStyle, maxWidth: 160 }}
        />
        {errors.conflictWindowMinutes && <div style={errStyle}>{t[errors.conflictWindowMinutes as keyof typeof t] as string}</div>}
      </Row>

      <Row
        title={t.psVoiceBlock}
        sub={t.psVoiceBlockSub}
        control={<Switch checked={form.brandVoiceBlockingEnabled} onChange={(v) => set({ brandVoiceBlockingEnabled: v })} title={t.psVoiceBlock} />}
      >
        {form.brandVoiceBlockingEnabled && (
          <div>
            <label style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: '#574f6e', marginBottom: 6 }}>{t.psVoiceThreshold}</label>
            <input
              type="number" min={0} max={100} aria-label={t.psVoiceThreshold}
              value={form.brandVoiceThreshold ?? ''}
              onChange={(e) => set({ brandVoiceThreshold: toInt(e.target.value) })}
              style={{ ...inputStyle, maxWidth: 160 }}
            />
          </div>
        )}
        {errors.brandVoiceThreshold && <div style={errStyle}>{t[errors.brandVoiceThreshold as keyof typeof t] as string}</div>}
      </Row>

      <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 6 }}>
        <button
          onClick={save}
          disabled={saving || !touched || Object.keys(errors).length > 0}
          className="btn-grad"
          style={{
            border: 'none', borderRadius: 11, padding: '10px 22px', fontSize: 13.5, fontWeight: 700, color: '#fff',
            background: 'var(--brand)', cursor: saving || !touched ? 'not-allowed' : 'pointer', opacity: saving || !touched ? 0.6 : 1,
          }}
        >
          {t.psSave}
        </button>
      </div>
    </Card>
  );
}
