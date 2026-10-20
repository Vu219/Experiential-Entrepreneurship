import { C } from '../../styles/colors';
import { useRealtimeRefresh } from '../../hooks/useRealtimeRefresh';
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AlertTriangle, Download } from 'lucide-react';
import { useApp } from '../../context/AppContext.tsx';
import { useBreakpoint } from '../../hooks/useBreakpoint.ts';
import { useTabParam } from '../../hooks/useTabParam.ts';
import { SearchInput } from '../../components/admin/AdminListPage.tsx';
import { useToast } from '../../components/toast/ToastProvider.tsx';
import ConfirmModal from '../../components/ConfirmModal.tsx';
import { Card } from '../../components/ui.tsx';
import type { ApiError } from '../../api/apiClient.ts';
import { cancelSchedule } from '../../api/schedules.ts';
import {
  bulkFailedPosts, dismissFailedPost, getPlatformStatus, listFailedPosts, retryFailedPost,
  type FailedPost, type FailedPostBulkAction, type PlatformIncident,
} from '../../api/failedPosts.ts';
import {
  platformDisplayName, publishErrorCategoryLabel, publishErrorCopy, type PublishErrorAction,
  type PublishErrorCategory, type PublishErrorCode,
} from '../../api/publishErrorCatalog.ts';
import { mockFailedPosts } from '../../failedPostsMock.ts';
import TabBar, { type FpTab } from '../../components/failedPosts/TabBar.tsx';
import FilterBar, { type FpFilterOptions } from '../../components/failedPosts/FilterBar.tsx';
import FailedPostList from '../../components/failedPosts/FailedPostList.tsx';
import ErrorDetailModal from '../../components/failedPosts/ErrorDetailModal.tsx';
import ErrorOverviewPanel from '../../components/failedPosts/ErrorOverviewPanel.tsx';
import RootCauseBanner from '../../components/failedPosts/RootCauseBanner.tsx';
import BulkBar from '../../components/failedPosts/BulkBar.tsx';
import EmailOptInBanner from '../../components/failedPosts/EmailOptInBanner.tsx';
import AiFixModal, { type AiFixOutcome } from '../../components/aiAssist/AiFixModal.tsx';
import type { AiFixApplyResult } from '../../api/aiAssist.ts';
import { getNotificationPreferences, type NotificationPreferences } from '../../api/notificationPreferences.ts';
import { groupRootCauses, type RootCauseGroup } from '../../components/failedPosts/rootCause.ts';
import {
  EMPTY_FILTERS, fmtDate, fmtTime, matchesFilters, PLATFORM_HOME, stateLabel, type FpFilters,
} from '../../components/failedPosts/shared.ts';
import PageContainer from '../../components/PageContainer';
import { TONE_COLORS } from '../../statusTokens.ts';

// Trang "Bài lỗi & cần xử lý" (FR-35..FR-39) — dashboard master–detail:
// header full-width, dưới là grid 2 cột (desktop): TRÁI = banner nguyên nhân gốc + tab vòng đời + bộ lọc + bảng
// (chọn nhiều → thao tác hàng loạt); PHẢI = panel "Tổng quan lỗi" sticky, tổng hợp theo tab/bộ lọc.
// Bấm 1 dòng → modal "Chi tiết lỗi" (chuyện gì / vì sao / cách khắc phục / hành động / timeline / mã tham chiếu).
// Mọi câu chữ về lỗi đi qua catalog theo MÃ chuẩn — không hiển thị message gốc của nền tảng.
// Dữ liệu nạp 1 lần (mọi vòng đời) rồi lọc/tìm/phân trang client-side. Dữ liệu minh hoạ CHỈ ở môi trường dev
// (rỗng / không gọi được máy chủ); production: rỗng → empty state, lỗi → khối lỗi + Tải lại.

const isMock = (p: FailedPost) => p.id.startsWith('mock-');

const FP_TABS: readonly FpTab[] = ['NEEDS_ACTION', 'AUTO_RETRYING', 'DISMISSED'];

