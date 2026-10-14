import { useCallback, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react';
import { AlertTriangle, ClipboardCheck, CornerDownLeft, Loader2, Plug, RefreshCw, Search, Star, X, type LucideIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Modal from '../Modal';
import HighlightText from './HighlightText';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../auth/AuthContext';
import { useUiStore } from '../../store/useUiStore';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import { useSearchActions } from '../../hooks/useSearchActions';
import { MIN_DATA_QUERY, useDataSearch } from '../../hooks/useDataSearch';
import { useSearchSuggestions, type SearchSuggestion } from '../../hooks/useSearchSuggestions';
import { useToast } from '../toast/ToastProvider';
import { PlatformTag } from '../ui';
import { PLATFORMS } from '../../theme';
import { PLATFORM_TO_TAG } from '../../api/connections';
import { getContentItem } from '../../api/contentGeneration';
import { getContentStrategy } from '../../api/contentStrategy';
import { getSchedule } from '../../api/schedules';
import type { ApiError } from '../../api/apiClient';
import type { Platform } from '../../api/brandProfile';
import { CONTENT_STATUS_META } from '../create/statusMeta';
import { wallTime } from '../../utils/publishingTime';
import { matchItem } from '../../search/match';
import { DARK_MODE_ENABLED } from '../../store/colorMode';
import { SEARCH_REGISTRY, REGISTRY_BY_ID, DATA_ICONS } from '../../search/registry';
import { rankStatic, visibleItems } from '../../search/rank';
import { addHistory, clearHistory, readHistory, removeHistory, type DataSnapshot, type HistoryEntry } from '../../search/history';
import type { Range } from '../../search/match';
import type { SearchArea, StaticSearchItem } from '../../search/types';
import type { Dict } from '../../i18n';
import { C } from '../../styles/colors';

/** Một dòng trong listbox. */
interface Row {
  key: string;
  group: RowGroup;
  icon: LucideIcon;
  label: string;
  desc?: string;
  ranges?: Range[];
  /** Điểm khớp (khi đang gõ) — nhóm có mục điểm cao nhất xếp lên đầu để Enter mở đúng mục khớp nhất. */
  score?: number;
  /** Phần phụ bên phải (badge nền tảng / trạng thái). */
  aside?: ReactNode;
  onSelect: () => void;
  /** Dòng lịch sử: xóa khỏi lịch sử (nút ✕ hoặc phím Delete). */
  onRemove?: () => void;
}

type RowGroup = 'recent' | 'suggest' | 'pages' | 'sections' | 'actions' | 'content' | 'strategies' | 'schedules';

const GROUP_ORDER: readonly RowGroup[] = ['recent', 'suggest', 'pages', 'sections', 'actions', 'content', 'strategies', 'schedules'];

const GROUP_LABEL: Record<RowGroup, (t: Dict) => string> = {
  recent: (t) => t.gsGroupRecent,
  suggest: (t) => t.gsGroupSuggest,
  pages: (t) => t.gsGroupPages,
  sections: (t) => t.gsGroupSections,
  actions: (t) => t.gsGroupActions,
  content: (t) => t.gsGroupContent,
  strategies: (t) => t.gsGroupStrategies,
  schedules: (t) => t.gsGroupSchedules,
};

/** Mã "không tìm thấy" của backend — mục dữ liệu trong lịch sử đã bị xoá/không còn quyền xem. */
const GONE_CODES = new Set([1715 /* CONTENT_STRATEGY_NOT_FOUND */, 1920 /* CONTENT_ITEM_NOT_FOUND */, 1939 /* SCHEDULE_NOT_FOUND */]);

const PLATFORM_NAME: Record<Platform, string> = { FACEBOOK: 'Facebook', INSTAGRAM: 'Instagram', THREADS: 'Threads' };

function PlatformBadges({ platforms }: { platforms: readonly Platform[] }) {
  if (platforms.length === 0) return null;
  return (
    <span style={{ display: 'flex', gap: 4, flex: 'none' }} aria-label={platforms.map((p) => PLATFORM_NAME[p]).join(', ')}>
      {platforms.map((p) => {
        const meta = PLATFORMS.find((x) => x.tag === PLATFORM_TO_TAG[p]);
        return meta ? <PlatformTag key={p} tag={meta.tag} bg={meta.bg} size={18} radius={6} fontSize={9} /> : null;
      })}
    </span>
  );
}

/** "dd/MM HH:mm" theo múi giờ đăng bài. */
const shortWallTime = (iso: string) => {
  const w = wallTime(iso);
  return `${w.slice(8, 10)}/${w.slice(5, 7)} ${w.slice(11, 16)}`;
};

const srOnly = {
  position: 'absolute', width: 1, height: 1, padding: 0, margin: -1, overflow: 'hidden',
  clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap', border: 0,
} as const;

/** Hành động không đáng lưu vào "Đã chọn gần đây". */
const NOT_REMEMBERED = new Set(['action:logout']);

const browserStorage = () => window.localStorage;

/**
 * Ô tìm kiếm toàn cục (Command Palette) — mở bằng ô tìm kiếm trên topbar hoặc Ctrl/⌘+K, mobile toàn màn hình.
 * Tái dùng `Modal` (portal, nền mờ, bẫy focus, Esc, trả focus về nút mở). Combobox ARIA: input giữ focus,
 * `aria-activedescendant` trỏ dòng đang chọn; ↑↓ di chuyển, Enter chọn (bỏ qua khi bộ gõ tiếng Việt đang
 * ghép chữ), Esc đóng.
 *
 * Khi chưa gõ: "Đã chọn gần đây" (tối đa 8, theo userId). Khi gõ: trang & chức năng / khu vực trong trang /
 * hành động nhanh (registry tĩnh, khớp không dấu, lọc theo quyền + khu vực).
 */
export default function CommandPalette({ area }: { area: SearchArea }) {
  const { t, lang, go } = useApp();
  const { user } = useAuth();
  const { isMobile } = useBreakpoint();
  const closePalette = useUiStore((s) => s.closePalette);
  const run = useSearchActions();
  const navigate = useNavigate();
  const toast = useToast();

  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const [history, setHistory] = useState<HistoryEntry[]>(() => (user ? readHistory(browserStorage(), user.id) : []));
  const listRef = useRef<HTMLDivElement>(null);
  const baseId = useId().replace(/:/g, '');
  const listboxId = `${baseId}-listbox`;
  const optionId = (i: number) => `${baseId}-opt-${i}`;

  const ctx = useMemo(() => ({ role: user?.role, area, darkModeEnabled: DARK_MODE_ENABLED }), [user?.role, area]);
  const visible = useMemo(() => visibleItems(SEARCH_REGISTRY, ctx), [ctx]);
  const visibleIds = useMemo(() => new Set(visible.map((it) => it.id)), [visible]);
  const trimmed = query.trim();
  const [data, retryData] = useDataSearch(query, area === 'app');
  const suggestions = useSearchSuggestions(area === 'app' && user ? user.id : null);

  const remember = useCallback((entry: HistoryEntry) => {
    if (user && !NOT_REMEMBERED.has(entry.id)) setHistory(addHistory(browserStorage(), user.id, entry));
  }, [user]);

  const selectStatic = useCallback((item: StaticSearchItem) => {
    remember({ id: item.id, selectedAt: Date.now() });
    closePalette();
    run(item.target);
  }, [remember, closePalette, run]);

  const forget = useCallback((id: string) => {
    if (user) setHistory(removeHistory(browserStorage(), user.id, id));
  }, [user]);

  /** Mở một mục dữ liệu: bài → panel Xem ở thư viện, chiến lược → tab Chiến lược, lịch → chi tiết lịch. */
  const openData = useCallback((snap: DataSnapshot) => {
    if (snap.kind === 'content') go('create', `?view=${encodeURIComponent(snap.refId)}`);
    else if (snap.kind === 'strategy') go('brand', `?tab=strategy&strategy=${encodeURIComponent(snap.refId)}`);
    else navigate(`/calendar/${encodeURIComponent(snap.refId)}`);
  }, [go, navigate]);

  const selectData = useCallback((snap: DataSnapshot) => {
    remember({ id: `${snap.kind}:${snap.refId}`, selectedAt: Date.now(), snapshot: snap });
    closePalette();
    openData(snap);
  }, [remember, closePalette, openData]);

  /** Mục dữ liệu trong lịch sử: kiểm tra còn tồn tại trước khi mở; đã bị xoá → báo + tự gỡ khỏi lịch sử. */
  const reopenData = useCallback((entry: HistoryEntry, snap: DataSnapshot) => {
    const userId = user?.id;
    closePalette();
    const check = snap.kind === 'content' ? getContentItem(snap.refId).then(() => true)
      : snap.kind === 'strategy' ? getContentStrategy(snap.refId).then(() => true)
        : getSchedule(snap.refId).then((sc) => sc.status !== 'CANCELLED');
    check
      .then((alive) => {
        // Lịch đã huỷ: coi như không còn (ô tìm kiếm không trả lịch CANCELLED).
        if (!alive) throw Object.assign(new Error('gone'), { code: 1939 });
        if (userId) addHistory(browserStorage(), userId, { ...entry, selectedAt: Date.now() });
        openData(snap);
      })
      .catch((e: ApiError) => {
        if (e.code !== undefined && GONE_CODES.has(e.code)) {
          if (userId) removeHistory(browserStorage(), userId, entry.id);
          toast.warning(t.gsStale);
        } else {
          toast.error(e.message);
        }
      });
  }, [user?.id, closePalette, openData, toast, t]);

  const suggestionRow = useCallback((sg: SearchSuggestion, i: number): Row => {
    const close = (fn: () => void) => () => { closePalette(); fn(); };
    switch (sg.kind) {
      case 'brand':
        return { key: `suggest:${i}`, group: 'suggest', icon: Star, label: t.gsSugNoBrand, onSelect: close(() => go('brand')) };
      case 'review':
        return { key: `suggest:${i}`, group: 'suggest', icon: ClipboardCheck, label: t.gsSugReview.replace('{n}', String(sg.count)),
          onSelect: close(() => go('create')) };
      case 'failed':
        return { key: `suggest:${i}`, group: 'suggest', icon: AlertTriangle, label: t.gsSugFailed.replace('{n}', String(sg.count)),
          onSelect: close(() => go('failedPosts')) };
      case 'connect':
        return { key: `suggest:${i}`, group: 'suggest', icon: Plug, label: t.gsSugConnect.replace('{platform}', PLATFORM_NAME[sg.platform]),
          aside: <PlatformBadges platforms={[sg.platform]} />, onSelect: close(() => go('settings', '?tab=connections')) };
    }
  }, [t, closePalette, go]);

  const staticRow = useCallback((item: StaticSearchItem, group: RowGroup, ranges?: Range[], label?: string, desc?: string): Row => ({
    key: `${group}:${item.id}`,
    group,
    icon: item.icon,
    label: label ?? item.label(t),
    desc: desc ?? item.desc?.(t),
    ranges,
    onSelect: () => selectStatic(item),
    onRemove: group === 'recent' ? () => forget(item.id) : undefined,
  }), [t, selectStatic, forget]);

  const rows: Row[] = useMemo(() => {
    if (!trimmed) {
      // Lịch sử: mục tĩnh dịch lại theo ngôn ngữ đang bật; mục user không còn quyền thấy thì ẩn.
      return history.flatMap((entry): Row[] => {
        const item = REGISTRY_BY_ID.get(entry.id);
        if (item) return visibleIds.has(item.id) ? [staticRow(item, 'recent')] : [];
        if (!entry.snapshot || area !== 'app') return [];
        const snap = entry.snapshot;
        return [{
          key: `recent:${entry.id}`,
          group: 'recent',
          icon: DATA_ICONS[snap.kind],
          label: snap.title,
          desc: snap.kind === 'content' ? t.gsGroupContent : snap.kind === 'strategy' ? t.gsGroupStrategies : t.gsGroupSchedules,
          aside: snap.platform ? <PlatformBadges platforms={[snap.platform as Platform]} /> : undefined,
          onSelect: () => reopenData(entry, snap),
          onRemove: () => forget(entry.id),
        }];
      }).concat(suggestions.map(suggestionRow));
    }
    const statics = rankStatic(visible, trimmed, t)
      .map((r) => ({ ...staticRow(r.item, r.item.group as RowGroup, r.ranges, r.label, r.desc), score: r.score }));
    const dataRows: Row[] = [];
    if (data.status === 'ok' && data.query === trimmed) {
      // Khớp ở server (có thể trong caption chứ không ở tiêu đề) → điểm theo tiêu đề nếu khớp, không thì điểm nền.
      const ranges = (label: string) => matchItem(trimmed, { label })?.ranges;
      const scoreOf = (label: string) => matchItem(trimmed, { label })?.score ?? 20;
      data.result.contents.forEach((c) => dataRows.push({
        key: `content:${c.id}`, group: 'content', icon: DATA_ICONS.content, label: c.title, ranges: ranges(c.title), score: scoreOf(c.title),
        desc: [t[CONTENT_STATUS_META[c.status].labelKey] as string, c.brandName].filter(Boolean).join(' · '),
        aside: <PlatformBadges platforms={c.platforms} />,
        onSelect: () => selectData({ kind: 'content', refId: c.id, title: c.title, platform: c.platforms[0] ?? null }),
      }));
      data.result.strategies.forEach((st) => dataRows.push({
        key: `strategy:${st.id}`, group: 'strategies', icon: DATA_ICONS.strategy, label: st.name, ranges: ranges(st.name), score: scoreOf(st.name),
        desc: st.status === 'ACTIVE' ? t.trStrategyActive : st.status === 'PAUSED' ? t.trStrategyPaused : t.trStrategyDraft,
        aside: <PlatformBadges platforms={st.platforms} />,
        onSelect: () => selectData({ kind: 'strategy', refId: st.id, title: st.name, platform: st.platforms[0] ?? null }),
      }));
      data.result.schedules.forEach((sc) => {
        const v = sc.contentVersion;
        const title = v?.script?.hook?.content?.trim() || v?.formattedCaption?.trim() || sc.platformAccountName;
        dataRows.push({
          key: `schedule:${sc.id}`, group: 'schedules', icon: DATA_ICONS.schedule, label: title, ranges: ranges(title), score: scoreOf(title),
          desc: [t[`schSt${sc.status}` as keyof Dict] as string, shortWallTime(sc.scheduledTime), sc.platformAccountName].join(' · '),
          aside: <PlatformBadges platforms={[sc.platformName]} />,
          onSelect: () => selectData({ kind: 'schedule', refId: sc.id, title, platform: sc.platformName }),
        });
      });
    }
    // Nhóm xếp theo mục điểm cao nhất (bằng điểm → thứ tự mặc định); trong nhóm giữ thứ tự điểm/của server.
    const all = [...statics, ...dataRows];
    const best = new Map<RowGroup, number>();
    all.forEach((r) => best.set(r.group, Math.max(best.get(r.group) ?? 0, r.score ?? 0)));
    const rank = (g: RowGroup) => -(best.get(g) ?? 0) * 100 + GROUP_ORDER.indexOf(g);
    return all.sort((a, b) => rank(a.group) - rank(b.group));
  }, [trimmed, history, visible, visibleIds, t, area, staticRow, forget, suggestions, suggestionRow, data, selectData, reopenData]);

  // Đổi từ khóa / danh sách → dòng đầu tiên được chọn.
  useEffect(() => setActive(0), [trimmed, rows.length]);

  // Đăng xuất (user = null) → đóng ngay, không để lộ lịch sử cho người dùng sau.
  useEffect(() => {
    if (!user) closePalette();
  }, [user, closePalette]);

  // Dòng đang chọn luôn trong tầm nhìn khi đi bằng bàn phím.
  useEffect(() => {
    document.getElementById(optionId(active))?.scrollIntoView({ block: 'nearest' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  const onKeyDown = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    // Bộ gõ tiếng Việt (Telex/VNI, bàn phím tiếng Việt của Windows/macOS) đang ghép chữ: Enter/mũi tên thuộc về IME.
    if (e.nativeEvent.isComposing || e.keyCode === 229) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (rows.length === 0) return;
      const step = e.key === 'ArrowDown' ? 1 : -1;
      setActive((i) => (i + step + rows.length) % rows.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      rows[active]?.onSelect();
    } else if (e.key === 'Delete' && !trimmed && rows[active]?.onRemove) {
      e.preventDefault();
      rows[active].onRemove?.();
    }
  };

  const clearAll = () => {
    if (!user) return;
    clearHistory(browserStorage(), user.id);
    setHistory([]);
  };

  // Nhóm theo đúng thứ tự xuất hiện trong `rows` (đã xếp) — chỉ số option khớp thứ tự ↑↓.
  const groups = [...new Set(rows.map((r) => r.group))]
    .map((g) => ({ group: g, items: rows.map((row, index) => ({ row, index })).filter((x) => x.row.group === g) }));

  const activeRow = rows[active];
  const groupTotals: Partial<Record<RowGroup, number>> = data.status === 'ok' && data.query === trimmed
    ? { content: data.result.contentTotal, strategies: data.result.strategyTotal, schedules: data.result.scheduleTotal }
    : {};
  const dataPending = area === 'app' && trimmed.length >= MIN_DATA_QUERY
    && (data.status === 'loading' || (data.status === 'ok' && data.query !== trimmed));
  const placeholder = area === 'admin' ? t.gsPhAdmin : t.searchPh;

  return (
    <Modal title={t.gsDialog} onClose={closePalette} bare placement="top" fullScreen={isMobile} maxWidth={640} animateScale>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: isMobile ? '12px 14px' : '14px 18px', borderBottom: `1px solid ${C.border}`, flex: 'none' }}>
        <Search size={19} color={C.ink350} strokeWidth={1.9} style={{ flex: 'none' }} aria-hidden />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          lang={lang}
          role="combobox"
          aria-expanded={rows.length > 0}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-activedescendant={activeRow ? optionId(active) : undefined}
          aria-label={placeholder}
          autoComplete="off"
          spellCheck={false}
          enterKeyHint="go"
          style={{ flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'transparent', fontSize: 16, color: C.textStrong, padding: '4px 0' }}
        />
        <button type="button" onClick={closePalette} aria-label={t.gsKeyClose} title={t.gsKeyClose}
          style={{
            width: 30, height: 30, flex: 'none', border: 'none', borderRadius: 9, background: C.surfaceMuted,
            color: C.textSecondary, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
          <X size={16} strokeWidth={2} />
        </button>
      </div>

      <div ref={listRef} style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '6px 8px 10px' }}>
        <div id={listboxId} role="listbox" aria-label={t.gsDialog}>
        {groups.map(({ group, items }) => (
          <div key={group} role="group" aria-labelledby={`${baseId}-g-${group}`}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 10px 6px' }}>
              <span id={`${baseId}-g-${group}`} style={{ fontSize: 11.5, fontWeight: 800, letterSpacing: '.04em', textTransform: 'uppercase', color: C.textMuted }}>
                {GROUP_LABEL[group](t)}
              </span>
              {(groupTotals[group] ?? 0) > items.length && (
                <span style={{ fontSize: 12, color: C.textMuted }}>{t.gsMore.replace('{n}', String((groupTotals[group] ?? 0) - items.length))}</span>
              )}
              {group === 'recent' && (
                <button type="button" onClick={clearAll}
                  style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer', fontSize: 12, fontWeight: 700, color: C.primary }}>
                  {t.gsClearAll}
                </button>
              )}
            </div>
            {items.map(({ row, index }) => (
              <PaletteRow key={row.key} id={optionId(index)} row={row} active={index === active}
                onHover={() => setActive(index)} removeLabel={t.gsRemove} />
            ))}
          </div>
        ))}

        </div>

        {/* Trạng thái nhóm dữ liệu (nằm NGOÀI listbox — không phải option). */}
        {dataPending && (
          <div role="status" style={statusLine}>
            <Loader2 size={15} className="gs-spin" aria-hidden /> {t.gsDataLoading}
          </div>
        )}
        {area === 'app' && data.status === 'error' && (
          <div role="alert" style={statusLine}>
            <span>{t.gsDataError}</span>
            <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={retryData}
              style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer', color: C.primary, fontWeight: 700, fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <RefreshCw size={13} aria-hidden /> {t.retry}
            </button>
          </div>
        )}
        {area === 'app' && trimmed.length > 0 && trimmed.length < MIN_DATA_QUERY && (
          <div style={statusLine}>{t.gsMinChars}</div>
        )}

        {groups.length === 0 && !dataPending && (
          <div style={{ padding: '28px 16px', textAlign: 'center' }}>
            {trimmed ? (
              <>
                <div style={{ fontSize: 14, fontWeight: 700, color: C.textStrong }}>{t.gsNoResults.replace('{q}', trimmed)}</div>
                <div style={{ fontSize: 13, color: C.textMuted, marginTop: 6 }}>{t.gsNoResultsHint}</div>
              </>
            ) : (
              <div style={{ fontSize: 13.5, color: C.textMuted }}>{t.gsEmptyHint}</div>
            )}
          </div>
        )}
      </div>

      <span aria-live="polite" style={srOnly}>
        {trimmed ? (rows.length === 0 ? t.gsNoResults.replace('{q}', trimmed) : t.gsResultCount.replace('{n}', String(rows.length))) : ''}
      </span>

      {!isMobile && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '9px 18px', borderTop: `1px solid ${C.border}`, fontSize: 12, color: C.textMuted, flex: 'none' }}>
          <span><kbd style={kbdStyle}>↑</kbd> <kbd style={kbdStyle}>↓</kbd> {t.gsKeyNavigate}</span>
          <span><kbd style={kbdStyle}>↵</kbd> {t.gsKeySelect}</span>
          <span><kbd style={kbdStyle}>Esc</kbd> {t.gsKeyClose}</span>
        </div>
      )}
    </Modal>
  );
}

