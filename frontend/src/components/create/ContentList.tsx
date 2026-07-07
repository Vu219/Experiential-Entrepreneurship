import { useEffect, useState } from 'react';
import { Plus, Sparkles } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import { Icon } from '../ui';
import { FilterSelect } from '../admin/AdminListPage';
import Pagination from '../admin/Pagination';
import SearchSuggestInput from '../brand/SearchSuggestInput';
import ConfirmDialog from '../brand/ConfirmDialog';
import type { PageResponse } from '../../api/apiClient';
import type { Platform } from '../../api/brandProfile';
import type { ContentLifecycle } from '../../api/contentGeneration';
import { listContents, deleteContent, type ContentListItem, type ContentSort } from '../../api/contentCreationService';
import ContentCard from './ContentCard';
import ContentViewPanel from './ContentViewPanel';
import CreateSkeleton, { contentGridCols } from './CreateSkeleton';
import { CONTENT_STATUS_META } from './statusMeta';

// Trạng thái đưa vào bộ lọc (các mốc người dùng gặp thường xuyên trong state machine).
const FILTER_STATUSES: ContentLifecycle[] = ['DRAFT', 'GENERATED', 'NEED_REVIEW', 'APPROVED', 'SCHEDULED', 'POSTED', 'FAILED'];

// Cố định 6 item/trang ở mọi breakpoint — lưới tự co cột 3 → 2 → 1.
const PAGE_SIZE = 6;

