import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { CalendarDays, Loader2, RotateCcw } from 'lucide-react';
import { useApp } from '../../context/AppContext.tsx';
import Switch from '../admin/Switch.tsx';
import { PlatformTag } from '../ui.tsx';
import { PLATFORM_BG } from '../../theme.ts';
import { PLATFORM_TO_TAG, listConnections } from '../../api/connections.ts';
import { getContentItem, listContentItems, type ContentItemResponse } from '../../api/contentGeneration.ts';
import {
  createScheduleBatch, getGoldenHours, getPublishingSettings, listSchedules,
  type PostSchedule, type ScheduleBatchResult,
} from '../../api/schedules.ts';
import type { Platform } from '../../api/brandProfile.ts';
import { getPublishingTimezone } from '../../utils/publishingTime.ts';
import SchedulePlatformRow, { PLATFORM_NAME, TimeExtras, timeErrorText } from './SchedulePlatformRow.tsx';
import ScheduleDateField from './ScheduleDateField.tsx';
import ScheduleTimeField from './ScheduleTimeField.tsx';
import ScheduleCalendar from './ScheduleCalendar.tsx';
import TimezoneSelect from './TimezoneSelect.tsx';
import {
  MIN_LEAD_MINUTES, applyBatchResult, applySharedToggle, bookedDays, convertGoldenHours, earliestTimeOn, initialRows, localConflicts, nowWallIn,
  pickCalendarDay, rezoneSchedules, submitSummary, toBatchRows, validateRow, wallDateTime, wallDiffMinutes,
  type PlannerAccount, type PlannerRow, type RowError, type SharedTime,
} from './plannerLogic.ts';
import { C } from '../../styles/colors';

// SchedulePlanner dùng chung (Phase 4): bước 4 wizard, nút "Lên lịch" ở danh sách và modal tạo lịch của Calendar.
// Một dòng mỗi nền tảng của bài; gửi một lần qua POST /schedules/batch — kết quả theo dòng, thử lại chỉ dòng lỗi
// với CÙNG key idempotency. Mọi giờ là giờ tường theo múi giờ đang chọn (không theo giờ máy, không cắt chuỗi UTC):
// mặc định múi giờ tài khoản, đổi được cho riêng lần lên lịch này (TimezoneSelect) — lịch đã có, gợi ý, khung giờ
// vàng và kiểm tra quá khứ đều quy đổi theo nó; lúc gửi quy ra UTC (toBatchRows).

const newKey = () => crypto.randomUUID();

/** Trạng thái nút gửi chính — wizard đưa ra thanh hành động sticky đáy màn thay vì nút trong planner. */
export interface PlannerAction {
  label: string;
  disabled: boolean;
  /** Lý do khóa nút (hiện cạnh nút), null khi bấm được. */
  reason: string | null;
  submitting: boolean;
  retry: boolean;
  submit: () => void;
}

export interface SchedulePlannerProps {
  /** Bài cố định (wizard / danh sách); bỏ trống → người dùng chọn bài có bản đã định dạng. */
  itemId?: string;
  /** Gọi sau mỗi lần gửi xong (kể cả thành công một phần). */
  onSubmitted?: (result: ScheduleBatchResult) => void;
  /** Điều hướng tới Cài đặt → Kết nối khi nền tảng chưa có tài khoản. */
  onConnect: () => void;
  /** Có → planner KHÔNG tự vẽ nút gửi mà báo trạng thái nút ra ngoài (null khi chưa có dòng nào). */
  onActionChange?: (action: PlannerAction | null) => void;
  /** Wizard: link "Quay lại bước 3" trên card bị khóa vì thiếu media / chưa định dạng. */
  onFixInFinalize?: () => void;
  /** Mở từ một ngày trên Lịch đăng (yyyy-MM-dd) → lịch mở đúng tháng đó và chọn sẵn ngày đó (bỏ qua nếu đã qua). */
  initialDate?: string;
}

const hasSchedulable = (item: ContentItemResponse) =>
  item.versions.some((v) => v.status === 'FORMATTED' && !v.scheduleStatus && v.platformName !== 'INSTAGRAM');

