import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Sparkles, LayoutList, PanelLeftClose, PanelLeftOpen, X } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useUiStore } from '../../store/useUiStore';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import { Icon, Card } from '../ui';
import { FilterSelect } from '../admin/AdminListPage';
import Pagination from '../admin/Pagination';
import type { PageResponse } from '../../api/apiClient';
import { listAllBrandProfiles, type BrandProfile } from '../../api/brandProfile';
import { listContentStrategies, listAllContentStrategies, setStrategyStatus, deleteContentStrategy, type ContentStrategy, type StrategyStatus } from '../../api/contentStrategy';
import SearchSuggestInput from './SearchSuggestInput';
import StrategyCard from './StrategyCard';
import StrategyDetail from './StrategyDetail';
import StrategyEditor from './StrategyEditor';
import ConfirmDialog from './ConfirmDialog';
import { StrategyManagerSkeleton, StrategyCardsSkeleton } from './BrandSkeleton';

type Mode = { kind: 'view'; id: string } | { kind: 'edit'; id: string } | { kind: 'create' } | { kind: 'empty' };

const SIDEBAR_KEY = 'brand-strategy-sidebar-state';
// Phân trang list chiến lược (sidebar trái / drawer): tối đa 4 item/trang, xử lý ở BACKEND (PageResponse).
const PAGE_SIZE = 4;
const dotColor = (st: StrategyStatus) => (st === 'ACTIVE' ? '#16a34a' : st === 'PAUSED' ? '#d97706' : '#9b96ad');

