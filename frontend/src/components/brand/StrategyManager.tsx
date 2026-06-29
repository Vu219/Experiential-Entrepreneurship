import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Sparkles, Plus, LayoutList, PanelLeftClose, PanelLeftOpen, X } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import { Loader, Icon, Card } from '../ui';
import { SearchInput, FilterSelect } from '../admin/AdminListPage';
import { listBrandProfiles, type BrandProfile } from '../../api/brandProfile';
import { listContentStrategies, setStrategyStatus, deleteContentStrategy, type ContentStrategy, type StrategyStatus } from '../../api/contentStrategy';
import StrategyCard from './StrategyCard';
import StrategyDetail from './StrategyDetail';
import StrategyEditor from './StrategyEditor';
import ConfirmDialog from './ConfirmDialog';

type Mode = { kind: 'view'; id: string } | { kind: 'edit'; id: string } | { kind: 'create' } | { kind: 'empty' };

const SIDEBAR_KEY = 'brand-strategy-sidebar-state';
const dotColor = (st: StrategyStatus) => (st === 'ACTIVE' ? '#16a34a' : st === 'PAUSED' ? '#d97706' : '#9b96ad');

export default function StrategyManager() {
  const { t, brandGradient, activeBrandId } = useApp();
  const { isMobile } = useBreakpoint();
  // Sidebar trái có thể đóng/mở; trạng thái lưu localStorage để giữ giữa các lần reload.
  const [collapsed, setCollapsed] = useState<boolean>(() => (typeof window !== 'undefined' && localStorage.getItem(SIDEBAR_KEY) === 'collapsed'));
  // Mobile (< 760): danh sách là drawer overlay, mặc định đóng, mở thì phủ lên content.
  const [mobileOpen, setMobileOpen] = useState(false);
  const [load, setLoad] = useState<'loading' | 'error' | 'ok'>('loading');
  const [brandsLoad, setBrandsLoad] = useState<'loading' | 'error' | 'ok'>('loading');
  const [brands, setBrands] = useState<BrandProfile[]>([]);
  const [items, setItems] = useState<ContentStrategy[]>([]);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const [mode, setMode] = useState<Mode>({ kind: 'empty' });
  const [deleting, setDeleting] = useState<ContentStrategy | null>(null);
  const [busy, setBusy] = useState(false);

  const activeBrand = brands.find((b) => b.id === activeBrandId) ?? brands[0] ?? null;
  const brandId = activeBrand?.id ?? '';

  const refresh = (brand: string) => {
    if (!brand) { setItems([]); setLoad('ok'); return; }
    setLoad('loading');
    listContentStrategies(brand).then((rows) => { setItems(rows); setLoad('ok'); }).catch(() => setLoad('error'));
  };

  useEffect(() => { 
    listBrandProfiles()
      .then(b => { setBrands(b); setBrandsLoad('ok'); })
      .catch(() => setBrandsLoad('error')); 
  }, []);
  useEffect(() => { refresh(brandId); setMode({ kind: 'empty' }); }, [brandId]);

  useEffect(() => { try { localStorage.setItem(SIDEBAR_KEY, collapsed ? 'collapsed' : 'expanded'); } catch { /* ignore */ } }, [collapsed]);

  // Ctrl/Cmd + B: toggle danh sách (desktop đổi collapsed, mobile đổi drawer).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'b' || e.key === 'B')) {
        e.preventDefault();
        if (isMobile) setMobileOpen((o) => !o); else setCollapsed((c) => !c);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isMobile]);

  // Chọn để xem: giữ nguyên trạng thái sidebar user đã chọn (mobile thì đóng drawer).
  const selectStrategy = (id: string) => { setMode({ kind: 'view', id }); if (isMobile) setMobileOpen(false); };
  // Sửa / Tạo mới: auto thu gọn để form có không gian rộng.
  const openCreate = () => { setMode({ kind: 'create' }); if (isMobile) setMobileOpen(false); else setCollapsed(true); };
  const openEdit = (id: string) => { setMode({ kind: 'edit', id }); if (!isMobile) setCollapsed(true); };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((s) => (status === 'all' || s.status === status) && (!q || s.name.toLowerCase().includes(q)));
  }, [items, query, status]);

  // Trả về Promise để StrategyCard tự quản lý trạng thái đang xử lý / lỗi (FR-13).
  const toggleStatus = (s: ContentStrategy, next: StrategyStatus) =>
    setStrategyStatus(s.id, next).then((updated) => setItems((prev) => prev.map((x) => (x.id === s.id ? updated : x))));

  const confirmDelete = async () => {
    if (!deleting) return;
    setBusy(true);
    try {
      await deleteContentStrategy(deleting.id);
      setDeleting(null);
      setMode({ kind: 'empty' });
      refresh(brandId);
    } finally {
      setBusy(false);
    }
  };

  if (brandsLoad === 'loading') {
    return (
      <Card style={{ padding: '54px 24px', display: 'flex', justifyContent: 'center' }}>
        <Loader label={t.listLoading} />
      </Card>
    );
  }

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

  // Header danh sách: chip thương hiệu + nút tạo mới + 1 slot phải (thu gọn / đóng drawer).
  const listHeader = (trailing?: ReactNode) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      {activeBrand && <span style={{ fontSize: 12, fontWeight: 700, color: '#7c3aed', background: '#f4ecff', borderRadius: 999, padding: '5px 12px' }}>{activeBrand.brandName}</span>}
      <button onClick={openCreate} className="btn-grad" style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 6, border: 'none', borderRadius: 10, padding: '8px 14px', fontSize: 13, fontWeight: 700, color: '#fff', background: brandGradient, cursor: 'pointer' }}>
        <Icon icon={Plus} size={15} stroke="#fff" />{t.csCreate}
      </button>
      {trailing}
    </div>
  );

  // Phần search + filter + danh sách card — dùng chung cho sidebar mở rộng và drawer mobile.
  const listBody = (
    <>
      {/* Bọc trong flex-row để flex-basis '1 1 220px' của SearchInput áp vào CHIỀU RỘNG
          (không phải chiều cao như khi nằm trực tiếp trong cột) → ô search cao bình thường. */}
      <div style={{ display: 'flex' }}>
        <SearchInput value={query} onChange={setQuery} placeholder={t.csSearchPh} />
      </div>
      <FilterSelect value={status} onChange={setStatus} options={[['all', t.csAllStatus], ['ACTIVE', t.csStActive], ['PAUSED', t.csStPaused], ['DRAFT', t.csStDraft]]} />

      {load === 'loading' ? (
        <Loader label={t.listLoading} />
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '34px 12px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <span style={{ color: '#8a85a0', fontSize: 13.5 }}>{items.length === 0 ? t.csEmptyTitle : t.listEmpty}</span>
          {items.length > 0 && <button onClick={() => { setQuery(''); setStatus('all'); }} className="btn-soft" style={{ border: 'none', background: '#f4f2fb', color: '#5b5670', borderRadius: 10, padding: '7px 14px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>{t.clearFilters}</button>}
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {filtered.map((s) => (
              <StrategyCard key={s.id} s={s} selected={(mode.kind === 'view' || mode.kind === 'edit') && mode.id === s.id} onSelect={() => selectStrategy(s.id)} onToggleStatus={(next) => toggleStatus(s, next)} />
            ))}
          </div>
          <div style={{ fontSize: 12, color: '#8a85a0', textAlign: 'center', paddingTop: 4 }}>{t.csShowing} 1-{filtered.length}/{filtered.length} {t.csStrategiesWord}</div>
        </>
      )}
    </>
  );

  // Sidebar mở rộng (desktop) — nút thu gọn ở góc trên-phải.
  const expandedSidebar = (
    <div style={{ width: 340, minWidth: 340, display: 'flex', flexDirection: 'column', gap: 12 }}>
      {listHeader(
        <button onClick={() => setCollapsed(true)} aria-label={t.csCollapseList} title={t.csCollapseList} style={{ width: 34, height: 34, borderRadius: 10, border: '1px solid #efeaf8', background: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flex: 'none' }}>
          <Icon icon={PanelLeftClose} size={17} stroke="#7c3aed" />
        </button>,
      )}
      {listBody}
    </div>
  );

  // Rail thu gọn (~56px): mũi tên mở rộng, nút +, rồi icon các chiến lược (hover xem tên).
  const rail = (
    <div style={{ width: 56, minWidth: 56, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, background: '#fff', border: '1px solid #efeaf8', borderRadius: 16, padding: '10px 0' }}>
      <button onClick={() => setCollapsed(false)} aria-label={t.csExpandList} title={t.csExpandList} style={{ width: 40, height: 40, borderRadius: 12, border: '1px solid #efeaf8', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
        <Icon icon={PanelLeftOpen} size={18} stroke="#7c3aed" />
      </button>
      <button onClick={openCreate} aria-label={t.csCreate} title={t.csCreate} style={{ width: 40, height: 40, borderRadius: 12, border: 'none', background: brandGradient, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
        <Icon icon={Plus} size={18} stroke="#fff" />
      </button>
      <div style={{ width: 28, height: 1, background: '#efeaf8' }} />
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, width: '100%', overflow: 'visible' }}>
        {filtered.map((s) => {
          const isSel = (mode.kind === 'view' || mode.kind === 'edit') && mode.id === s.id;
          return (
            <button
              key={s.id}
              onClick={() => selectStrategy(s.id)}
              aria-current={isSel ? 'true' : undefined}
              aria-label={s.name || '—'}
              title={s.name || '—'}
              className="strategy-card"
              style={{ position: 'relative', width: 40, height: 40, borderRadius: 12, cursor: 'pointer', border: isSel ? '2px solid transparent' : '1px solid #efeaf8', backgroundImage: isSel ? `linear-gradient(#f0e6fc,#f0e6fc), ${brandGradient}` : undefined, backgroundOrigin: 'border-box', backgroundClip: isSel ? 'padding-box, border-box' : undefined, background: isSel ? undefined : '#faf8ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Plus Jakarta Sans'", fontWeight: 800, fontSize: 15, color: '#5b4b86', boxShadow: isSel ? '0 16px 32px -16px rgba(139,92,246,.85)' : undefined, transform: isSel ? 'translateY(-1px)' : undefined, overflow: 'visible' }}
            >
              {(s.name || '—').charAt(0).toUpperCase()}
              <span style={{ position: 'absolute', top: -2, right: -2, width: 9, height: 9, borderRadius: '50%', background: dotColor(s.status), border: '2px solid #fff' }} />
            </button>
          );
        })}
      </div>
    </div>
  );

  const detail = (
    <Card style={{ flex: 1, minWidth: 0, padding: 22, alignSelf: 'flex-start' }}>
      {load === 'error' ? (
        <div style={{ textAlign: 'center', padding: '40px 0', color: '#8a85a0' }}>{t.listError}</div>
      ) : mode.kind === 'create' ? (
        <StrategyEditor strategy={null} brandId={brandId} brandName={activeBrand?.brandName ?? ''} onCancel={() => setMode({ kind: 'empty' })} onSaved={(s) => { refresh(brandId); setMode({ kind: 'view', id: s.id }); }} />
      ) : mode.kind === 'edit' && selected ? (
        <StrategyEditor strategy={selected} brandId={brandId} brandName={activeBrand?.brandName ?? ''} onCancel={() => setMode({ kind: 'view', id: selected.id })} onSaved={(s) => { refresh(brandId); setMode({ kind: 'view', id: s.id }); }} onDelete={() => setDeleting(selected)} />
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

  // ===== Mobile: drawer overlay (mặc định đóng), phủ lên content khi mở. =====
  if (isMobile) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
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
    <div style={{ display: 'flex', flexDirection: 'row', gap: 18, alignItems: 'flex-start' }}>
      <div className="transition-all duration-300 ease-in-out" style={{ width: collapsed ? 56 : 340, flex: 'none', overflow: collapsed ? 'visible' : 'hidden' }}>
        {collapsed ? rail : expandedSidebar}
      </div>
      {detail}
      {deleting && <ConfirmDialog title={t.csDelTitle} message={t.csDelMsg} confirmLabel={t.csDeleteBtn} busy={busy} onConfirm={confirmDelete} onClose={() => setDeleting(null)} />}
    </div>
  );
}
