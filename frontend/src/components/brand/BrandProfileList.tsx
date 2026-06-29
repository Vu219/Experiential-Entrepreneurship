import { useEffect, useMemo, useState } from 'react';
import { Plus, Sparkles } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Loader, Icon } from '../ui';
import { SearchInput, FilterSelect } from '../admin/AdminListPage';
import { listBrandProfiles, deleteBrandProfile, type BrandProfile } from '../../api/brandProfile';
import { listAllContentStrategies } from '../../api/contentStrategy';
import BrandProfileCard from './BrandProfileCard';
import BrandProfileForm from './BrandProfileForm';
import BrandProfileView from './BrandProfileView';
import ConfirmDialog from './ConfirmDialog';

type Panel = { mode: 'create' } | { mode: 'edit'; profile: BrandProfile } | { mode: 'view'; profile: BrandProfile } | null;

export default function BrandProfileList() {
  const { t, brandGradient, activeBrandId, setActiveBrand } = useApp();
  const [load, setLoad] = useState<'loading' | 'error' | 'ok'>('loading');
  const [profiles, setProfiles] = useState<BrandProfile[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [query, setQuery] = useState('');
  const [industry, setIndustry] = useState('all');
  const [panel, setPanel] = useState<Panel>(null);
  const [deleting, setDeleting] = useState<BrandProfile | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = () => {
    setLoad('loading');
    Promise.all([listBrandProfiles(), listAllContentStrategies()])
      .then(([list, strategies]) => {
        setProfiles(list);
        const c: Record<string, number> = {};
        strategies.forEach((s) => { c[s.brandId] = (c[s.brandId] ?? 0) + 1; });
        setCounts(c);
        // Mặc định chọn hồ sơ active = hồ sơ đầu tiên nếu chưa có / không còn hợp lệ.
        if (list.length && !list.some((p) => p.id === activeBrandId)) setActiveBrand(list[0].id);
        setLoad('ok');
      })
      .catch(() => setLoad('error'));
  };
  useEffect(refresh, []); // eslint-disable-line react-hooks/exhaustive-deps

  const industries = useMemo(() => Array.from(new Set(profiles.map((p) => p.industry))).filter(Boolean), [profiles]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return profiles.filter((p) => (industry === 'all' || p.industry === industry) && (!q || p.brandName.toLowerCase().includes(q)));
  }, [profiles, query, industry]);

  const confirmDelete = async () => {
    if (!deleting) return;
    setBusy(true);
    try {
      await deleteBrandProfile(deleting.id);
      setDeleting(null);
      refresh();
    } finally {
      setBusy(false);
    }
  };

  if (load === 'loading') return <Loader label={t.listLoading} />;
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
        <SearchInput value={query} onChange={setQuery} placeholder={t.bpSearchPh} />
        <FilterSelect value={industry} onChange={setIndustry} options={[['all', `${t.bpFilterIndustry}: ${t.bpAllIndustries}`], ...industries.map((i) => [i, i] as [string, string])]} />
        <button onClick={() => setPanel({ mode: 'create' })} className="btn-grad" style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 8, border: 'none', borderRadius: 11, padding: '10px 18px', fontSize: 14, fontWeight: 700, color: '#fff', background: brandGradient, cursor: 'pointer' }}>
          <Icon icon={Plus} size={17} stroke="#fff" />{t.bpCreate}
        </button>
      </div>

      {profiles.length === 0 ? (
        <Empty onCreate={() => setPanel({ mode: 'create' })} />
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <span style={{ color: '#8a85a0', fontSize: 14 }}>{t.listEmpty}</span>
          <button onClick={() => { setQuery(''); setIndustry('all'); }} className="btn-soft" style={{ border: 'none', background: '#f4f2fb', color: '#5b5670', borderRadius: 10, padding: '8px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>{t.clearFilters}</button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: 16 }}>
          {filtered.map((p) => (
            <BrandProfileCard
              key={p.id}
              profile={p}
              strategyCount={counts[p.id] ?? 0}
              active={p.id === activeBrandId}
              onUse={() => setActiveBrand(p.id)}
              onView={() => setPanel({ mode: 'view', profile: p })}
              onEdit={() => setPanel({ mode: 'edit', profile: p })}
              onDelete={() => setDeleting(p)}
            />
          ))}
        </div>
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