export default function FailedPosts() {
  const { t, lang, brandGradient } = useApp();
  const { width, isDesktop } = useBreakpoint();
  const toast = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Mobile / tablet / laptop: 5 dòng/trang; PC lớn (>1440px): 8.
  const pageSize = width > 1440 ? 8 : 5;

  const [posts, setPosts] = useState<FailedPost[]>([]);
  const [loadState, setLoadState] = useState<'loading' | 'ok' | 'error'>('loading');
  const [demo, setDemo] = useState(false);

  // Tab trên URL (?tab=AUTO_RETRYING|DISMISSED) — ô tìm kiếm toàn cục / link ngoài mở thẳng một tab.
  const [tab, setTab] = useTabParam<FpTab>(FP_TABS, 'NEEDS_ACTION');
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  // Khoảng ngày nhận được từ URL (?from=&to=) — trang Phân tích điều hướng sang đây kèm đúng kỳ
  // đang lọc ở ô "Bài lỗi & cần xử lý", để hai màn hình hiển thị cùng một tập bài.
  const [filters, setFilters] = useState<FpFilters>(() => ({
    ...EMPTY_FILTERS,
    from: searchParams.get('from') ?? '',
    to: searchParams.get('to') ?? '',
  }));
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [overviewOpen, setOverviewOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [checked, setChecked] = useState<Set<string>>(() => new Set());
  const [changeTarget, setChangeTarget] = useState<FailedPost | null>(null);
  const [incidents, setIncidents] = useState<PlatformIncident[]>([]);
  const [aiFixTarget, setAiFixTarget] = useState<FailedPost | null>(null);
  const [emailPrefs, setEmailPrefs] = useState<NotificationPreferences | null>(null);

  // Banner hỏi email chỉ cần preference; lỗi tải → không hỏi (không chặn trang).
  useEffect(() => {
    getNotificationPreferences().then(setEmailPrefs).catch(() => setEmailPrefs(null));
  }, []);

  // Nạp TOÀN BỘ bài lỗi mọi vòng đời 1 lần (gộp các trang server) để lọc/tìm/phân trang client-side.
  const loadAll = useCallback(async (silent = false) => {
    if (!silent) setLoadState('loading');
    let all: FailedPost[] = [];
    try {
      for (let pageNo = 0; pageNo < 20; pageNo++) {
        const res = await listFailedPosts({ filter: 'ALL', state: 'ALL', page: pageNo, size: 100 });
        all = all.concat(res.content);
        if (res.last) break;
      }
    } catch {
      if (import.meta.env.DEV) {
        all = mockFailedPosts();
        setDemo(true);
        setPosts(all);
        setLoadState('ok');
        return;
      }
      setPosts([]);
      setLoadState('error');
      return;
    }
    const useDemo = all.length === 0 && import.meta.env.DEV;
    if (useDemo) all = mockFailedPosts();
    all.sort((a, b) => (b.failedAt ?? '').localeCompare(a.failedAt ?? ''));
    setPosts(all);
    setDemo(useDemo);
    setLoadState('ok');
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);
  // Realtime: bài vừa lỗi chung cuộc / vào chu kỳ thử lại / đăng lại thành công → nạp lại lặng lẽ (không nháy skeleton).
  useRealtimeRefresh(['post.updated', 'ready'], () => { void loadAll(true); }, 800);
  // Sự cố nền tảng đang mở (banner) — lỗi khi tải chỉ đơn giản là không hiện banner.
  useEffect(() => { getPlatformStatus().then(setIncidents).catch(() => setIncidents([])); }, []);

  // ===== Lọc client-side: tìm kiếm + bộ lọc (chưa tính tab) → badge số lượng trên tab =====
  const baseFiltered = useMemo(() => {
    const q = deferredSearch.trim().toLowerCase();
    return posts.filter((p) => {
      if (!matchesFilters(p, filters)) return false;
      if (q) {
        const title = publishErrorCopy(lang, p.code, { platform: platformDisplayName(p.platformName), account: p.accountName }).title;
        const hay = [p.caption, p.accountName, p.referenceCode, p.errorCode, title].filter(Boolean).join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [posts, deferredSearch, filters, lang]);

  const counts = useMemo<Record<FpTab, number>>(() => ({
    NEEDS_ACTION: baseFiltered.filter((p) => p.state === 'NEEDS_ACTION').length,
    AUTO_RETRYING: baseFiltered.filter((p) => p.state === 'AUTO_RETRYING').length,
    DISMISSED: baseFiltered.filter((p) => p.state === 'DISMISSED').length,
  }), [baseFiltered]);

  const filtered = useMemo(() => baseFiltered.filter((p) => p.state === tab), [baseFiltered, tab]);
  const rootGroups = useMemo(() => (tab === 'NEEDS_ACTION' ? groupRootCauses(baseFiltered) : []), [baseFiltered, tab]);

  const filterOptions = useMemo<FpFilterOptions>(() => {
    const accounts = new Map<string, string>();
    const categories = new Set<PublishErrorCategory>();
    const codes = new Set<PublishErrorCode>();
    for (const p of posts) {
      if (p.accountId) accounts.set(p.accountId, `${p.accountName ?? '—'} · ${platformDisplayName(p.platformName)}`);
      categories.add(p.category);
      codes.add(p.code);
    }
    return {
      accounts: [...accounts.entries()].map(([id, name]) => ({ id, name })),
      categories: [...categories],
      codes: [...codes],
    };
  }, [posts]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const pageItems = useMemo(() => filtered.slice((safePage - 1) * pageSize, safePage * pageSize), [filtered, safePage, pageSize]);

  const selectedIndex = useMemo(() => filtered.findIndex((p) => p.id === selectedId), [filtered, selectedId]);
  const selected = selectedIndex >= 0 ? filtered[selectedIndex] : null;

  // Đổi tab / bộ lọc / tìm kiếm → về trang 1 + bỏ chọn bài đang mở + bỏ chọn hàng loạt.
  const resetView = () => { setPage(1); setSelectedId(null); setDetailOpen(false); setChecked(new Set()); };
  const changeTab = (next: FpTab) => { setTab(next); resetView(); };
  // Tab đổi từ URL (palette, nút Back) chứ không qua TabBar → vẫn về trang 1 và bỏ chọn như khi bấm tab.
  const lastTab = useRef(tab);
  useEffect(() => {
    if (lastTab.current === tab) return;
    lastTab.current = tab;
    resetView();
  }, [tab]);
  const changeFilters = (f: FpFilters) => { setFilters(f); resetView(); };
  const changeSearch = (q: string) => { setSearch(q); resetView(); };
  const changePage = (next: number) => { setPage(next); setChecked(new Set()); };

  const selectPost = useCallback((id: string) => {
    setSelectedId(id);
    setDetailOpen(true);
  }, []);

  // Deep link ?post=<postId> (bấm thông báo "Đăng bài thất bại") → mở chi tiết bài đó MỘT lần sau khi tải xong.
  const deepLinkPost = useRef(searchParams.get('post'));
  useEffect(() => {
    const id = deepLinkPost.current;
    if (!id || loadState !== 'ok') return;
    deepLinkPost.current = null;
    if (posts.some((p) => p.id === id)) selectPost(id);
  }, [loadState, posts, selectPost]);

  const toggleChecked = useCallback((id: string) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const toggleAllOnPage = () => {
    setChecked((prev) => {
      const allOn = pageItems.length > 0 && pageItems.every((p) => prev.has(p.id));
      const next = new Set(prev);
      pageItems.forEach((p) => (allOn ? next.delete(p.id) : next.add(p.id)));
      return next;
    });
  };

  // Trước/Sau trong modal: lướt trong danh sách đã lọc, đồng bộ trang chứa bài đang xem.
  const navigateDetail = (dir: -1 | 1) => {
    const next = filtered[selectedIndex + dir];
    if (!next) return;
    setSelectedId(next.id);
    setPage(Math.floor((selectedIndex + dir) / pageSize) + 1);
  };

  const copyReference = useCallback((reference: string, message: string = t.fpReferenceCopied) => {
    navigator.clipboard?.writeText(reference).then(() => toast.success(message)).catch(() => toast.info(reference));
  }, [t, toast]);

  // Dữ liệu minh hoạ: mô phỏng kết quả tại chỗ, không gọi API.
  const applyDemo = (ids: string[], action: FailedPostBulkAction) => {
    setPosts((prev) => action === 'DISMISS'
      ? prev.map((p) => (ids.includes(p.id) ? { ...p, state: 'DISMISSED', actions: p.actions.filter((a) => a !== 'DISMISS') } : p))
      : prev.filter((p) => !ids.includes(p.id)));
  };

  const runBulk = async (action: FailedPostBulkAction, ids: string[]) => {
    if (busy || ids.length === 0) return;
    if (demo || ids.every((id) => id.startsWith('mock-'))) {
      applyDemo(ids, action);
      toast.success(t.fpBulkDone.replace('{ok}', String(ids.length)).replace('{total}', String(ids.length)));
      setChecked(new Set());
      return;
    }
    setBusy(true);
    try {
      const result = await bulkFailedPosts(action, ids);
      toast.success(t.fpBulkDone.replace('{ok}', String(result.succeeded)).replace('{total}', String(ids.length)));
      const firstFailure = result.results.find((r) => r.code !== 200);
      if (firstFailure) {
        toast.warning(t.fpBulkSomeFailed.replace('{n}', String(result.failed)).replace('{reason}', firstFailure.message));
      }
      setChecked(new Set());
      await loadAll();
    } catch (e) {
      toast.error((e as ApiError).message);
    }
    setBusy(false);
  };

  // ===== Hành động theo actions[] của backend (tái dùng /schedules, thư viện nội dung, Cài đặt → Kết nối) =====
  const runAction = async (action: PublishErrorAction, post: FailedPost) => {
    if (busy) return;
    switch (action) {
      case 'RECONNECT_ACCOUNT':
        navigate('/settings?tab=connections');
        return;
      case 'EDIT_CONTENT':
        if (post.contentItemId && !isMock(post)) navigate(`/create?view=${post.contentItemId}&edit=1`);
        else navigate('/create');
        return;
      case 'OPEN_PLATFORM':
        window.open(PLATFORM_HOME[post.platformName], '_blank', 'noopener,noreferrer');
        return;
      case 'CONTACT_SUPPORT':
        if (post.referenceCode) copyReference(post.referenceCode, t.fpSupportCopied);
        return;
      case 'CHANGE_ACCOUNT':
        setChangeTarget(post);
        return;
      case 'AI_FIX':
        // Chỉ gọi AI khi người dùng bấm: mở modal = bắt đầu một lần AI sửa (đóng chi tiết để không chồng 2 lớp).
        if (isMock(post) || !post.contentVersionId) return;
        setDetailOpen(false);
        setAiFixTarget(post);
        return;
      case 'DISMISS':
      case 'RETRY_NOW':
        break;
    }
    if (isMock(post)) {
      applyDemo([post.id], action === 'DISMISS' ? 'DISMISS' : 'RETRY');
      setDetailOpen(false);
      toast.success(action === 'DISMISS' ? t.fpDismissedToast : t.fpRetryStarted);
      return;
    }
    setBusy(true);
    try {
      if (action === 'DISMISS') {
        await dismissFailedPost(post.id);
        toast.success(t.fpDismissedToast);
      } else {
        const result = await retryFailedPost(post.id);
        if (result.jobId) toast.success(t.fpRetryStarted);
        else toast.warning(t.fpRetryHeld);
      }
      setDetailOpen(false);
      await loadAll();
    } catch (e) {
      toast.error((e as ApiError).message);
    }
    setBusy(false);
  };

  // Áp dụng gợi ý AI: đăng lại ngay, hoặc lưu rồi huỷ lịch lỗi + mở bước lên lịch (giống "Lên lịch lại").
  const onAiFixApplied = async (outcome: AiFixOutcome, result: AiFixApplyResult) => {
    const post = aiFixTarget;
    setAiFixTarget(null);
    if (!post) return;
    if (outcome === 'SCHEDULE') {
      try {
        await cancelSchedule(post.scheduleId);
        toast.success(t.aiFixApplied);
        navigate(post.contentItemId ? `/create/${post.contentItemId}?step=4` : '/calendar');
      } catch (e) {
        toast.error((e as ApiError).message);
        await loadAll();
      }
      return;
    }
    if (outcome === 'RETRY' && result.retry && !result.retry.jobId) toast.warning(t.fpRetryHeld);
    else toast.success(outcome === 'RETRY' ? t.aiFixAppliedRetry : t.aiFixApplied);
    await loadAll();
  };

  // "Lên lịch lại": huỷ lịch lỗi (nội dung giữ nguyên) rồi mở bước lên lịch của bài để chọn tài khoản khác.
  const confirmChangeAccount = async () => {
    const post = changeTarget;
    if (!post) return;
    if (isMock(post)) {
      setChangeTarget(null);
      navigate('/create');
      return;
    }
    setBusy(true);
    try {
      await cancelSchedule(post.scheduleId);
      setChangeTarget(null);
      navigate(post.contentItemId ? `/create/${post.contentItemId}?step=4` : '/calendar');
    } catch (e) {
      toast.error((e as ApiError).message);
    }
    setBusy(false);
  };

  const showGroup = (g: RootCauseGroup) => changeFilters({ ...EMPTY_FILTERS, account: g.accountId, code: g.code });

  // Xuất báo cáo CSV theo danh sách đang lọc — câu thân thiện + mã tham chiếu, KHÔNG có message thô.
  // BOM UTF-8 để mở đúng tiếng Việt trong Excel.
  const exportReport = () => {
    const esc = (v: string | null) => `"${(v ?? '').replace(/"/g, '""')}"`;
    const rows = [
      [t.fpColTime, t.fpColPlatform, t.fpColPost, t.fpColStatus, t.fpAllCategories, t.fpColReason, t.fpReference]
        .map((h) => esc(h)).join(','),
      ...filtered.map((p) => [
        esc(p.failedAt ? `${fmtDate(p.failedAt)} ${fmtTime(p.failedAt)}` : ''),
        esc(platformDisplayName(p.platformName)),
        esc(`${p.accountName ?? ''} — ${p.caption ?? ''}`),
        esc(stateLabel(p.state, t)),
        esc(publishErrorCategoryLabel(lang, p.category)),
        esc(publishErrorCopy(lang, p.code, { platform: platformDisplayName(p.platformName), account: p.accountName }).title),
        esc(p.referenceCode),
      ].join(',')),
    ];
    const blob = new Blob(['﻿' + rows.join('\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `failed-posts-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const emptyLabel = tab === 'NEEDS_ACTION' ? t.fpEmpty : tab === 'AUTO_RETRYING' ? t.fpEmptyRetrying : t.fpEmptyDismissed;
  const selectable = tab !== 'AUTO_RETRYING';

  // Cột trái của grid: nguyên nhân gốc → tab → bộ lọc → banner demo → thanh hàng loạt → bảng + phân trang.
  const leftColumn = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
      {incidents.map((i) => (
        <div key={i.platform} role="status" style={{ display: 'flex', gap: 10, alignItems: 'center', background: TONE_COLORS.warning.bg, borderRadius: 12, padding: '10px 14px', fontSize: 13, color: C.ink750 }}>
          <AlertTriangle size={17} color={TONE_COLORS.warning.color} strokeWidth={2} aria-hidden style={{ flex: 'none' }} />
          {t.fpOutage.split('{platform}').join(platformDisplayName(i.platform))}
        </div>
      ))}
      {!demo && emailPrefs?.emailAvailable && emailPrefs.emailPromptStatus === 'NOT_ASKED'
        && posts.some((p) => p.state === 'NEEDS_ACTION') && (
        <EmailOptInBanner onAnswered={setEmailPrefs} />
      )}
      <RootCauseBanner
        groups={rootGroups}
        busy={busy}
        onReconnect={() => navigate('/settings?tab=connections')}
        onRetryAll={(g) => runBulk('RETRY', g.postIds)}
        onShow={showGroup}
      />
      <TabBar tab={tab} counts={counts} onChange={changeTab} />
      <FilterBar filters={filters} options={filterOptions} onChange={changeFilters} />
      {demo && loadState === 'ok' && (
        <div style={{ fontSize: 12, color: C.legacyText7c6f4f, background: C.legacyBgfdf6e7, border: `1px solid ${C.legacyBorderf3e6c4}`, borderRadius: 9, padding: '8px 11px' }}>
          {t.fpDemo}
        </div>
      )}
      <BulkBar
        count={checked.size}
        busy={busy}
        canDismiss={tab === 'NEEDS_ACTION'}
        onRetry={() => runBulk('RETRY', [...checked])}
        onDismiss={() => runBulk('DISMISS', [...checked])}
        onClear={() => setChecked(new Set())}
      />
      {loadState === 'error' ? (
        <Card style={{ padding: '36px 18px', textAlign: 'center' }}>
          <AlertTriangle size={22} color={C.warning} style={{ marginBottom: 8 }} aria-hidden />
          <div style={{ fontSize: 14, fontWeight: 600, color: C.ink650, marginBottom: 12 }}>{t.fpLoadError}</div>
          <button onClick={() => loadAll()} className="btn-grad"
            style={{ border: 'none', borderRadius: 10, padding: '9px 16px', fontSize: 13, fontWeight: 700, color: C.onBrand, background: brandGradient, cursor: 'pointer' }}>
            {t.fpReload}
          </button>
        </Card>
      ) : (
        /* Dưới lg (tablet/mobile): danh sách card thay vì bảng cuộn ngang. */
        <FailedPostList
          items={pageItems}
          loading={loadState === 'loading'}
          emptyLabel={emptyLabel}
          selectedId={selectedId}
          checkedIds={checked}
          selectable={selectable}
          onSelect={selectPost}
          onToggle={toggleChecked}
          onToggleAll={toggleAllOnPage}
          page={safePage}
          pageCount={pageCount}
          onPageChange={changePage}
          variant={isDesktop ? 'table' : 'cards'}
        />
      )}
    </div>
  );

  return (
    <PageContainer>
      {/* Thanh công cụ: tìm kiếm + xuất báo cáo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
        <SearchInput value={search} onChange={changeSearch} placeholder={t.fpSearchPh} />
        <button
          onClick={exportReport}
          disabled={filtered.length === 0}
          className="btn-grad"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 7, border: 'none', borderRadius: 10, padding: '10px 16px', fontSize: 13, fontWeight: 700, color: C.onBrand, background: brandGradient, cursor: filtered.length === 0 ? 'default' : 'pointer', whiteSpace: 'nowrap', opacity: filtered.length === 0 ? 0.6 : 1 }}
        >
          <Download size={14} strokeWidth={2} />
          {t.fpExport}
        </button>
      </div>

      {isDesktop ? (
        /* Laptop/PC: 2 cột cùng bắt đầu ngay dưới header — đỉnh "Tổng quan lỗi" TRÙNG hàng đầu cột trái.
           alignItems start để cột phải không bị kéo giãn; sticky để bám khi cuộn danh sách. */
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 62fr) minmax(0, 38fr)', gap: 16, alignItems: 'start' }}>
          {leftColumn}
          <div style={{ position: 'sticky', top: 16, minWidth: 0 }}>
            <ErrorOverviewPanel items={filtered} />
          </div>
        </div>
      ) : (
        /* Mobile/Tablet: 1 cột — tổng quan collapse được lên đầu, rồi tab + bộ lọc + danh sách */
        <>
          <ErrorOverviewPanel items={filtered} collapsible open={overviewOpen} onToggle={() => setOverviewOpen((v) => !v)} />
          {leftColumn}
        </>
      )}

      {detailOpen && selected && (
        <ErrorDetailModal
          post={selected}
          index={selectedIndex}
          total={filtered.length}
          busy={busy}
          demo={demo || isMock(selected)}
          onClose={() => setDetailOpen(false)}
          onNavigate={navigateDetail}
          onAction={runAction}
          onCopyReference={(ref) => copyReference(ref)}
        />
      )}

      {aiFixTarget?.contentVersionId && (
        <AiFixModal
          contentVersionId={aiFixTarget.contentVersionId}
          postId={aiFixTarget.id}
          onClose={() => setAiFixTarget(null)}
          onApplied={onAiFixApplied}
        />
      )}

      {changeTarget && (
        <ConfirmModal
          title={t.fpChangeTitle}
          message={t.fpChangeMsg}
          confirmLabel={t.fpChangeConfirm}
          variant="warning"
          busy={busy}
          onConfirm={confirmChangeAccount}
          onClose={() => setChangeTarget(null)}
        />
      )}
    </PageContainer>
  );
}