export default function SchedulePlanner({ itemId, onSubmitted, onConnect, onActionChange, onFixInFinalize, initialDate }: SchedulePlannerProps) {
  const { t, brandGradient } = useApp();
  const [load, setLoad] = useState<'loading' | 'error' | 'ok'>('loading');
  // Múi giờ tài khoản (cài đặt) và múi giờ đang dùng cho lần lên lịch này.
  const [accountZone, setAccountZone] = useState(getPublishingTimezone);
  const [zone, setZone] = useState(getPublishingTimezone);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<PlannerAccount[]>([]);
  const [windowMinutes, setWindowMinutes] = useState(60);
  const [schedules, setSchedules] = useState<PostSchedule[]>([]);
  const [items, setItems] = useState<ContentItemResponse[]>([]);
  const [selectedItemId, setSelectedItemId] = useState(itemId ?? '');
  const [rows, setRows] = useState<PlannerRow[]>([]);
  const [shared, setShared] = useState<SharedTime>({ enabled: false, date: '', time: '' });
  const [golden, setGolden] = useState<Partial<Record<Platform, string[]>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [sharedTimeBad, setSharedTimeBad] = useState(false);
  // Đồng hồ 30s: giờ vừa chọn trôi vào quá khứ / quá sát thì lỗi hiện ra ngay, không đợi bấm gửi.
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, []);
  const [lastResult, setLastResult] = useState<ScheduleBatchResult | null>(null);

  const nowWall = nowWallIn(zone);
  const todayISO = nowWall.slice(0, 10);

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
        setAccountZone(settings.timezone);
        setZone(settings.timezone);
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
          const day = initialDate && initialDate >= nowWallIn(accountZone).slice(0, 10) ? initialDate : '';
          setRows(initialRows(item.versions, accounts, newKey, day));
          if (day) setShared((s) => ({ ...s, date: s.date || day }));
          setLastResult(null);
        }
      } catch (e) {
        if (!cancelled) { setLoadError((e as Error).message); setLoad('error'); }
      }
    })();
    return () => { cancelled = true; };
  }, [load, selectedItemId, itemId, items, accounts, initialDate, accountZone]);

  // FR-48: khung giờ vàng theo từng nền tảng có dòng đủ điều kiện.
  useEffect(() => {
    const platforms = [...new Set(rows.filter((r) => !r.block).map((r) => r.platform))];
    platforms.filter((p) => !golden[p]).forEach((p) => {
      getGoldenHours(p).then((g) => setGolden((prev) => ({ ...prev, [p]: g.suggestedHours }))).catch(() => undefined);
    });
  }, [rows]); // eslint-disable-line react-hooks/exhaustive-deps

  const patchRow = useCallback((versionId: string, patch: Partial<PlannerRow>) => {
    setRows((prev) => prev.map((r) => (r.versionId === versionId ? { ...r, ...patch } : r)));
  }, []);

  // Bật/tắt giờ chung không làm mất giờ đã chọn (xem applySharedToggle).
  const toggleShared = (enabled: boolean) => {
    const next = applySharedToggle(enabled, shared, rows);
    setShared(next.shared);
    setRows(next.rows);
  };

  const errors = useMemo(() => rows.map((r) => validateRow(r, shared, nowWall)), [rows, shared, nowWall]);
  const sharedHours = useMemo(
    () => convertGoldenHours([...new Set(rows.filter((r) => !r.block).flatMap((r) => golden[r.platform] ?? []))], shared.date || todayISO, accountZone, zone),
    [rows, golden, shared.date, todayISO, accountZone, zone],
  );
  // Lịch đã có hiển thị theo múi giờ đang chọn (ngày của chấm lịch, giờ trùng lịch).
  const zonedSchedules = useMemo(() => rezoneSchedules(schedules, zone), [schedules, zone]);
  // Chấm lịch trên lịch chọn ngày: giờ chung → mọi tài khoản đang chọn; từng card → tài khoản của card.
  const selectedKey = rows.map((r) => r.accountId).filter(Boolean).join('|');
  const selectedAccounts = useMemo(() => new Set(selectedKey.split('|').filter(Boolean)), [selectedKey]);
  const sharedSchedules = useMemo(() => zonedSchedules.filter((s) => selectedAccounts.has(s.platformAccountId)), [zonedSchedules, selectedAccounts]);
  const sharedBooked = useMemo(() => bookedDays(zonedSchedules, selectedAccounts), [zonedSchedules, selectedAccounts]);
  const sharedWall = shared.date && shared.time ? `${shared.date}T${shared.time}` : null;
  const sharedDiff = sharedWall ? wallDiffMinutes(sharedWall, nowWall) : null;
  const sharedKind = sharedDiff === null ? null : sharedDiff <= 0 ? 'PAST' as const : sharedDiff < MIN_LEAD_MINUTES ? 'TOO_SOON' as const : null;

  // Lý do khóa nút gửi cho dòng lỗi đầu tiên (lỗi giờ nói rõ giờ sớm nhất nếu là hôm nay).
  const errorLabel = (row: PlannerRow, error: Exclude<RowError, null>): string => {
    if (error === 'MISSING_ACCOUNT') return t.planErrAccount;
    if (error === 'MISSING_TIME') return t.planErrMissingTime;
    return timeErrorText(t, error, wallDateTime(row, shared)?.slice(0, 10) ?? '', nowWall);
  };

  const submit = async () => {
    if (submitting) return;
    setSubmitError(null);
    if (errors.some(Boolean)) return;
    let built: ReturnType<typeof toBatchRows>;
    try {
      built = toBatchRows(rows, shared, newKey, zone); // giờ tường theo múi giờ đang chọn → instant UTC
    } catch (e) {
      setSubmitError(e instanceof RangeError ? t.schTimeInvalid : (e as Error).message);
      return;
    }
    const { payload, rows: keyed } = built;
    if (payload.length === 0) return;
    setRows(keyed); // giữ key đã gửi: lỗi mạng giữa chừng → gửi lại cùng key, server trả lại kết quả cũ
    setSubmitting(true);
    try {
      const result = await createScheduleBatch(payload);
      setRows(applyBatchResult(keyed, result));
      setLastResult(result);
      listSchedules().then(setSchedules).catch(() => undefined);
      onSubmitted?.(result);
    } catch (e) {
      setSubmitError(e instanceof RangeError ? t.schTimeInvalid : (e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  // Nút chính: nhãn đổi theo lựa chọn ("Lên lịch 1 nền tảng · 18:34, 30/09" / "Đăng ngay"), khóa khi còn lỗi.
  const summary = submitSummary(rows, shared);
  const firstError = errors.findIndex(Boolean);
  const reason = summary.kind === 'none' ? t.planNothing
    : firstError >= 0 ? `${PLATFORM_NAME[rows[firstError].platform] ?? rows[firstError].platform}: ${errorLabel(rows[firstError], errors[firstError]!)}` : null;
  const at = summary.at ? `${summary.at.slice(11, 16)}, ${summary.at.slice(8, 10)}/${summary.at.slice(5, 7)}` : null;
  // Đang dùng múi giờ khác tài khoản → nhãn nút ghi rõ múi giờ của giờ đăng.
  const zoneNote = zone !== accountZone && (summary.kind === 'schedule' || summary.kind === 'retry') ? ` (${zone})` : '';
  const label = submitting ? t.schCreating
    : summary.kind === 'retry' ? t.planRetry.replace('{n}', String(summary.count)) + zoneNote
    : summary.kind === 'now' ? (summary.count > 1 ? t.planPublishNowN.replace('{n}', String(summary.count)) : t.planPublishNow)
    : at ? t.planSubmitAt.replace('{n}', String(summary.count)).replace('{time}', at) + zoneNote
    : summary.kind === 'none' ? t.cwScheduleTitle
    : t.planSubmit.replace('{n}', String(summary.count)) + zoneNote;
  const disabled = submitting || reason !== null;
  const submitRef = useRef(submit);
  submitRef.current = submit;
  const hasRows = load === 'ok' && rows.length > 0;
  useEffect(() => {
    if (!onActionChange) return;
    onActionChange(hasRows ? { label, disabled, reason, submitting, retry: summary.kind === 'retry', submit: () => void submitRef.current() } : null);
  }, [onActionChange, hasRows, label, disabled, reason, submitting, summary.kind]);

  if (load === 'loading') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }} aria-hidden="true">
        <div className="sk" style={{ height: 60 }} /><div className="sk" style={{ height: 120 }} /><div className="sk" style={{ height: 60 }} />
      </div>
    );
  }
  if (load === 'error') return <div role="alert" style={{ ...note, color: C.rose }}>{loadError ?? t.planLoadError}</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <TimezoneSelect value={zone} accountZone={accountZone} onChange={setZone} />

      {!itemId && (
        <div>
          <div style={lbl} id="plan-item-label">{t.planPickItem}</div>
          {items.length === 0 ? <div style={note}>{t.planNoItems}</div> : (
            <div role="radiogroup" aria-labelledby="plan-item-label" style={{ maxHeight: 200, overflowY: 'auto', border: `1px solid ${C.border}`, borderRadius: 12, padding: 6, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {items.map((item) => {
                const on = item.id === selectedItemId;
                const caption = item.versions.find((v) => v.formattedCaption)?.formattedCaption ?? item.caption ?? item.id.slice(0, 8);
                return (
                  <button key={item.id} type="button" role="radio" aria-checked={on} onClick={() => setSelectedItemId(item.id)}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, textAlign: 'left', width: '100%', border: `1px solid ${on ? C.legacyBorderc4b5fd : C.surfaceMuted}`, borderRadius: 10, padding: '8px 10px', background: on ? C.purpleSoft : C.surfaceSubtle, cursor: 'pointer', font: 'inherit' }}>
                    <span style={{ display: 'flex', gap: 3, flex: 'none' }}>
                      {item.versions.map((v) => {
                        const tag = PLATFORM_TO_TAG[v.platformName] ?? '';
                        return <PlatformTag key={v.id} tag={tag} bg={PLATFORM_BG[tag] ?? '#6b7280'} size={20} radius={6} fontSize={9} />;
                      })}
                    </span>
                    <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, lineHeight: 1.45, color: on ? C.legacyText4c1d95 : C.text, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{caption}</span>
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
          <div className="sch-split-host" style={{ border: `1px solid ${C.border}`, borderRadius: 14, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span aria-hidden="true" style={{ width: 34, height: 34, borderRadius: 10, flex: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: C.primarySoft, color: C.primary }}>
                <CalendarDays size={17} strokeWidth={1.8} />
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: C.textStrong }}>{t.planShared}</div>
                <div style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>{t.planSharedSub}</div>
              </div>
              <Switch checked={shared.enabled} onChange={toggleShared} title={t.planShared} />
            </div>
            {shared.enabled && (
              <div className="sch-split">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0 }}>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <div style={{ flex: '1 1 160px', minWidth: 0 }}>
                      <ScheduleDateField value={shared.date} min={todayISO} onChange={(v) => setShared((s) => ({ ...s, date: v }))} schedules={sharedSchedules}
                        ariaLabel={`${t.schTime} — ${t.planShared}`} invalid={!!sharedKind} />
                    </div>
                    <ScheduleTimeField value={shared.time} onChange={(v) => setShared((s) => ({ ...s, time: v, date: s.date || todayISO }))}
                      ariaLabel={`${t.planTimeOfDay} — ${t.planShared}`} invalid={!!sharedKind} onInvalidChange={setSharedTimeBad}
                      minTime={earliestTimeOn(shared.date || todayISO, nowWall)} />
                  </div>
                  <TimeExtras date={shared.date} time={shared.time} todayISO={todayISO} nowWall={nowWall} error={sharedKind} formatError={sharedTimeBad}
                    hours={sharedHours} onPick={(start) => setShared((s) => ({ ...s, time: start, date: s.date || todayISO }))} />
                </div>
                <ScheduleCalendar
                  value={shared.date}
                  todayISO={todayISO}
                  mode="interactive"
                  onSelect={(day) => { const patch = pickCalendarDay(day, todayISO); if (patch) setShared((s) => ({ ...s, ...patch })); }}
                  booked={sharedBooked}
                  label={t.planCalLabel.replace('{name}', t.planShared)}
                  notes={[t.planCalNote]}
                />
              </div>
            )}
          </div>

          {/* Mỗi nền tảng một card theo hàng dọc — card bị khóa vẫn hiện (mờ) kèm lý do */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {rows.map((row, i) => {
              const wall = wallDateTime(row, shared);
              return (
                <SchedulePlatformRow
                  key={row.versionId}
                  row={row}
                  accounts={accounts.filter((a) => a.platform === row.platform)}
                  shared={shared}
                  goldenHours={golden[row.platform] ?? []}
                  conflicts={localConflicts(row.accountId, wall, zonedSchedules, windowMinutes, zone)}
                  accountSchedules={row.accountId ? zonedSchedules.filter((s) => s.platformAccountId === row.accountId) : []}
                  wall={wall}
                  nowWall={nowWall}
                  error={errors[i]}
                  todayISO={todayISO}
                  zone={zone}
                  accountZone={accountZone}
                  onChange={(patch) => patchRow(row.versionId, patch)}
                  onConnect={onConnect}
                  onFixInFinalize={onFixInFinalize}
                />
              );
            })}
          </div>

          {lastResult && (
            <div role="status" style={{ ...note, color: lastResult.failed ? C.amberText : C.legacyText15803d, background: lastResult.failed ? C.legacyBgfdf6e7 : C.successTint }}>
              {t.planDone.replace('{ok}', String(lastResult.succeeded)).replace('{fail}', String(lastResult.failed))}
            </div>
          )}
          {submitError && <div role="alert" style={{ ...note, color: C.rose, background: C.roseSoft }}>{submitError}</div>}

          {/* Nút gửi trong planner (Calendar / danh sách); wizard lấy trạng thái nút qua onActionChange */}
          {!onActionChange && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <button type="button" onClick={submit} disabled={disabled} className="btn-grad"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, border: 'none', borderRadius: 11, padding: '11px 16px', fontWeight: 800, fontSize: 14, color: C.onBrand, background: brandGradient, cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.55 : 1 }}>
                {submitting ? <Loader2 size={15} className="icon-spin" aria-hidden="true" /> : summary.kind === 'retry' ? <RotateCcw size={15} aria-hidden="true" /> : null}
                {label}
              </button>
              {reason && !submitting && <div style={{ fontSize: 12, color: C.textMuted, textAlign: 'center' }}>{reason}</div>}
            </div>
          )}
        </>
      )}
    </div>
  );
}

const lbl: CSSProperties = { display: 'block', fontSize: 12.5, fontWeight: 700, color: C.ink650, marginBottom: 6 };
const note: CSSProperties = { fontSize: 12.5, color: C.textMuted, background: C.bg, borderRadius: 9, padding: '8px 11px', lineHeight: 1.5 };
