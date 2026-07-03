import { useEffect, useRef, useState } from 'react';
import { Plus, Sparkles } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import { Icon } from '../ui';
import { FilterSelect } from '../admin/AdminListPage';
import Pagination from '../admin/Pagination';
import type { PageResponse } from '../../api/apiClient';
import { listBrandProfiles, listAllBrandProfiles, listBrandIndustries, deleteBrandProfile, type BrandProfile } from '../../api/brandProfile';
import SearchSuggestInput from './SearchSuggestInput';
import BrandProfileCard from './BrandProfileCard';
import BrandProfileForm from './BrandProfileForm';
import BrandProfileView from './BrandProfileView';
import ConfirmDialog from './ConfirmDialog';
import { BrandListSkeleton, brandGridCols } from './BrandSkeleton';

type Panel = { mode: 'create' } | { mode: 'edit'; profile: BrandProfile } | { mode: 'view'; profile: BrandProfile } | null;

// Phân trang tab Thương hiệu: tối đa 6 card/trang, xử lý ở BACKEND (PageResponse);
// grid 1/2/3 cột theo breakpoint → brandGridCols.
const PAGE_SIZE = 6;

export default function BrandProfileList() {
  const { t, brandGradient, activeBrandId, setActiveBrand } = useApp();
  const { width } = useBreakpoint();
  const [load, setLoad] = useState<'loading' | 'error' | 'ok'>('loading');
  const [data, setData] = useState<PageResponse<BrandProfile> | null>(null);
  const [industries, setIndustries] = useState<string[]>([]);
  const [query, setQuery] = useState(''); // chữ đang gõ (chưa tìm)
  const [submittedQ, setSubmittedQ] = useState(''); // từ khóa đã chốt bằng Enter/chọn gợi ý
  const [suggestNames, setSuggestNames] = useState<string[]>([]);
  const [industry, setIndustry] = useState('all');
  const [page, setPage] = useState(1); // UI 1-based ↔ backend Pageable 0-based
  const [reloadKey, setReloadKey] = useState(0);
  const [panel, setPanel] = useState<Panel>(null);
  const [deleting, setDeleting] = useState<BrandProfile | null>(null);
  const [busy, setBusy] = useState(false);
  // Vừa xóa hồ sơ đang dùng → sau khi tải lại chọn hồ sơ active/đầu tiên còn lại.
  const reassignActive = useRef(false);

  // Nguồn gợi ý cho ô tìm kiếm: tên toàn bộ hồ sơ đang có (chỉ tải lại khi dữ liệu đổi,
  // KHÔNG gọi API theo từng phím gõ — tìm thật chỉ chạy khi nhấn Enter/chọn gợi ý).
  useEffect(() => {
    listAllBrandProfiles().then((all) => setSuggestNames(all.map((b) => b.brandName))).catch(() => setSuggestNames([]));
  }, [reloadKey]);
  // Đổi bộ lọc → quay về trang 1.
  useEffect(() => { setPage(1); }, [submittedQ, industry]);

  useEffect(() => {
    let cancelled = false;
    setLoad('loading');
    Promise.all([
      listBrandProfiles({ q: submittedQ || undefined, industry: industry === 'all' ? undefined : industry, page: page - 1, size: PAGE_SIZE }),
      listBrandIndustries(),
    ])
      .then(([pg, inds]) => {
        if (cancelled) return;
        // Trang hiện tại hết dữ liệu (vd xóa card cuối trang cuối) → lùi về trang cuối còn dữ liệu.
        if (pg.content.length === 0 && pg.totalPages > 0 && page > pg.totalPages) { setPage(pg.totalPages); return; }
        setData(pg);
        setIndustries(inds);
        if (pg.content.length && (reassignActive.current || !activeBrandId)) {
          reassignActive.current = false;
          setActiveBrand((pg.content.find((b) => b.isActive) ?? pg.content[0]).id);
        }
        setLoad('ok');
      })
      .catch(() => { if (!cancelled) setLoad('error'); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submittedQ, industry, page, reloadKey]);

  const refresh = () => setReloadKey((k) => k + 1);

  const confirmDelete = async () => {
    if (!deleting) return;
    setBusy(true);
    try {
      await deleteBrandProfile(deleting.id);
      if (deleting.id === activeBrandId) reassignActive.current = true;
      setDeleting(null);
      refresh();
    } finally {
      setBusy(false);
    }
  };

  if (load === 'loading') return <BrandListSkeleton />;
  if (load === 'error')
    return (
      <div style={{ textAlign: 'center', padding: '54px 16px', color: '#8a85a0' }}>
        <div style={{ fontSize: 14.5, fontWeight: 600, marginBottom: 14 }}>{t.listError}</div>
        <button onClick={refresh} className="btn-grad" style={{ border: 'none', borderRadius: 10, padding: '9px 18px', fontWeight: 700, fontSize: 13, color: '#fff', background: brandGradient, cursor: 'pointer' }}>{t.retry}</button>
      </div>
    );

  // Tạo / Xem / Sửa mở dạng FULL-PAGE (thay cho grid), không dùng panel góc phải.
  if (panel?.mode === 'create')
    return <BrandProfileForm profile={null} onClose={() => setPanel(null)} onSaved={(saved, created) => { if (created && !activeBrandId) setActiveBrand(saved.id); setPanel(null); refresh(); }} />;
  if (panel?.mode === 'edit')
    return <BrandProfileForm profile={panel.profile} onClose={() => setPanel(null)} onSaved={() => { setPanel(null); refresh(); }} />;
  if (panel?.mode === 'view')
    return <BrandProfileView profile={panel.profile} onClose={() => setPanel(null)} onEdit={() => setPanel({ mode: 'edit', profile: panel.profile })} />;

  const items = data?.content ?? [];
  const total = data?.totalElements ?? 0;
  const noFilters = !submittedQ && industry === 'all';

  return (
    // view-pop: nội dung thật fade-in sau khi skeleton biến mất.
    <div className="view-pop" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
        <SearchSuggestInput value={query} onChange={setQuery} onSubmit={setSubmittedQ} suggestions={suggestNames} placeholder={t.bpSearchPh} />
        <FilterSelect value={industry} onChange={setIndustry} options={[['all', `${t.bpFilterIndustry}: ${t.bpAllIndustries}`], ...industries.map((i) => [i, i] as [string, string])]} />
        <button onClick={() => setPanel({ mode: 'create' })} className="btn-grad" style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 8, border: 'none', borderRadius: 11, padding: '10px 18px', fontSize: 14, fontWeight: 700, color: '#fff', background: brandGradient, cursor: 'pointer' }}>
          <Icon icon={Plus} size={17} stroke="#fff" />{t.bpCreate}
        </button>
      </div>

      {total === 0 && noFilters ? (
        <Empty onCreate={() => setPanel({ mode: 'create' })} />
      ) : items.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <span style={{ color: '#8a85a0', fontSize: 14 }}>{t.listEmpty}</span>
          <button onClick={() => { setQuery(''); setSubmittedQ(''); setIndustry('all'); }} className="btn-soft" style={{ border: 'none', background: '#f4f2fb', color: '#5b5670', borderRadius: 10, padding: '8px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>{t.clearFilters}</button>
        </div>
      ) : (
        <>
          {/* Grid responsive 4 mốc: 1 cột mobile / 2 tablet / 3 laptop+PC (6 card = 2 hàng cân đối). */}
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${brandGridCols(width)}, minmax(0,1fr))`, gap: 16 }}>
            {items.map((p) => (
              <BrandProfileCard
                key={p.id}
                profile={p}
                strategyCount={p.strategyCount ?? 0}
                active={p.id === activeBrandId}
                onUse={() => setActiveBrand(p.id)}
                onView={() => setPanel({ mode: 'view', profile: p })}
                onEdit={() => setPanel({ mode: 'edit', profile: p })}
                onDelete={() => setDeleting(p)}
              />
            ))}
          </div>
          <Pagination page={page} pageCount={data?.totalPages ?? 1} onChange={setPage} />
        </>
      )}

      {deleting && (
        <ConfirmDialog title={t.bpDelTitle} message={t.bpDelMsg} confirmLabel={t.bpDelConfirm} busy={busy} onConfirm={confirmDelete} onClose={() => setDeleting(null)} />
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
      <div style={{ fontFamily: "'Plus Jakarta Sans'", fontWeight: 800, fontSize: 18, color: '#211c38' }}>{t.bpEmptyTitle}</div>
      <div style={{ fontSize: 13.5, color: '#8a85a0', margin: '8px auto 22px', maxWidth: 380 }}>{t.bpEmptyDesc}</div>
      <button onClick={onCreate} className="btn-grad" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, border: 'none', borderRadius: 12, padding: '12px 24px', fontSize: 14, fontWeight: 700, color: '#fff', background: brandGradient, cursor: 'pointer' }}>
        <Icon icon={Plus} size={17} stroke="#fff" />{t.bpCreateFirst}
      </button>
    </div>
  );
}