const statusLine = {
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '10px 12px',
  fontSize: 13, color: C.textMuted,
} as const;

const kbdStyle = {
  fontFamily: 'inherit', fontSize: 11, fontWeight: 700, color: C.textMuted, background: C.surfaceMuted,
  border: `1px solid ${C.border}`, borderRadius: 6, padding: '1px 6px',
} as const;

function PaletteRow({ id, row, active, onHover, removeLabel }: {
  id: string;
  row: Row;
  active: boolean;
  onHover: () => void;
  removeLabel: string;
}) {
  const Icon = row.icon;
  return (
    <div
      id={id}
      role="option"
      aria-selected={active}
      onMouseMove={active ? undefined : onHover}
      // mousedown giữ focus ở ô nhập (không để nút/option cướp focus trước khi click xử lý).
      onMouseDown={(e) => e.preventDefault()}
      onClick={row.onSelect}
      style={{
        display: 'flex', alignItems: 'center', gap: 12, padding: '8px 10px', borderRadius: 11, cursor: 'pointer',
        background: active ? C.primarySoft : 'transparent',
      }}
    >
      <span style={{
        width: 32, height: 32, borderRadius: 9, flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: active ? C.surface : C.surfaceMuted, color: active ? C.primary : C.ink550,
      }}>
        <Icon size={16} strokeWidth={1.9} aria-hidden />
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 14, fontWeight: 600, color: C.textStrong, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          <HighlightText text={row.label} ranges={row.ranges} />
        </span>
        {row.desc && (
          <span style={{ display: 'block', fontSize: 12, color: C.textMuted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {row.desc}
          </span>
        )}
      </span>
      {row.aside}
      {row.onRemove && (
        <button
          type="button"
          tabIndex={-1}
          aria-label={removeLabel}
          title={removeLabel}
          onClick={(e) => { e.stopPropagation(); row.onRemove?.(); }}
          style={{ border: 'none', background: 'none', padding: 4, borderRadius: 7, cursor: 'pointer', color: C.textMuted, display: 'flex', flex: 'none' }}
        >
          <X size={15} />
        </button>
      )}
      {active && !row.onRemove && <CornerDownLeft size={15} color={C.primary} aria-hidden style={{ flex: 'none' }} />}
    </div>
  );
}
