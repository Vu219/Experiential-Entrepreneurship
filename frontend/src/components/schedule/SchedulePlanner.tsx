import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { ChevronLeft, ChevronRight, Globe, Loader2, RotateCcw, Sparkles } from 'lucide-react';
import { useApp } from '../../context/AppContext.tsx';
import { useBreakpoint } from '../../hooks/useBreakpoint.ts';
import DatePicker from '../DatePicker.tsx';
import Switch from '../admin/Switch.tsx';
import MonthGrid, { buildMonth } from '../calendar/MonthGrid.tsx';
import { dateKey, nowLocal, MONTHS_EN } from '../calendar/dateUtils.ts';
import { PlatformTag } from '../ui.tsx';
import { PLATFORM_BG } from '../../theme.ts';
import { PLATFORM_TO_TAG, listConnections } from '../../api/connections.ts';
import { getContentItem, listContentItems, type ContentItemResponse } from '../../api/contentGeneration.ts';
import {
  createScheduleBatch, getGoldenHours, getPublishingSettings, listSchedules,
  type PostSchedule, type ScheduleBatchResult,
} from '../../api/schedules.ts';
import type { Platform } from '../../api/brandProfile.ts';
import { getPublishingTimezone, publishingToday } from '../../utils/publishingTime.ts';
import SchedulePlatformRow from './SchedulePlatformRow.tsx';
import {
  applyBatchResult, initialRows, isSubmittable, localConflicts, toBatchRows, validateRow, wallDateTime,
  type PlannerAccount, type PlannerRow, type SharedTime,
} from './plannerLogic.ts';

// SchedulePlanner dùng chung (Phase 4): bước 4 wizard, nút "Lên lịch" ở danh sách và modal tạo lịch của Calendar.
// Một dòng mỗi nền tảng của bài; gửi một lần qua POST /schedules/batch — kết quả theo dòng, thử lại chỉ dòng lỗi
// với CÙNG key idempotency. Mọi giờ là giờ tường theo múi giờ đăng (không theo giờ máy, không cắt chuỗi UTC).

const newKey = () => crypto.randomUUID();

export interface SchedulePlannerProps {
  /** Bài cố định (wizard / danh sách); bỏ trống → người dùng chọn bài có bản đã định dạng. */
  itemId?: string;
  /** Gọi sau mỗi lần gửi xong (kể cả thành công một phần). */
  onSubmitted?: (result: ScheduleBatchResult) => void;
  /** Điều hướng tới Cài đặt → Kết nối khi nền tảng chưa có tài khoản. */
  onConnect: () => void;
}

const hasSchedulable = (item: ContentItemResponse) =>
  item.versions.some((v) => v.status === 'FORMATTED' && !v.scheduleStatus && v.platformName !== 'INSTAGRAM');

