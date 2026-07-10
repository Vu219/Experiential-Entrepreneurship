import { useEffect, useMemo, useState } from 'react';
import { Download, Plus, Send, SlidersHorizontal, Sparkles, Trash2, X } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import { Card, Icon } from '../ui';
import Pagination from '../admin/Pagination';
import SearchSuggestInput from '../brand/SearchSuggestInput';
import ConfirmDialog from '../brand/ConfirmDialog';
import type { PageResponse, ApiError } from '../../api/apiClient';
import type { Platform } from '../../api/brandProfile';
import { type ContentLifecycle, ERR_CONTENT_ITEM_NOT_DELETABLE } from '../../api/contentGeneration';
import {
  listContents,
  deleteContent,
  changeContentStatus,
  type ContentListItem,
} from '../../api/contentCreationService';
import ContentTable from './ContentTable';
import ContentFilterDrawer, { DEFAULT_FILTERS, activeFilterCount, type ContentFilters } from './ContentFilterDrawer';
import ContentViewPanel from './ContentViewPanel';
import CreateSkeleton, { ContentTableSkeleton } from './CreateSkeleton';
import { CONTENT_STATUS_META } from './statusMeta';

// Tabs nhanh theo trạng thái (trục lọc đổi nhiều nhất — để NGOÀI, không chôn trong drawer).
// Các trạng thái pipeline hiếm gặp (Posting/Failed/...) vẫn lọc được gián tiếp qua tab Tất cả.
const TAB_STATUSES: ('all' | ContentLifecycle)[] = ['all', 'DRAFT', 'GENERATED', 'NEED_REVIEW', 'APPROVED', 'POSTED'];

const PLATFORM_NAMES: Record<string, string> = { FACEBOOK: 'Facebook', INSTAGRAM: 'Instagram', THREADS: 'Threads' };

// Bảng hàng ngang → 10 dòng/trang (Pageable 0-based phía service).
const PAGE_SIZE = 10;

/**
 * Lớp 1 — danh sách nội dung đã tạo (chỉ của user hiện tại), dạng BẢNG hàng ngang:
 * tabs nhanh theo trạng thái (kèm số đếm) + tìm kiếm + drawer "Bộ lọc" (chỉ query khi
 * bấm Áp dụng) + chip filter đang bật + chọn nhiều dòng để thao tác hàng loạt
 * (gửi duyệt / xuất CSV / xóa). Khi lọc/tải hiện skeleton rows — không reload trang.
 * Nút "Tạo nội dung" mở wizard ở TRANG RIÊNG (onCreate → /create/new).
 */
