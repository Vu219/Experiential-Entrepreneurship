import { useEffect, useMemo, useRef, useState } from 'react';
import { Globe, Link2, Loader2, Sparkles } from 'lucide-react';
import { useApp } from '../../context/AppContext.tsx';
import { useBreakpoint } from '../../hooks/useBreakpoint.ts';
import Modal from '../Modal.tsx';
import DatePicker from '../DatePicker.tsx';
import DaySheet from './DaySheet.tsx';
import { PlatformTag } from '../ui.tsx';
import { PLATFORM_BG } from '../../theme.ts';
import { PLATFORM_TO_TAG, listConnections, type PlatformConnection } from '../../api/connections.ts';
import { listContentItems, type ContentItemResponse, type ContentVersionResponse } from '../../api/contentGeneration.ts';
import {
  ERR_SCHEDULE_TIME_IN_PAST,
  createSchedule, getGoldenHours, updateSchedule, type GoldenHours, type PostSchedule,
} from '../../api/schedules.ts';
import type { Platform } from '../../api/brandProfile.ts';
import { WEEKDAYS_FULL, dateKey, nowLocal } from './dateUtils.ts';

// Modal "Lên lịch đăng" (FR-47 + khung giờ vàng FR-48) và modal "Dời giờ / Kích hoạt lại" (FR-50).
// Nghiệp vụ giữ nguyên: chỉ bản FORMATTED, tài khoản ACTIVE cùng nền tảng, giờ đăng phải ở tương lai.
// UI 2026-07-19: chọn bản nội dung dạng danh sách (PlatformTag + caption 2 dòng, lọc nhanh khi >10),
// preview nội dung, DatePicker dd/MM/yyyy + ô giờ (backend lưu LocalDateTime theo APP_TIMEZONE =
// Asia/Ho_Chi_Minh — hiển thị nhãn múi giờ VN), tóm tắt xác nhận, lỗi inline, spinner khi lưu;
// mobile (<760) chuyển thành bottom sheet với nút hành động dính đáy.

const PLATFORM_NAME: Record<string, string> = { FACEBOOK: 'Facebook', INSTAGRAM: 'Instagram', THREADS: 'Threads' };

/** Bản FORMATTED có thể lên lịch, kèm bài gốc để hiển thị. */
interface SchedulableVersion {
  version: ContentVersionResponse;
  item: ContentItemResponse;
}

const captionOf = ({ version, item }: SchedulableVersion) =>
  (version.formattedCaption ?? item.caption ?? '') || version.id.slice(0, 8);

const PREVIEW_CLAMP = 220;