export default function SchedulePlanner({ itemId, onSubmitted, onConnect }: SchedulePlannerProps) {
  const { t, lang, brandGradient } = useApp();
  const { isMobile } = useBreakpoint();
  const [load, setLoad] = useState<'loading' | 'error' | 'ok'>('loading');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<PlannerAccount[]>([]);
  const [windowMinutes, setWindowMinutes] = useState(60);
  const [schedules, setSchedules] = useState<PostSchedule[]>([]);
  const [items, setItems] = useState<ContentItemResponse[]>([]);
  const [selectedItemId, setSelectedItemId] = useState(itemId ?? '');
  const [rows, setRows] = useState<PlannerRow[]>([]);
  const [shared, setShared] = useState<SharedTime>({ enabled: false, date: '', time: '' });
  const [golden, setGolden] = useState<Partial<Record<Platform, string[]>>>({});
  const [activeRow, setActiveRow] = useState<string | null>(null);
  const [viewMonth, setViewMonth] = useState(() => publishingToday());
  const [submitting, setSubmitting] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<ScheduleBatchResult | null>(null);

  const todayISO = dateKey(publishingToday());

  // Tải một lần: kết nối dùng được (ACTIVE; Facebook chỉ Trang), cửa sổ trùng lịch, lịch hiện có, danh sách bài.
  useEffect(() => {
    (async () => {
      try {
        const [conns, settings, existing, list] = await Promise.all([
          listConnections(),
          getPublishingSettings(),
          listSchedules(),
          itemId ? Promise.resolve(null) : listContentItems({ size: 50 }),
        ]);
        setAccounts(conns
          .filter((c) => c.connectionStatus === 'ACTIVE' && !(c.platform === 'FACEBOOK' && c.accountType !== 'PAGE'))
          .map((c) => ({ id: c.id, platform: c.platform as Platform, accountName: c.accountName })));
        setWindowMinutes(settings.conflictWindowMinutes);
        setSchedules(existing);
        if (list) setItems(list.content.filter(hasSchedulable));
        setLoad('ok');
      } catch (e) {
        setLoadError((e as Error).message);
        setLoad('error');
      }
    })();
  }, [itemId]);

  // Nạp bản của bài đã chọn → dựng dòng (một dòng / nền tảng).
  useEffect(() => {
    if (load !== 'ok' || !selectedItemId) { setRows([]); return; }
    let cancelled = false;
    (async () => {
      try {
        const item = itemId ? await getContentItem(itemId) : items.find((i) => i.id === selectedItemId);
        if (!cancelled && item) {
          setRows(initialRows(item.versions, accounts, newKey));
          setLastResult(null);
          setShowErrors(false);
        }
      } catch (e) {
        if (!cancelled) { setLoadError((e as Error).message); setLoad('error'); }
      }
    })();
    return () => { cancelled = true; };
  }, [load, selectedItemId, itemId, items, accounts]);

  // FR-48: khung giờ vàng theo từng nền tảng có dòng đủ điều kiện.
  useEffect(() => {
    const platforms = [...new Set(rows.filter((r) => !r.block).map((r) => r.platform))];
    platforms.filter((p) => !golden[p]).forEach((p) => {
      getGoldenHours(p).then((g) => setGolden((prev) => ({ ...prev, [p]: g.suggestedHours }))).catch(() => undefined);
    });
  }, [rows]); // eslint-disable-line react-hooks/exhaustive-deps

  const patchRow = useCallback((versionId: string, patch: Partial<PlannerRow>) => {
    setActiveRow(versionId);
    setRows((prev) => prev.map((r) => (r.versionId === versionId ? { ...r, ...patch } : r)));
  }, []);

  const nowWall = nowLocal();
  const errors = useMemo(() => rows.map((r) => validateRow(r, shared, nowWall)), [rows, shared, nowWall]);
  const submittable = rows.filter(isSubmittable);
  const sharedHours = useMemo(() => [...new Set(rows.filter((r) => !r.block).flatMap((r) => golden[r.platform] ?? []))], [rows, golden]);

  // Lịch tháng mini: lịch hiện có của các tài khoản đang chọn; bấm ngày → đặt ngày cho giờ chung / dòng đang sửa.
  const selectedAccounts = new Set(rows.map((r) => r.accountId).filter(Boolean));
  const gridCells = useMemo(
    () => buildMonth(viewMonth, schedules.filter((s) => selectedAccounts.has(s.platformAccountId))),
    [viewMonth, schedules, rows], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const focused = rows.find((r) => r.versionId === activeRow && r.mode === 'SCHEDULE' && !r.block);
  const gridDay = shared.enabled ? shared.date : focused?.date ?? null;
  const pickDay = (key: string | null) => {
    if (!key || key < todayISO) return;
    if (shared.enabled) setShared((s) => ({ ...s, date: key }));
    else if (focused) patchRow(focused.versionId, { date: key });
  };
  const shiftMonth = (delta: number) => setViewMonth((d) => new Date(d.getFullYear(), d.getMonth() + delta, 1, 12));
  const monthLabel = lang === 'en'
    ? `${MONTHS_EN[viewMonth.getMonth()]} ${viewMonth.getFullYear()}`
    : `Tháng ${viewMonth.getMonth() + 1}/${viewMonth.getFullYear()}`;

  const submit = async () => {
    if (submitting) return;
    setShowErrors(true);
    setSubmitError(null);
    if (errors.some(Boolean)) return;
    const { payload, rows: keyed } = toBatchRows(rows, shared, newKey);
    if (payload.length === 0) return;
    setRows(keyed); // giữ key đã gửi: lỗi mạng giữa chừng → gửi lại cùng key, server trả lại kết quả cũ
    setSubmitting(true);
    try {
      const result = await createScheduleBatch(payload);
      setRows(applyBatchResult(keyed, result));
      setLastResult(result);
      setShowErrors(false);
      listSchedules().then(setSchedules).catch(() => undefined);
      onSubmitted?.(result);
    } catch (e) {
      setSubmitError(e instanceof RangeError ? t.schTimeInvalid : (e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  if (load === 'loading') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }} aria-hidden="true">
        <div className="sk" style={{ height: 60 }} /><div className="sk" style={{ height: 120 }} /><div className="sk" style={{ height: 60 }} />
      </div>
    );
  }
  if (load === 'error') return <div role="alert" style={{ ...note, color: '#e23d6e' }}>{loadError ?? t.planLoadError}</div>;

  const failedCount = rows.filter((r) => r.result && !r.result.ok).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#8a85a0' }}>
        <Globe size={13} aria-hidden="true" />{t.schTimezone}: {getPublishingTimezone()}
      </div>

      {!itemId && (
        <div>
          <div style={lbl} id="plan-item-label">{t.planPickItem}</div>
          {items.length === 0 ? <div style={note}>{t.planNoItems}</div> : (
            <div role="radiogroup" aria-labelledby="plan-item-label" style={{ maxHeight: 200, overflowY: 'auto', border: '1px solid #ece8f6', borderRadius: 12, padding: 6, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {items.map((item) => {
                const on = item.id === selectedItemId;
                const caption = item.versions.find((v) => v.formattedCaption)?.formattedCaption ?? item.caption ?? item.id.slice(0, 8);
                return (
                  <button key={item.id} type="button" role="radio" aria-checked={on} onClick={() => setSelectedItemId(item.id)}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, textAlign: 'left', width: '100%', border: `1px solid ${on ? '#c4b5fd' : '#f1eef8'}`, borderRadius: 10, padding: '8px 10px', background: on ? '#f1e9ff' : '#fcfbfe', cursor: 'pointer', font: 'inherit' }}>
                    <span style={{ display: 'flex', gap: 3, flex: 'none' }}>
                      {item.versions.map((v) => {
                        const tag = PLATFORM_TO_TAG[v.platformName] ?? '';
                        return <PlatformTag key={v.id} tag={tag} bg={PLATFORM_BG[tag] ?? '#6b7280'} size={20} radius={6} fontSize={9} />;
                      })}
                    </span>
                    <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, lineHeight: 1.45, color: on ? '#4c1d95' : '#3f3a55', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{caption}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {rows.length > 0 && (
        <>
          {/* Giờ chung cho mọi nền tảng ở chế độ Chọn giờ */}
          <div style={{ border: '1px solid #ece8f6', borderRadius: 14, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: '#211c38' }}>{t.planShared}</div>
                <div style={{ fontSize: 12, color: '#8a85a0', marginTop: 2 }}>{t.planSharedSub}</div>
              </div>
              <Switch checked={shared.enabled} onChange={(v) => setShared((s) => ({ ...s, enabled: v }))} title={t.planShared} />
            </div>
            {shared.enabled && (
              <>
                <div style={{ display: 'flex', gap: 8 }}>
                  <DatePicker value={shared.date} min={todayISO} onChange={(v) => setShared((s) => ({ ...s, date: v }))} ariaLabel={`${t.schTime} — ${t.planShared}`}
                    style={{ flex: 1, borderRadius: 10, border: '1px solid #ece8f6', background: '#fff', padding: '0 12px' }} inputStyle={{ fontSize: 13.5, padding: '9px 0' }} />
                  <input type="time" value={shared.time} onChange={(e) => setShared((s) => ({ ...s, time: e.target.value }))} aria-label={`${t.planTimeOfDay} — ${t.planShared}`} style={{ ...inp, width: 108, flex: 'none' }} />
                </div>
                {sharedHours.length > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <Sparkles size={13} color="#7c3aed" aria-hidden="true" />
                    {sharedHours.map((h) => {
                      const start = h.split('-')[0]?.trim() ?? '';
                      const on = shared.time === start;
                      return (
                        <button key={h} type="button" aria-pressed={on} onClick={() => setShared((s) => ({ ...s, time: start, date: s.date || todayISO }))}
                          style={{ ...chip, border: `1px solid ${on ? '#6d28d9' : '#e3d9fb'}`, background: on ? '#6d28d9' : '#f8f5ff', color: on ? '#fff' : '#6d28d9' }}>{h}</button>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'minmax(0, 1.5fr) minmax(0, 1fr)', gap: 14, alignItems: 'start' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {rows.map((row, i) => (
                <SchedulePlatformRow
                  key={row.versionId}
                  row={row}
                  accounts={accounts.filter((a) => a.platform === row.platform)}
                  sharedEnabled={shared.enabled}
                  goldenHours={golden[row.platform] ?? []}
                  conflicts={localConflicts(row.accountId, wallDateTime(row, shared), schedules, windowMinutes)}
                  error={errors[i]}
                  showError={showErrors}
                  todayISO={todayISO}
                  onChange={(patch) => patchRow(row.versionId, patch)}
                  onConnect={onConnect}
                />
              ))}
            </div>
            <div style={{ border: '1px solid #ece8f6', borderRadius: 14, padding: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <button type="button" onClick={() => shiftMonth(-1)} aria-label={t.planPrevMonth} style={navBtn}><ChevronLeft size={15} aria-hidden="true" /></button>
                <span style={{ fontSize: 12.5, fontWeight: 700, color: '#3f3a55' }}>{monthLabel}</span>
                <button type="button" onClick={() => shiftMonth(1)} aria-label={t.planNextMonth} style={navBtn}><ChevronRight size={15} aria-hidden="true" /></button>
              </div>
              <MonthGrid cells={gridCells} selectedDay={gridDay} onSelectDay={pickDay} compact />
              <div style={{ fontSize: 11.5, color: '#a59fbb', marginTop: 6, lineHeight: 1.45 }}>{t.planMiniHint}</div>
            </div>
          </div>

          {lastResult && (
            <div role="status" style={{ ...note, color: lastResult.failed ? '#b45309' : '#15803d', background: lastResult.failed ? '#fdf6e7' : '#eafbf1' }}>
              {t.planDone.replace('{ok}', String(lastResult.succeeded)).replace('{fail}', String(lastResult.failed))}
            </div>
          )}
          {submitError && <div role="alert" style={{ ...note, color: '#e23d6e', background: '#fdecf1' }}>{submitError}</div>}

          {submittable.length > 0 && (
            <button type="button" onClick={submit} disabled={submitting} className="btn-grad"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, border: 'none', borderRadius: 11, padding: '11px 16px', fontWeight: 800, fontSize: 14, color: '#fff', background: brandGradient, cursor: submitting ? 'default' : 'pointer', opacity: submitting ? 0.6 : 1 }}>
              {submitting ? <Loader2 size={15} className="icon-spin" aria-hidden="true" /> : failedCount > 0 ? <RotateCcw size={15} aria-hidden="true" /> : null}
              {submitting ? t.schCreating : failedCount > 0 ? t.planRetry.replace('{n}', String(submittable.length)) : t.planSubmit.replace('{n}', String(submittable.length))}
            </button>
          )}
          {submittable.length === 0 && !lastResult && <div style={note}>{t.planNothing}</div>}
        </>
      )}
    </div>
  );
}

const chip: CSSProperties = { borderRadius: 999, padding: '5px 11px', fontSize: 12, fontWeight: 700, cursor: 'pointer' };
const lbl: CSSProperties = { display: 'block', fontSize: 12.5, fontWeight: 700, color: '#4b4660', marginBottom: 6 };
const inp: CSSProperties = { width: '100%', border: '1px solid #ece8f6', borderRadius: 10, padding: '9px 12px', fontSize: 13.5, color: '#241f3a', background: '#fff', outline: 'none' };
const note: CSSProperties = { fontSize: 12.5, color: '#8a85a0', background: '#f7f6fd', borderRadius: 9, padding: '8px 11px', lineHeight: 1.5 };
const navBtn: CSSProperties = { width: 28, height: 28, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #ece8f6', borderRadius: 8, background: '#fff', cursor: 'pointer' };