export default function ContentList({
  onCreate,
  onContinue,
}: {
  onCreate: () => void;
  onContinue: (item: ContentListItem) => void;
}) {
  const { t, brandGradient } = useApp();
  const { isMobile } = useBreakpoint();
  const [load, setLoad] = useState<'loading' | 'error' | 'ok'>('loading');
  const [data, setData] = useState<PageResponse<ContentListItem> | null>(null);
  const [allItems, setAllItems] = useState<ContentListItem[]>([]); // nguồn gợi ý + option lọc + số đếm tab
  const [query, setQuery] = useState('');
  const [submittedQ, setSubmittedQ] = useState('');
  const [statusTab, setStatusTab] = useState<'all' | ContentLifecycle>('all');
  const [filters, setFilters] = useState<ContentFilters>(DEFAULT_FILTERS);
  const [filterOpen, setFilterOpen] = useState(false);
  const [page, setPage] = useState(1); // UI 1-based ↔ service/Pageable 0-based
  const [reloadKey, setReloadKey] = useState(0);
  const [viewing, setViewing] = useState<{ item: ContentListItem; edit: boolean } | null>(null);
  // Xóa (đơn lẻ hoặc hàng loạt) dùng chung một ConfirmDialog — mảng các bài sẽ xóa.
  const [deleting, setDeleting] = useState<ContentListItem[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [delError, setDelError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkNote, setBulkNote] = useState<string | null>(null); // kết quả gửi duyệt hàng loạt

  // Nguồn gợi ý tìm kiếm + option thương hiệu + số đếm tab: toàn bộ nội dung.
  useEffect(() => {
    listContents({ size: 1000 }).then((pg) => setAllItems(pg.content)).catch(() => setAllItems([]));
  }, [reloadKey]);
  // Đổi bộ lọc / tab / tìm kiếm → quay về trang 1.
  useEffect(() => { setPage(1); }, [submittedQ, statusTab, filters]);
  // Đổi trang/bộ lọc/dữ liệu → bỏ chọn hàng loạt (selection chỉ có nghĩa trong trang đang xem).
  useEffect(() => { setSelected(new Set()); setBulkNote(null); }, [submittedQ, statusTab, filters, page, reloadKey]);

  useEffect(() => {
    let cancelled = false;
    setLoad('loading');
    listContents({
      q: submittedQ || undefined,
      platform: filters.platform === 'all' ? undefined : (filters.platform as Platform),
      status: statusTab === 'all' ? undefined : statusTab,
      brandId: filters.brandId === 'all' ? undefined : filters.brandId,
      sort: filters.sort,
      page: page - 1,
      size: PAGE_SIZE,
    })
      .then((pg) => {
        if (cancelled) return;
        // Trang hiện tại hết dữ liệu (vd xóa dòng cuối trang cuối) → lùi về trang cuối còn dữ liệu.
        if (pg.content.length === 0 && pg.totalPages > 0 && page > pg.totalPages) { setPage(pg.totalPages); return; }
        setData(pg);
        setLoad('ok');
      })
      .catch(() => { if (!cancelled) setLoad('error'); });
    return () => { cancelled = true; };
  }, [submittedQ, statusTab, filters, page, reloadKey]);

  const refresh = () => setReloadKey((k) => k + 1);

  const items = data?.content ?? [];
  const total = data?.totalElements ?? 0;
  const pageCount = data?.totalPages ?? 1;
  const brands = useMemo(
    () => [...new Map(allItems.map((it) => [it.brandId, it.brandName])).entries()] as [string, string][],
    [allItems],
  );
  // Số đếm từng tab trạng thái (client-side từ allItems — cùng nguồn với option lọc).
  const tabCounts = useMemo(() => {
    const c: Record<string, number> = { all: allItems.length };
    for (const s of TAB_STATUSES) if (s !== 'all') c[s] = allItems.filter((it) => it.status === s).length;
    return c;
  }, [allItems]);
  const selectedItems = items.filter((it) => selected.has(it.id));
  const filterCount = activeFilterCount(filters);
  const noFilters = !submittedQ && statusTab === 'all' && filterCount === 0;

  const clearAll = () => {
    setQuery(''); setSubmittedQ(''); setStatusTab('all'); setFilters(DEFAULT_FILTERS);
  };

  // ===== Xóa (đơn lẻ + hàng loạt, FR-89) =====
  const confirmDelete = async () => {
    if (!deleting?.length || busy) return;
    setBusy(true);
    setDelError(null);
    let failed = 0;
    let notDeletable = false;
    for (const it of deleting) {
      try {
        await deleteContent(it.id);
      } catch (e) {
        failed += 1;
        if ((e as ApiError).code === ERR_CONTENT_ITEM_NOT_DELETABLE) notDeletable = true;
        else setDelError((e as ApiError).message);
      }
    }
    setBusy(false);
    setSelected(new Set());
    if (failed > 0) {
      // FR-89: bài đã vào pipeline đăng không xóa được → báo rõ, giữ dialog; danh sách vẫn tươi.
      if (notDeletable) setDelError(t.clDelNotAllowed);
      refresh();
    } else {
      setDeleting(null);
      refresh();
    }
  };
  const closeDelete = () => { setDeleting(null); setDelError(null); };

  // ===== Gửi duyệt hàng loạt (chỉ DRAFT/GENERATED hợp lệ theo review flow FR-34) =====
  const bulkReview = async () => {
    if (bulkBusy) return;
    const eligible = selectedItems.filter((it) => it.status === 'DRAFT' || it.status === 'GENERATED');
    const skipped = selectedItems.length - eligible.length;
    setBulkBusy(true);
    let failed = 0;
    for (const it of eligible) {
      try { await changeContentStatus(it.id, 'NEED_REVIEW'); } catch { failed += 1; }
    }
    setBulkBusy(false);
    setSelected(new Set());
    setBulkNote(failed > 0 || skipped > 0 ? t.clBulkPartial : t.clBulkReviewDone);
    refresh();
  };

  // ===== Xuất CSV các dòng đã chọn (client-side, BOM cho Excel) =====
  const bulkExport = () => {
    const rows = [
      ['ID', 'Title', 'Platforms', 'Status', 'Brand', 'BrandVoice', 'UpdatedAt'],
      ...selectedItems.map((it) => [it.id, it.title, it.platforms.join('|'), it.status, it.brandName, String(it.brandVoice), it.updatedAt]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })); // BOM để Excel nhận UTF-8
    const a = document.createElement('a');
    a.href = url;
    a.download = 'aima-content.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  // Xem chi tiết mở dạng FULL-PAGE thay bảng (cùng pattern BrandProfileList). Check TRƯỚC
  // loading: panel gọi refresh() sau khi sửa/đổi trạng thái — list nền tải lại không được
  // che panel bằng skeleton (panel giữ nguyên, danh sách tươi khi quay lại).
  if (viewing)
    return (
      <ContentViewPanel
        item={viewing.item}
        startInEdit={viewing.edit}
        onClose={() => setViewing(null)}
        onChanged={refresh}
      />
    );

  if (load === 'loading' && !data) return <CreateSkeleton />;
  if (load === 'error')
    return (
      <div style={{ textAlign: 'center', padding: '54px 16px', color: '#8a85a0' }}>
        <div style={{ fontSize: 14.5, fontWeight: 600, marginBottom: 14 }}>{t.listError}</div>
        <button onClick={refresh} className="btn-grad" style={{ border: 'none', borderRadius: 10, padding: '9px 18px', fontWeight: 700, fontSize: 13, color: '#fff', background: brandGradient, cursor: 'pointer' }}>{t.retry}</button>
      </div>
    );

  // Chip các filter nâng cao đang bật — xóa nhanh không cần mở drawer.
  const chips: { key: string; label: string; clear: () => void }[] = [];
  if (filters.platform !== 'all')
    chips.push({ key: 'platform', label: PLATFORM_NAMES[filters.platform] ?? filters.platform, clear: () => setFilters({ ...filters, platform: 'all' }) });
  if (filters.brandId !== 'all')
    chips.push({ key: 'brand', label: brands.find(([id]) => id === filters.brandId)?.[1] ?? t.clFilterBrand, clear: () => setFilters({ ...filters, brandId: 'all' }) });
  if (filters.sort !== 'newest')
    chips.push({ key: 'sort', label: filters.sort === 'voice' ? t.clSortVoice : t.clSortStatus, clear: () => setFilters({ ...filters, sort: 'newest' }) });

  const bulkBtn = {
    display: 'inline-flex', alignItems: 'center', gap: 6, border: '1px solid #e0d5fb', background: '#fff',
    borderRadius: 9, padding: '7px 12px', fontSize: 12.5, fontWeight: 700, color: '#5b2b9e',
    cursor: bulkBusy ? 'not-allowed' : 'pointer', opacity: bulkBusy ? 0.6 : 1,
  } as const;

  return (
    <div className="view-pop" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Thanh công cụ: tìm kiếm + nút Bộ lọc (mở drawer, hiện số filter bật) + Tạo nội dung */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
        <SearchSuggestInput value={query} onChange={setQuery} onSubmit={setSubmittedQ} suggestions={allItems.map((it) => it.title)} placeholder={t.clSearchPh} />
        <button
          onClick={() => setFilterOpen(true)}
          className="btn-soft"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 7, border: '1px solid #ece8f6', background: '#fff', borderRadius: 10, padding: '9px 14px', fontSize: 13, fontWeight: 700, color: filterCount > 0 ? '#6d28d9' : '#574f6e', cursor: 'pointer' }}
        >
          <Icon icon={SlidersHorizontal} size={15} stroke={filterCount > 0 ? '#6d28d9' : '#574f6e'} />
          {t.clFilterBtn}{filterCount > 0 ? ` · ${filterCount}` : ''}
        </button>
        {/* Mobile: nút tạo full-width xuống hàng riêng cho dễ bấm; desktop giữ góc phải. */}
        <button onClick={onCreate} className="btn-grad" style={{ marginLeft: isMobile ? 0 : 'auto', width: isMobile ? '100%' : undefined, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, border: 'none', borderRadius: 11, padding: '10px 18px', fontSize: 14, fontWeight: 700, color: '#fff', background: brandGradient, cursor: 'pointer' }}>
          <Icon icon={Plus} size={17} stroke="#fff" />{t.clCreate}
        </button>
      </div>

      {/* Chip filter đang bật (từ drawer) — X để bỏ ngay, không cần mở lại drawer */}
      {chips.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
          {chips.map((c) => (
            <span key={c.key} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#f4f1fb', borderRadius: 999, padding: '5px 7px 5px 12px', fontSize: 12.5, fontWeight: 600, color: '#5b4b86' }}>
              {c.label}
              <button onClick={c.clear} aria-label={`${t.clearFilters}: ${c.label}`} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 18, height: 18, border: 'none', borderRadius: '50%', background: '#e5ddf6', color: '#5b4b86', cursor: 'pointer', padding: 0 }}>
                <Icon icon={X} size={11} stroke="#5b4b86" />
              </button>
            </span>
          ))}
          <button onClick={clearAll} className="link-underline" style={{ border: 'none', background: 'transparent', fontSize: 12.5, fontWeight: 700, color: '#7c3aed', cursor: 'pointer', padding: 2 }}>
            {t.clearFilters}
          </button>
        </div>
      )}

      {/* Tabs nhanh theo trạng thái + số đếm (cuộn ngang trên màn hẹp) */}
      <div role="tablist" style={{ display: 'flex', gap: 4, background: '#f6f3fc', borderRadius: 12, padding: 4, overflowX: 'auto', alignSelf: 'flex-start', maxWidth: '100%' }}>
        {TAB_STATUSES.map((s) => {
          const on = statusTab === s;
          const label = s === 'all' ? t.clTabAll : t[CONTENT_STATUS_META[s].labelKey];
          return (
            <button
              key={s}
              role="tab"
              aria-selected={on}
              onClick={() => setStatusTab(s)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 7, flex: 'none',
                border: 'none', borderRadius: 9, padding: '7px 13px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer',
                background: on ? '#fff' : 'transparent', color: on ? '#7c3aed' : '#8a85a0',
                boxShadow: on ? '0 2px 8px -3px rgba(80,60,140,.25)' : 'none', whiteSpace: 'nowrap',
              }}
            >
              {label}
              <span style={{ background: on ? '#f3edff' : '#ece8f6', color: on ? '#7c3aed' : '#8a85a0', borderRadius: 999, padding: '1px 7px', fontSize: 10.5, fontWeight: 800 }}>
                {tabCounts[s] ?? 0}
              </span>
            </button>
          );
        })}
      </div>

      {/* Thanh thao tác hàng loạt — hiện khi có dòng được chọn */}
      {selected.size > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, background: '#f6f1ff', border: '1px solid #e0d5fb', borderRadius: 12, padding: '9px 14px' }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#5b2b9e', marginRight: 4 }}>{t.clSelected} {selected.size}</span>
          <button onClick={bulkReview} disabled={bulkBusy} className="btn-soft" style={bulkBtn}>
            <Icon icon={Send} size={13} stroke="#5b2b9e" />{t.cvSubmitReview}
          </button>
          <button onClick={bulkExport} disabled={bulkBusy} className="btn-soft" style={bulkBtn}>
            <Icon icon={Download} size={13} stroke="#5b2b9e" />{t.clBulkExport}
          </button>
          <button onClick={() => setDeleting(selectedItems)} disabled={bulkBusy} className="btn-soft" style={{ ...bulkBtn, color: '#d6336c', borderColor: '#f3c9d6' }}>
            <Icon icon={Trash2} size={13} stroke="#d6336c" />{t.clDelete}
          </button>
          <button onClick={() => setSelected(new Set())} disabled={bulkBusy} style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 5, border: 'none', background: 'transparent', fontSize: 12.5, fontWeight: 700, color: '#7d6aa3', cursor: 'pointer' }}>
            <Icon icon={X} size={13} stroke="#7d6aa3" />{t.clBulkClear}
          </button>
        </div>
      )}
      {bulkNote && <div style={{ fontSize: 12.5, color: '#92600a', background: '#fdf0dc', borderRadius: 10, padding: '9px 12px' }}>{bulkNote}</div>}

      {load === 'loading' ? (
        <ContentTableSkeleton rows={Math.min(PAGE_SIZE, Math.max(items.length, 4))} />
      ) : total === 0 && noFilters ? (
        <Empty onCreate={onCreate} />
      ) : items.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <span style={{ color: '#8a85a0', fontSize: 14 }}>{t.listEmpty}</span>
          <button onClick={clearAll} className="btn-soft" style={{ border: 'none', background: '#f4f2fb', color: '#5b5670', borderRadius: 10, padding: '8px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>{t.clearFilters}</button>
        </div>
      ) : (
        <>
          <div style={{ fontSize: 12.5, color: '#8a85a0' }}>{t.clShowing} {total} {t.clItemsWord}</div>
          <Card style={{ padding: 0, overflow: 'hidden' }}>
            <ContentTable
              items={items}
              pageOffset={(page - 1) * PAGE_SIZE}
              selected={selected}
              onToggle={(id) => setSelected((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; })}
              onToggleAll={() => setSelected((prev) => (items.every((it) => prev.has(it.id)) ? new Set() : new Set(items.map((it) => it.id))))}
              onView={(it) => setViewing({ item: it, edit: false })}
              onEdit={(it) => setViewing({ item: it, edit: true })}
              onContinue={onContinue}
              onDelete={(it) => setDeleting([it])}
            />
          </Card>
          {/* Mobile: thanh phân trang thu gọn ‹ trang/tổng ›; desktop: Pagination đầy đủ */}
          {isMobile ? (
            pageCount > 1 && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
                <button
                  onClick={() => setPage(page - 1)}
                  disabled={page <= 1}
                  aria-label={t.pgPrev}
                  style={{ width: 38, height: 38, borderRadius: 10, border: '1px solid #ece8f6', background: '#fff', fontSize: 17, fontWeight: 700, color: page <= 1 ? '#c4bdd6' : '#5b5670', cursor: page <= 1 ? 'default' : 'pointer' }}
                >
                  ‹
                </button>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#574f6e' }}>{page}/{pageCount}</span>
                <button
                  onClick={() => setPage(page + 1)}
                  disabled={page >= pageCount}
                  aria-label={t.pgNext}
                  style={{ width: 38, height: 38, borderRadius: 10, border: '1px solid #ece8f6', background: '#fff', fontSize: 17, fontWeight: 700, color: page >= pageCount ? '#c4bdd6' : '#5b5670', cursor: page >= pageCount ? 'default' : 'pointer' }}
                >
                  ›
                </button>
              </div>
            )
          ) : (
            <Pagination page={page} pageCount={pageCount} onChange={setPage} />
          )}
        </>
      )}

      {filterOpen && (
        <ContentFilterDrawer
          value={filters}
          brands={brands}
          onApply={(next) => { setFilters(next); setFilterOpen(false); }}
          onClose={() => setFilterOpen(false)}
        />
      )}

      {deleting && (
        <ConfirmDialog
          title={t.clDelTitle}
          message={deleting.length > 1 ? t.clBulkDelMsg : t.clDelMsg}
          confirmLabel={t.clDelConfirm}
          busy={busy}
          onConfirm={confirmDelete}
          onClose={closeDelete}
        >
          {delError && (
            <div style={{ background: '#fee2e2', color: '#b91c1c', borderRadius: 10, padding: '10px 12px', fontSize: 12.5, fontWeight: 600, marginBottom: 12 }}>{delError}</div>
          )}
        </ConfirmDialog>
      )}
    </div>
  );
}

function Empty({ onCreate }: { onCreate: () => void }) {
  const { t, brandGradient } = useApp();
  return (
    <div style={{ textAlign: 'center', padding: '64px 16px' }}>
      <div style={{ width: 72, height: 72, borderRadius: 20, background: 'linear-gradient(150deg,#f6f2ff,#fcf1fc)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 18px' }}>
        <Icon icon={Sparkles} size={32} stroke="#a78bfa" />
      </div>
      <div style={{ fontFamily: "'Plus Jakarta Sans'", fontWeight: 800, fontSize: 18, color: '#211c38' }}>{t.clEmptyTitle}</div>
      <div style={{ fontSize: 13.5, color: '#8a85a0', margin: '8px auto 22px', maxWidth: 380 }}>{t.clEmptyDesc}</div>
      <button onClick={onCreate} className="btn-grad" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, border: 'none', borderRadius: 12, padding: '12px 24px', fontSize: 14, fontWeight: 700, color: '#fff', background: brandGradient, cursor: 'pointer' }}>
        <Icon icon={Plus} size={17} stroke="#fff" />{t.clCreateFirst}
      </button>
    </div>
  );
}
