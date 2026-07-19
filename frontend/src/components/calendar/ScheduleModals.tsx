import { useEffect, useMemo, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { useApp } from '../../context/AppContext.tsx';
import Modal from '../Modal.tsx';
import { PLATFORM_TO_TAG, listConnections, type PlatformConnection } from '../../api/connections.ts';
import { listContentItems, type ContentItemResponse, type ContentVersionResponse } from '../../api/contentGeneration.ts';
import { createSchedule, getGoldenHours, updateSchedule, type GoldenHours, type PostSchedule } from '../../api/schedules.ts';
import type { Platform } from '../../api/brandProfile.ts';
import { dateKey, nowLocal } from './dateUtils.ts';

// Modal "Lên lịch đăng" (FR-47, gợi ý khung giờ vàng FR-48) + modal "Dời giờ / Kích hoạt lại"
// (FR-50) — tách từ pages/app/Calendar.tsx, giữ nguyên hành vi.

/** Bản FORMATTED có thể lên lịch, kèm bài gốc để hiển thị. */
interface SchedulableVersion {
  version: ContentVersionResponse;
  item: ContentItemResponse;
}

export function CreateScheduleModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { t } = useApp();
  const [versions, setVersions] = useState<SchedulableVersion[]>([]);
  const [connections, setConnections] = useState<PlatformConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [versionId, setVersionId] = useState('');
  const [accountId, setAccountId] = useState('');
  const [time, setTime] = useState('');
  const [golden, setGolden] = useState<GoldenHours | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [items, conns] = await Promise.all([
          listContentItems({ size: 50 }),
          listConnections(),
        ]);
        const formatted: SchedulableVersion[] = [];
        for (const item of items.content) {
          for (const v of item.versions) {
            if (v.status === 'FORMATTED') formatted.push({ version: v, item });
          }
        }
        setVersions(formatted);
        setConnections(conns.filter((c) => c.connectionStatus === 'ACTIVE'));
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const selected = versions.find((v) => v.version.id === versionId) ?? null;
  const accounts = useMemo(
    () => (selected ? connections.filter((c) => c.platform === selected.version.platformName) : []),
    [selected, connections],
  );

  // FR-48: gợi ý khung giờ vàng theo nền tảng của bản được chọn.
  useEffect(() => {
    setGolden(null);
    if (!selected) return;
    getGoldenHours(selected.version.platformName as Platform).then(setGolden).catch(() => undefined);
  }, [selected?.version.platformName]); // eslint-disable-line react-hooks/exhaustive-deps

  // Khi đổi bản chọn, account cũ có thể sai nền tảng.
  useEffect(() => { setAccountId(''); }, [versionId]);

  const applyGoldenHour = (slot: string) => {
    const start = slot.split('-')[0]?.trim();
    if (!/^\d{2}:\d{2}$/.test(start ?? '')) return;
    const base = time ? time.slice(0, 10) : dateKey(new Date());
    let candidate = `${base}T${start}`;
    if (candidate <= nowLocal()) {
      const d = new Date(`${base}T00:00:00`);
      d.setDate(d.getDate() + 1);
      candidate = `${dateKey(d)}T${start}`;
    }
    setTime(candidate);
  };

  const submit = async () => {
    if (!versionId || !accountId || !time) return;
    if (time <= nowLocal()) {
      setError(t.schErrPast);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await createSchedule({ contentVersionId: versionId, platformAccountId: accountId, scheduledTime: `${time}:00` });
      onCreated();
    } catch (e) {
      setError((e as Error).message);
      setSaving(false);
    }
  };

  return (
    <Modal title={t.schNew} subtitle={t.schNewSub} onClose={onClose} maxWidth={520}>
      {loading && <div style={{ padding: '20px 0', textAlign: 'center', color: '#a39bbf', fontSize: 13 }}>…</div>}
      {!loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={lbl}>{t.schVersion}</label>
            {versions.length === 0 ? (
              <div style={hint}>{t.schNoVersions}</div>
            ) : (
              <select value={versionId} onChange={(e) => setVersionId(e.target.value)} style={inp}>
                <option value="">—</option>
                {versions.map(({ version, item }) => (
                  <option key={version.id} value={version.id}>
                    [{PLATFORM_TO_TAG[version.platformName] ?? version.platformName}] {(version.formattedCaption ?? item.caption ?? '').slice(0, 60) || version.id.slice(0, 8)}
                  </option>
                ))}
              </select>
            )}
          </div>

          {selected && (
            <div>
              <label style={lbl}>{t.schAccount}</label>
              {accounts.length === 0 ? (
                <div style={hint}>{t.schNoAccounts}</div>
              ) : (
                <select value={accountId} onChange={(e) => setAccountId(e.target.value)} style={inp}>
                  <option value="">—</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>{a.accountName}{a.platformUsername ? ` (@${a.platformUsername})` : ''}</option>
                  ))}
                </select>
              )}
            </div>
          )}

          <div>
            <label style={lbl}>{t.schTime}</label>
            <input type="datetime-local" value={time} min={nowLocal()} onChange={(e) => setTime(e.target.value)} style={inp} />
            {golden && golden.suggestedHours.length > 0 && (
              <div style={{ marginTop: 9 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11.5, fontWeight: 700, color: '#7c3aed', marginBottom: 6 }}>
                  <Sparkles size={13} />
                  {t.schGolden} · {golden.dataDriven ? t.schGoldenData : t.schGoldenDefault}
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {golden.suggestedHours.map((h) => (
                    <button key={h} onClick={() => applyGoldenHour(h)} style={{ border: '1px solid #e3d9fb', background: '#f8f5ff', color: '#6d28d9', borderRadius: 999, padding: '5px 11px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                      {h}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {error && <div style={{ fontSize: 12.5, color: '#e23d6e', background: '#fdecf1', borderRadius: 9, padding: '8px 11px' }}>{error}</div>}

          <button
            onClick={submit}
            disabled={saving || !versionId || !accountId || !time}
            style={{
              border: 'none', borderRadius: 11, padding: '11px 16px', fontWeight: 800, fontSize: 14, color: '#fff',
              background: 'var(--brand-gradient)', cursor: saving ? 'default' : 'pointer',
              opacity: saving || !versionId || !accountId || !time ? 0.55 : 1,
            }}
          >
            {saving ? t.schCreating : t.schCreate}
          </button>
        </div>
      )}
    </Modal>
  );
}

export function RescheduleModal({ schedule, onClose, onSaved }: { schedule: PostSchedule; onClose: () => void; onSaved: () => void }) {
  const { t } = useApp();
  const [time, setTime] = useState(schedule.scheduledTime.slice(0, 16));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (time <= nowLocal()) {
      setError(t.schErrPast);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await updateSchedule(schedule.id, `${time}:00`);
      onSaved();
    } catch (e) {
      setError((e as Error).message);
      setSaving(false);
    }
  };

  return (
    <Modal
      title={schedule.status === 'ON_HOLD' ? t.schReactivate : t.schReschedule}
      subtitle={schedule.status === 'ON_HOLD' ? t.schReactivateSub : undefined}
      onClose={onClose}
      maxWidth={420}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <label style={lbl}>{t.schTime}</label>
          <input type="datetime-local" value={time} min={nowLocal()} onChange={(e) => setTime(e.target.value)} style={inp} />
        </div>
        {error && <div style={{ fontSize: 12.5, color: '#e23d6e', background: '#fdecf1', borderRadius: 9, padding: '8px 11px' }}>{error}</div>}
        <button
          onClick={submit}
          disabled={saving}
          style={{ border: 'none', borderRadius: 11, padding: '11px 16px', fontWeight: 800, fontSize: 14, color: '#fff', background: 'var(--brand-gradient)', cursor: 'pointer', opacity: saving ? 0.55 : 1 }}
        >
          {saving ? t.schCreating : t.schSave}
        </button>
      </div>
    </Modal>
  );
}

const lbl = { display: 'block', fontSize: 12.5, fontWeight: 700, color: '#4b4660', marginBottom: 6 } as const;
const inp = { width: '100%', border: '1px solid #ece8f6', borderRadius: 10, padding: '10px 12px', fontSize: 13.5, color: '#241f3a', background: '#fff', outline: 'none' } as const;
const hint = { fontSize: 12.5, color: '#8a85a0', background: '#f7f6fd', borderRadius: 9, padding: '9px 11px', lineHeight: 1.5 } as const;