/**
 * Lớp 1 — danh sách nội dung đã tạo (chỉ của user hiện tại): tìm kiếm + lọc theo
 * nền tảng / trạng thái / hồ sơ thương hiệu, card thao tác Xem / Xóa / Tiếp tục.
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
  const { width, isMobile } = useBreakpoint();
  const [load, setLoad] = useState<'loading' | 'error' | 'ok'>('loading');
  const [data, setData] = useState<PageResponse<ContentListItem> | null>(null);
  const [allItems, setAllItems] = useState<ContentListItem[]>([]); // nguồn gợi ý + option lọc thương hiệu
  const [query, setQuery] = useState('');
  const [submittedQ, setSubmittedQ] = useState('');
  const [platform, setPlatform] = useState('all');
  const [status, setStatus] = useState('all');
  const [brandId, setBrandId] = useState('all');
  const [sort, setSort] = useState<ContentSort>('newest'); // mặc định mới nhất lên đầu
  const [page, setPage] = useState(1); // UI 1-based ↔ service/Pageable 0-based
  const [reloadKey, setReloadKey] = useState(0);
  const [viewing, setViewing] = useState<ContentListItem | null>(null);
  const [deleting, setDeleting] = useState<ContentListItem | null>(null);
  const [busy, setBusy] = useState(false);

  // Nguồn gợi ý tìm kiếm + option thương hiệu: toàn bộ nội dung (tải lại khi dữ liệu đổi).
  useEffect(() => {
    listContents({ size: 1000 }).then((pg) => setAllItems(pg.content)).catch(() => setAllItems([]));
  }, [reloadKey]);
  // Đổi bộ lọc / sắp xếp → quay về trang 1.
  useEffect(() => { setPage(1); }, [submittedQ, platform, status, brandId, sort]);

  useEffect(() => {
    let cancelled = false;
    setLoad('loading');
    listContents({
      q: submittedQ || undefined,
      platform: platform === 'all' ? undefined : (platform as Platform),
      status: status === 'all' ? undefined : (status as ContentLifecycle),
      brandId: brandId === 'all' ? undefined : brandId,
      sort,
      page: page - 1,
      size: PAGE_SIZE,
    })
      .then((pg) => {
        if (cancelled) return;
        // Trang hiện tại hết dữ liệu (vd xóa card cuối trang cuối) → lùi về trang cuối còn dữ liệu.
        if (pg.content.length === 0 && pg.totalPages > 0 && page > pg.totalPages) { setPage(pg.totalPages); return; }
        setData(pg);
        setLoad('ok');
      })
      .catch(() => { if (!cancelled) setLoad('error'); });
    return () => { cancelled = true; };
  }, [submittedQ, platform, status, brandId, sort, page, reloadKey]);

  const refresh = () => setReloadKey((k) => k + 1);

  const confirmDelete = async () => {
    if (!deleting) return;
    setBusy(true);
    try {
      await deleteContent(deleting.id);
      setDeleting(null);
      refresh();
    } finally {
      setBusy(false);
    }
  };

  if (load === 'loading') return <CreateSkeleton />;
  if (load === 'error')
    return (
      <div style={{ textAlign: 'center', padding: '54px 16px', color: '#8a85a0' }}>
        <div style={{ fontSize: 14.5, fontWeight: 600, marginBottom: 14 }}>{t.listError}</div>
        <button onClick={refresh} className="btn-grad" style={{ border: 'none', borderRadius: 10, padding: '9px 18px', fontWeight: 700, fontSize: 13, color: '#fff', background: brandGradient, cursor: 'pointer' }}>{t.retry}</button>
      </div>
    );

  // Xem read-only mở dạng FULL-PAGE thay grid (cùng pattern BrandProfileList).
  if (viewing) return <ContentViewPanel item={viewing} onClose={() => setViewing(null)} />;

  const items = data?.content ?? [];
  const total = data?.totalElements ?? 0;
  const pageCount = data?.totalPages ?? 1;
  const brands = [...new Map(allItems.map((it) => [it.brandId, it.brandName])).entries()];
  const noFilters = !submittedQ && platform === 'all' && status === 'all' && brandId === 'all';

  return (
    <div className="view-pop" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
        <SearchSuggestInput value={query} onChange={setQuery} onSubmit={setSubmittedQ} suggestions={allItems.map((it) => it.title)} placeholder={t.clSearchPh} />
        <FilterSelect value={platform} onChange={setPlatform} options={[['all', t.clAllPlatforms], ['FACEBOOK', 'Facebook'], ['INSTAGRAM', 'Instagram'], ['THREADS', 'Threads']]} />
        <FilterSelect value={status} onChange={setStatus} options={[['all', t.clAllStatus], ...FILTER_STATUSES.map((s) => [s, t[CONTENT_STATUS_META[s].labelKey]] as [string, string])]} />
        <FilterSelect value={brandId} onChange={setBrandId} options={[['all', t.clAllBrands], ...brands.map(([id, name]) => [id, name] as [string, string])]} />
        <FilterSelect value={sort} onChange={(v) => setSort(v as ContentSort)} options={[['newest', t.clSortNewest], ['voice', t.clSortVoice], ['status', t.clSortStatus]]} />
        {/* Mobile: nút tạo full-width xuống hàng riêng cho dễ bấm; desktop giữ góc phải. */}
        <button onClick={onCreate} className="btn-grad" style={{ marginLeft: isMobile ? 0 : 'auto', width: isMobile ? '100%' : undefined, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, border: 'none', borderRadius: 11, padding: '10px 18px', fontSize: 14, fontWeight: 700, color: '#fff', background: brandGradient, cursor: 'pointer' }}>
          <Icon icon={Plus} size={17} stroke="#fff" />{t.clCreate}
        </button>
      </div>

      {total === 0 && noFilters ? (
        <Empty onCreate={onCreate} />
      ) : items.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <span style={{ color: '#8a85a0', fontSize: 14 }}>{t.listEmpty}</span>
          <button onClick={() => { setQuery(''); setSubmittedQ(''); setPlatform('all'); setStatus('all'); setBrandId('all'); }} className="btn-soft" style={{ border: 'none', background: '#f4f2fb', color: '#5b5670', borderRadius: 10, padding: '8px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>{t.clearFilters}</button>
        </div>
      ) : (
        <>
          <div style={{ fontSize: 12.5, color: '#8a85a0' }}>{t.clShowing} {total} {t.clItemsWord}</div>
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${contentGridCols(width)}, minmax(0,1fr))`, gap: 16 }}>
            {items.map((it) => (
              <ContentCard
                key={it.id}
                item={it}
                onView={() => setViewing(it)}
                onContinue={() => onContinue(it)}
                onDelete={() => setDeleting(it)}
              />
            ))}
          </div>
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

      {deleting && (
        <ConfirmDialog title={t.clDelTitle} message={t.clDelMsg} confirmLabel={t.clDelConfirm} busy={busy} onConfirm={confirmDelete} onClose={() => setDeleting(null)} />
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