export function CreateScheduleModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { t, lang, go, brandGradient } = useApp();
  const { isMobile } = useBreakpoint();
  const [versions, setVersions] = useState<SchedulableVersion[]>([]);
  const [connections, setConnections] = useState<PlatformConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [versionId, setVersionId] = useState('');
  const [accountId, setAccountId] = useState('');
  const [date, setDate] = useState('');      // yyyy-MM-dd
  const [timeHH, setTimeHH] = useState('');  // HH:mm
  const [filter, setFilter] = useState('');
  const [golden, setGolden] = useState<GoldenHours | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);        // lỗi chung (tải dữ liệu / API)
  const [timeError, setTimeError] = useState<string | null>(null); // lỗi server gắn với field thời gian
  const [expanded, setExpanded] = useState(false);
  const firstFieldRef = useRef<HTMLInputElement | HTMLButtonElement | null>(null);

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

  // Autofocus field đầu sau khi dữ liệu sẵn sàng (Modal mặc định focus nút đóng).
  useEffect(() => {
    if (!loading) firstFieldRef.current?.focus();
  }, [loading]);

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

  // Khi đổi bản chọn, account cũ có thể sai nền tảng; preview thu gọn lại.
  useEffect(() => { setAccountId(''); setExpanded(false); }, [versionId]);

  const filterShown = versions.length > 10;
  const shownVersions = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return versions;
    return versions.filter((v) => captionOf(v).toLowerCase().includes(q));
  }, [versions, filter]);

  const todayISO = dateKey(new Date());
  const candidate = date && timeHH ? `${date}T${timeHH}` : '';
  const timeInPast = !!candidate && candidate <= nowLocal();
  const complete = !!(versionId && accountId && candidate);
  const canSubmit = complete && !timeInPast && !saving;

  /** Chip khung giờ vàng: set giờ, GIỮ ngày đang chọn; chưa chọn ngày → hôm nay, giờ đã qua → ngày mai. */
  const applyGoldenHour = (slot: string) => {
    const start = slot.split('-')[0]?.trim();
    if (!/^\d{2}:\d{2}$/.test(start ?? '')) return;
    if (!date) {
      let base = todayISO;
      if (`${base}T${start}` <= nowLocal()) {
        const d = new Date(`${base}T00:00:00`);
        d.setDate(d.getDate() + 1);
        base = dateKey(d);
      }
      setDate(base);
    }
    setTimeHH(start!);
    setTimeError(null);
  };

  const submit = async () => {
    if (!canSubmit) return;
    setSaving(true);
    setError(null);
    setTimeError(null);
    try {
      await createSchedule({ contentVersionId: versionId, platformAccountId: accountId, scheduledTime: `${candidate}:00` });
      onCreated();
    } catch (e) {
      const err = e as Error & { code?: number };
      if (err.code === ERR_SCHEDULE_TIME_IN_PAST) setTimeError(err.message);
      else setError(err.message);
      setSaving(false);
    }
  };

  const summary = useMemo(() => {
    if (!complete || timeInPast || !selected) return null;
    const account = accounts.find((a) => a.id === accountId);
    if (!account) return null;
    const d = new Date(`${date}T00:00:00`);
    const weekday = WEEKDAYS_FULL[lang][(d.getDay() + 6) % 7];
    const timeLabel = `${timeHH} · ${weekday}, ${date.split('-').reverse().join('/')}`;
    return t.calSummary
      .replace('{platform}', PLATFORM_NAME[selected.version.platformName] ?? selected.version.platformName)
      .replace('{account}', account.accountName)
      .replace('{time}', timeLabel);
  }, [complete, timeInPast, selected, accounts, accountId, date, timeHH, lang, t]);

  const previewText = selected ? captionOf(selected) : '';
  const previewLong = previewText.length > PREVIEW_CLAMP;

  const formBody = loading ? (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }} aria-hidden="true">
      <div className="sk" style={{ height: 38 }} />
      <div className="sk" style={{ height: 120 }} />
      <div className="sk" style={{ height: 38 }} />
    </div>
  ) : (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* 1. Chọn bản nội dung */}
      <div>
        <div style={lbl} id="sch-version-label">{t.schVersion}</div>
        {versions.length === 0 ? (
          <div style={hint}>{t.schNoVersions}</div>
        ) : (
          <>
            {filterShown && (
              <input
                ref={(el) => { firstFieldRef.current = el; }}
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder={t.calFilterVersions}
                aria-label={t.calFilterVersions}
                style={{ ...inp, marginBottom: 8 }}
              />
            )}
            <div role="radiogroup" aria-labelledby="sch-version-label" style={{ maxHeight: 236, overflowY: 'auto', border: '1px solid #ece8f6', borderRadius: 12, padding: 6, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {shownVersions.map((sv, i) => {
                const active = sv.version.id === versionId;
                const tag = PLATFORM_TO_TAG[sv.version.platformName] ?? sv.version.platformName.slice(0, 2);
                return (
                  <button
                    key={sv.version.id}
                    ref={!filterShown && i === 0 ? (el) => { firstFieldRef.current = el; } : undefined}
                    role="radio"
                    aria-checked={active}
                    onClick={() => setVersionId(active ? '' : sv.version.id)}
                    style={{
                      display: 'flex', alignItems: 'flex-start', gap: 10, textAlign: 'left', width: '100%',
                      border: `1px solid ${active ? '#c4b5fd' : '#f1eef8'}`, borderRadius: 10, padding: '9px 11px',
                      background: active ? '#f1e9ff' : '#fcfbfe', cursor: 'pointer', font: 'inherit',
                    }}
                  >
                    <PlatformTag tag={tag} bg={PLATFORM_BG[tag] ?? '#6b7280'} size={26} radius={7} fontSize={10.5} />
                    <span style={{
                      flex: 1, minWidth: 0, fontSize: 12.5, lineHeight: 1.45, color: active ? '#4c1d95' : '#3f3a55',
                      display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                    }}>
                      {captionOf(sv)}
                    </span>
                  </button>
                );
              })}
              {shownVersions.length === 0 && (
                <div style={{ padding: '14px 8px', textAlign: 'center', fontSize: 12.5, color: '#8a85a0' }}>{t.calNoVersionMatch}</div>
              )}
            </div>
          </>
        )}
      </div>

      {/* 2. Preview nội dung đã chọn */}
      {selected && (
        <div>
          <div style={lbl}>{t.calPreview}</div>
          <div style={{ background: '#faf9fe', border: '1px solid #f1eef8', borderRadius: 12, padding: '11px 13px' }}>
            <div style={{
              fontSize: 12.5, lineHeight: 1.55, color: '#3f3a55', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere',
              ...(previewLong && !expanded ? { display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical' as const, overflow: 'hidden' } : {}),
            }}>
              {previewText}
            </div>
            {previewLong && (
              <button onClick={() => setExpanded((v) => !v)} style={{ background: 'none', border: 'none', padding: 0, marginTop: 6, fontSize: 12, fontWeight: 700, color: '#7c3aed', cursor: 'pointer' }}>
                {expanded ? t.calSeeLess : t.calSeeMore}
              </button>
            )}
            {selected.version.formattedHashtags.length > 0 && (
              <div style={{ marginTop: 7, fontSize: 12, fontWeight: 600, color: '#6d28d9', overflowWrap: 'anywhere' }}>
                {selected.version.formattedHashtags.map((h) => (h.startsWith('#') ? h : `#${h}`)).join(' ')}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 3. Tài khoản đích */}
      {selected && (
        <div>
          <label style={lbl} htmlFor="sch-account">{t.schAccount}</label>
          {accounts.length === 0 ? (
            <div style={{ ...hint, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 10 }}>
              {t.schNoAccounts}
              <button
                onClick={() => { onClose(); go('settings'); }}
                className="btn-soft"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: '1px solid #e3d9fb', background: '#fff', borderRadius: 10, padding: '8px 13px', fontSize: 12.5, fontWeight: 700, color: '#6d28d9', cursor: 'pointer' }}
              >
                <Link2 size={14} aria-hidden="true" />
                {t.calConnectAccount}
              </button>
            </div>
          ) : (
            <select id="sch-account" value={accountId} onChange={(e) => setAccountId(e.target.value)} style={inp}>
              <option value="">—</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>{a.accountName}{a.platformUsername ? ` (@${a.platformUsername})` : ''}</option>
              ))}
            </select>
          )}
        </div>
      )}

      {/* 4. Thời gian đăng */}
      <div>
        <label style={lbl} htmlFor="sch-time">{t.schTime}</label>
        <div style={{ display: 'flex', gap: 8 }}>
          <DatePicker
            value={date}
            min={todayISO}
            onChange={(v) => { setDate(v); setTimeError(null); }}
            ariaLabel={t.schTime}
            error={timeInPast || timeError ? t.schErrPast : undefined}
            style={{ flex: 1, borderRadius: 10, border: `1px solid ${timeInPast || timeError ? '#f3aabf' : '#ece8f6'}`, background: '#fff', padding: '0 12px' }}
            inputStyle={{ fontSize: 13.5, padding: '10px 0' }}
          />
          <input
            id="sch-time"
            type="time"
            value={timeHH}
            onChange={(e) => { setTimeHH(e.target.value); setTimeError(null); }}
            style={{ ...inp, width: 108, flex: 'none', borderColor: timeInPast || timeError ? '#f3aabf' : '#ece8f6' }}
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 6, fontSize: 11.5, color: '#a59fbb' }}>
          <Globe size={12} aria-hidden="true" />
          {t.calTimezoneVN}
        </div>
        {(timeInPast || timeError) && (
          <div style={{ marginTop: 6, fontSize: 12, fontWeight: 600, color: '#e23d6e' }}>{timeError ?? t.schErrPast}</div>
        )}
        {golden && golden.suggestedHours.length > 0 && (
          <div style={{ marginTop: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11.5, fontWeight: 700, color: '#7c3aed', marginBottom: 6 }}>
              <Sparkles size={13} aria-hidden="true" />
              {t.schGolden} · {golden.dataDriven ? t.schGoldenData : t.schGoldenDefault}
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {golden.suggestedHours.map((h) => {
                const start = h.split('-')[0]?.trim();
                const active = !!start && timeHH === start;
                return (
                  <button
                    key={h}
                    onClick={() => applyGoldenHour(h)}
                    aria-pressed={active}
                    style={{
                      border: `1px solid ${active ? '#6d28d9' : '#e3d9fb'}`, background: active ? '#6d28d9' : '#f8f5ff',
                      color: active ? '#fff' : '#6d28d9', borderRadius: 999, padding: '5px 11px', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                    }}
                  >
                    {h}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );

  const footer = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {summary && (
        <div style={{ background: '#f8f5ff', border: '1px solid #e3d9fb', borderRadius: 10, padding: '9px 12px', fontSize: 12.5, fontWeight: 600, color: '#6d28d9', lineHeight: 1.5 }}>
          {summary}
        </div>
      )}
      {error && <div style={{ fontSize: 12.5, color: '#e23d6e', background: '#fdecf1', borderRadius: 9, padding: '8px 11px' }}>{error}</div>}
      <button
        onClick={submit}
        disabled={!canSubmit}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          border: 'none', borderRadius: 11, padding: '11px 16px', fontWeight: 800, fontSize: 14, color: '#fff',
          background: brandGradient, cursor: canSubmit ? 'pointer' : 'default',
          opacity: canSubmit ? 1 : 0.55,
        }}
      >
        {saving && <Loader2 size={15} className="icon-spin" aria-hidden="true" />}
        {saving ? t.schCreating : t.schCreate}
      </button>
    </div>
  );

  if (isMobile) {
    return (
      <DaySheet title={t.schNew} subtitle={t.schNewSub} onClose={onClose} footer={footer}>
        {formBody}
      </DaySheet>
    );
  }
  return (
    <Modal title={t.schNew} subtitle={t.schNewSub} onClose={onClose} maxWidth={620}>
      {formBody}
      <div style={{ marginTop: 16 }}>{footer}</div>
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