export default function StrategyManager() {
  const { t, brandGradient, activeBrandId } = useApp();
  // Mobile + tablet (<1024): danh sách chuyển thành drawer overlay thay vì 2 cột cố định
  // (sidebar 340px chiếm quá nửa màn hình tablet); ≥1024 giữ sidebar thu gọn được.
  const { width } = useBreakpoint();
  const drawerMode = width < 1024;
  // Sidebar trái có thể đóng/mở; trạng thái lưu localStorage để giữ giữa các lần reload.
  const [collapsed, setCollapsed] = useState<boolean>(() => (typeof window !== 'undefined' && localStorage.getItem(SIDEBAR_KEY) === 'collapsed'));
  // Mobile/tablet (<1024): danh sách là drawer overlay, mặc định đóng, mở thì phủ lên content.
  const [mobileOpen, setMobileOpen] = useState(false);
  const [load, setLoad] = useState<'loading' | 'error' | 'ok'>('loading');
  const [brandsLoad, setBrandsLoad] = useState<'loading' | 'error' | 'ok'>('loading');
  const [brands, setBrands] = useState<BrandProfile[]>([]);
  const [pageData, setPageData] = useState<PageResponse<ContentStrategy> | null>(null);
  const [query, setQuery] = useState(''); // chữ đang gõ (chưa tìm)
  const [submittedQ, setSubmittedQ] = useState(''); // từ khóa đã chốt bằng Enter/chọn gợi ý
  const [suggestNames, setSuggestNames] = useState<string[]>([]);
  const [status, setStatus] = useState('all');
  const [page, setPage] = useState(1); // UI 1-based ↔ backend Pageable 0-based
  const [reloadKey, setReloadKey] = useState(0);
  const [mode, setMode] = useState<Mode>({ kind: 'empty' });
  const [deleting, setDeleting] = useState<ContentStrategy | null>(null);
  const [busy, setBusy] = useState(false);

  const activeBrand = brands.find((b) => b.id === activeBrandId) ?? brands[0] ?? null;
  const brandId = activeBrand?.id ?? '';
  const items = pageData?.content ?? [];

  useEffect(() => {
    listAllBrandProfiles()
      .then((b) => { setBrands(b); setBrandsLoad('ok'); })
      .catch(() => setBrandsLoad('error'));
  }, []);

  // Nguồn gợi ý cho ô tìm kiếm: tên toàn bộ chiến lược của thương hiệu đang chọn (chỉ tải lại
  // khi đổi thương hiệu / dữ liệu đổi, KHÔNG gọi API theo từng phím gõ — tìm thật chỉ chạy khi
  // nhấn Enter/chọn gợi ý).
  useEffect(() => {
    if (!brandId) { setSuggestNames([]); return; }
    listAllContentStrategies(brandId).then((all) => setSuggestNames(all.map((s) => s.name).filter(Boolean))).catch(() => setSuggestNames([]));
  }, [brandId, reloadKey]);
  // Đổi thương hiệu / bộ lọc → quay về trang 1; đổi thương hiệu → đóng detail.
  useEffect(() => { setPage(1); }, [brandId, submittedQ, status]);
  useEffect(() => { setMode({ kind: 'empty' }); }, [brandId]);

  useEffect(() => {
    if (!brandId) { setPageData(null); setLoad('ok'); return; }
    let cancelled = false;
    setLoad('loading');
    listContentStrategies({ brandId, status: status === 'all' ? undefined : (status as StrategyStatus), q: submittedQ || undefined, page: page - 1, size: PAGE_SIZE })
      .then((pg) => {
        if (cancelled) return;
        // Trang hiện tại hết dữ liệu (vd xóa item cuối trang cuối) → lùi về trang cuối còn dữ liệu.
        if (pg.content.length === 0 && pg.totalPages > 0 && page > pg.totalPages) { setPage(pg.totalPages); return; }
        setPageData(pg);
        setLoad('ok');
      })
      .catch(() => { if (!cancelled) setLoad('error'); });
    return () => { cancelled = true; };
  }, [brandId, submittedQ, status, page, reloadKey]);

  useEffect(() => { try { localStorage.setItem(SIDEBAR_KEY, collapsed ? 'collapsed' : 'expanded'); } catch { /* ignore */ } }, [collapsed]);

  // Ctrl/Cmd + B: toggle danh sách (desktop đổi collapsed, mobile/tablet đổi drawer).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'b' || e.key === 'B')) {
        e.preventDefault();
        if (drawerMode) setMobileOpen((o) => !o); else setCollapsed((c) => !c);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [drawerMode]);

  // Chọn để xem: giữ nguyên trạng thái sidebar user đã chọn (mobile/tablet thì đóng drawer).
  const selectStrategy = (id: string) => { setMode({ kind: 'view', id }); if (drawerMode) setMobileOpen(false); };
  // Sửa / Tạo mới: auto thu gọn để form có không gian rộng.
  const openCreate = () => { setMode({ kind: 'create' }); if (drawerMode) setMobileOpen(false); else setCollapsed(true); };
  const openEdit = (id: string) => { setMode({ kind: 'edit', id }); if (!drawerMode) setCollapsed(true); };

  // Nút "Tạo chiến lược mới" nằm ở header trang (Brand) → nhận tín hiệu qua store để mở form tạo mới.
  // So sánh với nonce trước đó để KHÔNG tự mở khi mới mount (nonce toàn cục có thể > 0 từ lần trước).
  const strategyCreateNonce = useUiStore((s) => s.strategyCreateNonce);
  const lastCreateNonce = useRef(strategyCreateNonce);
  useEffect(() => {
    if (strategyCreateNonce !== lastCreateNonce.current) {
      lastCreateNonce.current = strategyCreateNonce;
      openCreate();
    }
    // openCreate đọc giá trị mới mỗi lần render khi nonce đổi; chỉ phụ thuộc nonce.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [strategyCreateNonce]);

  // Trả về Promise để StrategyCard tự quản lý trạng thái đang xử lý / lỗi (FR-13).
  // Đang lọc theo trạng thái → tải lại trang (item có thể không còn khớp bộ lọc server-side).
  const toggleStatus = (s: ContentStrategy, next: StrategyStatus) =>
    setStrategyStatus(s.id, next).then((updated) => {
      if (status !== 'all') setReloadKey((k) => k + 1);
      else setPageData((prev) => (prev ? { ...prev, content: prev.content.map((x) => (x.id === s.id ? updated : x)) } : prev));
    });

  // Sau khi tạo/sửa: cập nhật lạc quan để UI phản hồi ngay, rồi tải lại trang 1 cho đồng bộ
  // (backend sort updatedAt desc → chiến lược mới nằm đầu trang 1).
  const onSaved = (s: ContentStrategy, created: boolean) => {
    if (created) {
      setQuery(''); setSubmittedQ(''); setStatus('all'); setPage(1);
      setPageData((prev) => (prev
        ? { ...prev, content: [s, ...prev.content].slice(0, PAGE_SIZE), totalElements: prev.totalElements + 1 }
        : { content: [s], page: 0, size: PAGE_SIZE, totalElements: 1, totalPages: 1, last: true }));
      setReloadKey((k) => k + 1);
    } else {
      setPageData((prev) => (prev ? { ...prev, content: prev.content.map((x) => (x.id === s.id ? s : x)) } : prev));
    }
    setMode({ kind: 'view', id: s.id });
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    setBusy(true);
    try {
      await deleteContentStrategy(deleting.id);
      setDeleting(null);
      setMode({ kind: 'empty' });
      setReloadKey((k) => k + 1);
    } finally {
      setBusy(false);
    }
  };

  if (brandsLoad === 'loading') return <StrategyManagerSkeleton />;

  if (brandsLoad === 'error') {
    return (
      <Card style={{ padding: '54px 24px', textAlign: 'center', color: '#8a85a0' }}>
        {t.listError}
      </Card>
    );
  }

  if (!activeBrand)
    return (
      <Card style={{ padding: '54px 24px', textAlign: 'center', color: '#8a85a0' }}>
        <div style={{ width: 60, height: 60, borderRadius: 16, background: '#f4f1fb', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
          <Icon icon={Sparkles} size={28} stroke="#a78bfa" />
        </div>
        <div style={{ fontSize: 14.5, fontWeight: 600, color: '#5b5670' }}>{t.csNeedBrand}</div>
      </Card>
    );

  const selected = mode.kind === 'view' || mode.kind === 'edit' ? items.find((s) => s.id === mode.id) ?? null : null;
  const total = pageData?.totalElements ?? 0;
  const noFilters = !submittedQ && status === 'all';
  const showFrom = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const showTo = (page - 1) * PAGE_SIZE + items.length;

  // Header danh sách: chip thương hiệu + 1 slot phải (thu gọn / đóng drawer) — nút tạo mới đã chuyển lên header trang.
  const listHeader = (trailing?: ReactNode) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      {activeBrand && <span style={{ fontSize: 12, fontWeight: 700, color: '#7c3aed', background: '#f4ecff', borderRadius: 999, padding: '5px 12px' }}>{t.csBrandLabel}: {activeBrand.brandName}</span>}
      {trailing}
    </div>
  );

  // Phần search + filter + danh sách card + phân trang — dùng chung cho sidebar mở rộng và drawer mobile.
  const listBody = (
    <>
      {/* Bọc trong flex-row để flex-basis '1 1 220px' của ô search áp vào CHIỀU RỘNG
          (không phải chiều cao như khi nằm trực tiếp trong cột) → ô search cao bình thường. */}
      <div style={{ display: 'flex' }}>
        <SearchSuggestInput value={query} onChange={setQuery} onSubmit={setSubmittedQ} suggestions={suggestNames} placeholder={t.csSearchPh} />
      </div>
      <FilterSelect value={status} onChange={setStatus} options={[['all', t.csAllStatus], ['ACTIVE', t.csStActive], ['PAUSED', t.csStPaused], ['DRAFT', t.csStDraft]]} />

      {load === 'loading' ? (
        <StrategyCardsSkeleton />
      ) : load === 'error' ? (
        <div style={{ textAlign: 'center', padding: '34px 12px', color: '#8a85a0', fontSize: 13.5 }}>{t.listError}</div>
      ) : items.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '34px 12px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <span style={{ color: '#8a85a0', fontSize: 13.5 }}>{noFilters ? t.csEmptyTitle : t.listEmpty}</span>
          {!noFilters && <button onClick={() => { setQuery(''); setSubmittedQ(''); setStatus('all'); }} className="btn-soft" style={{ border: 'none', background: '#f4f2fb', color: '#5b5670', borderRadius: 10, padding: '7px 14px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>{t.clearFilters}</button>}
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {items.map((s) => (
              <StrategyCard key={s.id} s={s} selected={(mode.kind === 'view' || mode.kind === 'edit') && mode.id === s.id} onSelect={() => selectStrategy(s.id)} onToggleStatus={(next) => toggleStatus(s, next)} onEdit={() => openEdit(s.id)} onDelete={() => setDeleting(s)} />
            ))}
          </div>
          <div style={{ fontSize: 12, color: '#8a85a0', textAlign: 'center', paddingTop: 4 }}>{t.csShowing} {showFrom}-{showTo}/{total} {t.csStrategiesWord}</div>
          <Pagination page={page} pageCount={pageData?.totalPages ?? 1} onChange={setPage} />
        </>
      )}
    </>
  );

  // Sidebar mở rộng (desktop) — nút thu gọn ở góc trên-phải.
  const expandedSidebar = (
    <div style={{ width: 340, minWidth: 340, display: 'flex', flexDirection: 'column', gap: 12 }}>
      {listHeader(
        <button onClick={() => setCollapsed(true)} aria-label={t.csCollapseList} title={t.csCollapseList} style={{ marginLeft: 'auto', width: 34, height: 34, borderRadius: 10, border: '1px solid #efeaf8', background: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flex: 'none' }}>
          <Icon icon={PanelLeftClose} size={17} stroke="#7c3aed" />
        </button>,
      )}
      {listBody}
    </div>
  );

  // Rail thu gọn (~56px): mũi tên mở rộng + icon chữ cái các chiến lược của trang hiện tại (hover xem tên).
  // Nút "+" đã bỏ — đã có nút "Tạo chiến lược mới" ở header trang (góc phải trên).
  const rail = (
    <div style={{ width: 56, minWidth: 56, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, background: '#fff', border: '1px solid #efeaf8', borderRadius: 16, padding: '10px 0' }}>
      <button onClick={() => setCollapsed(false)} aria-label={t.csExpandList} title={t.csExpandList} style={{ width: 40, height: 40, borderRadius: 12, border: '1px solid #efeaf8', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
        <Icon icon={PanelLeftOpen} size={18} stroke="#7c3aed" />
      </button>
      <div style={{ width: 28, height: 1, background: '#efeaf8' }} />
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, width: '100%', overflow: 'visible' }}>
        {items.map((s) => {
          const isSel = (mode.kind === 'view' || mode.kind === 'edit') && mode.id === s.id;
          return (
            <button
              key={s.id}
              onClick={() => selectStrategy(s.id)}
              aria-current={isSel ? 'true' : undefined}
              aria-label={s.name || '—'}
              title={s.name || '—'}
              className="strategy-card"
              style={{ position: 'relative', width: 40, height: 40, borderRadius: 12, cursor: 'pointer', border: isSel ? '1.5px solid #a855f7' : '1px solid #efeaf8', background: isSel ? 'rgba(168, 85, 247, 0.06)' : '#faf8ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Plus Jakarta Sans'", fontWeight: 800, fontSize: 15, color: '#5b4b86', boxShadow: isSel ? '0 2px 8px rgba(168, 85, 247, 0.12)' : undefined }}
            >
              {isSel && (
                <div style={{ position: 'absolute', inset: -1.5, borderRadius: 12, overflow: 'hidden', pointerEvents: 'none' }}>
                  <span aria-hidden style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4.5, background: brandGradient }} />
                </div>
              )}
              <span style={{ position: 'relative', zIndex: 1 }}>{(s.name || '—').charAt(0).toUpperCase()}</span>
              <span style={{ position: 'absolute', top: -2, right: -2, width: 9, height: 9, borderRadius: '50%', background: dotColor(s.status), border: '2px solid #fff' }} />
            </button>
          );
        })}
      </div>
    </div>
  );

  const detail = (
    // max-width + canh giữa: khi thu gọn sidebar, vùng nội dung không giãn full-width gây mất cân đối (#4.2).
    <Card style={{ width: '100%', maxWidth: 1400, minWidth: 0, padding: 22, alignSelf: 'flex-start' }}>
      {load === 'error' && mode.kind === 'empty' ? (
        <div style={{ textAlign: 'center', padding: '40px 0', color: '#8a85a0' }}>{t.listError}</div>
      ) : mode.kind === 'create' ? (
        // key="editor-create" → form luôn remount sạch khi bấm "+" (reset toàn bộ state, không dính chiến lược vừa sửa).
        <StrategyEditor key="editor-create" strategy={null} brandId={brandId} brandName={activeBrand?.brandName ?? ''} onCancel={() => setMode({ kind: 'empty' })} onSaved={onSaved} />
      ) : mode.kind === 'edit' && selected ? (
        // key theo id → đổi sang sửa chiến lược khác cũng remount, không leak state giữa các chiến lược.
        <StrategyEditor key={`editor-${selected.id}`} strategy={selected} brandId={brandId} brandName={activeBrand?.brandName ?? ''} onCancel={() => setMode({ kind: 'view', id: selected.id })} onSaved={onSaved} onDelete={() => setDeleting(selected)} />
      ) : mode.kind === 'view' && selected ? (
        <StrategyDetail s={selected} onEdit={() => openEdit(selected.id)} onDelete={() => setDeleting(selected)} />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '55vh', textAlign: 'center', padding: '40px 20px' }}>
          <div style={{ width: 110, height: 110, borderRadius: 32, background: 'linear-gradient(135deg, #fdfbff 0%, #f4ecff 100%)', border: '2px solid #fff', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 28, boxShadow: '0 24px 48px -18px rgba(139,92,246,0.25)', transform: 'rotate(-2deg)' }}>
            <div style={{ transform: 'rotate(2deg)' }}>
              <Icon icon={LayoutList} size={56} stroke="#8b5cf6" />
            </div>
          </div>
          <h3 style={{ fontSize: 20, fontWeight: 800, color: '#2d264b', margin: '0 0 12px 0', fontFamily: "'Plus Jakarta Sans'" }}>
            Quản lý chiến lược Content
          </h3>
          <p style={{ fontSize: 14.5, color: '#8a85a0', margin: 0, maxWidth: 420, lineHeight: 1.6 }}>
            {t.csDetailEmpty}. Hãy chọn một chiến lược từ danh sách bên trái hoặc nhấn nút "+" để tạo chiến lược mới ngay.
          </p>
        </div>
      )}
    </Card>
  );

  // ===== Mobile/tablet (<1024): drawer overlay (mặc định đóng), phủ lên content khi mở. =====
  if (drawerMode) {
    return (
      <div className="view-pop" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <button onClick={() => setMobileOpen(true)} aria-label={t.csExpandList} style={{ alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 8, border: '1px solid #efeaf8', background: '#fff', borderRadius: 12, padding: '9px 14px', fontSize: 13.5, fontWeight: 700, color: '#5b5670', cursor: 'pointer' }}>
          <Icon icon={LayoutList} size={16} stroke="#7c3aed" />{t.csListTitle}
        </button>
        {detail}
        {mobileOpen && (
          <div onClick={() => setMobileOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(20,16,40,.42)', zIndex: 60, display: 'flex' }}>
            <div onClick={(e) => e.stopPropagation()} style={{ width: 'min(86%, 360px)', height: '100%', background: '#faf8ff', padding: 16, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12, boxShadow: '12px 0 40px -16px rgba(40,20,90,.5)' }}>
              {listHeader(
                <button onClick={() => setMobileOpen(false)} aria-label={t.csCollapseList} title={t.csCollapseList} style={{ width: 34, height: 34, borderRadius: 10, border: '1px solid #efeaf8', background: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flex: 'none' }}>
                  <Icon icon={X} size={17} stroke="#7c3aed" />
                </button>,
              )}
              {listBody}
            </div>
          </div>
        )}
        {deleting && <ConfirmDialog title={t.csDelTitle} message={t.csDelMsg} confirmLabel={t.csDeleteBtn} busy={busy} onConfirm={confirmDelete} onClose={() => setDeleting(null)} />}
      </div>
    );
  }

  // ===== Desktop: sidebar animate width (340 ↔ 56), content phải tự co giãn theo. =====
  return (
    <div className="view-pop" style={{ display: 'flex', flexDirection: 'row', gap: 18, alignItems: 'flex-start' }}>
      <div className="transition-all duration-300 ease-in-out" style={{ width: collapsed ? 56 : 340, flex: 'none', overflow: 'visible' }}>
        {collapsed ? rail : expandedSidebar}
      </div>
      {/* flex:1 + canh giữa để Card (max-width 1400) không lệch trái khi sidebar thu gọn. */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', justifyContent: 'center' }}>{detail}</div>
      {deleting && <ConfirmDialog title={t.csDelTitle} message={t.csDelMsg} confirmLabel={t.csDeleteBtn} busy={busy} onConfirm={confirmDelete} onClose={() => setDeleting(null)} />}
    </div>
  );
}
