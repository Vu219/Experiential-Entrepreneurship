import { useEffect, useMemo, useState } from 'react';
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

export default function StrategyManager() {
  const { t, brandGradient, activeBrandId } = useApp();
  const { isMobile } = useBreakpoint();
  const [load, setLoad] = useState<'loading' | 'error' | 'ok'>('loading');
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

  useEffect(() => { listBrandProfiles().then(setBrands).catch(() => setLoad('error')); }, []);
  useEffect(() => { refresh(brandId); setMode({ kind: 'empty' }); }, [brandId]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((s) => (status === 'all' || s.status === status) && (!q || s.name.toLowerCase().includes(q)));
  }, [items, query, status]);

  const toggleStatus = (s: ContentStrategy, next: StrategyStatus) => {
    setStrategyStatus(s.id, next).then((updated) => setItems((prev) => prev.map((x) => (x.id === s.id ? updated : x))));
  };

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

  if (!activeBrand && load === 'ok')
    return (
      <Card style={{ padding: '54px 24px', textAlign: 'center', color: '#8a85a0' }}>
        <div style={{ width: 60, height: 60, borderRadius: 16, background: '#f4f1fb', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
          <Icon path="M12 2l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 21l-5.2 2.8 1-5.8L3.5 8.2l5.9-.9z" size={28} stroke="#a78bfa" />
        </div>
        <div style={{ fontSize: 14.5, fontWeight: 600, color: '#5b5670' }}>{t.csNeedBrand}</div>
      </Card>
    );

  const selected = mode.kind === 'view' || mode.kind === 'edit' ? items.find((s) => s.id === mode.id) ?? null : null;

  const list = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: isMobile ? '100%' : 340, flex: 'none' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        {activeBrand && <span style={{ fontSize: 12, fontWeight: 700, color: '#7c3aed', background: '#f4ecff', borderRadius: 999, padding: '5px 12px' }}>{activeBrand.brandName}</span>}
        <button onClick={() => setMode({ kind: 'create' })} style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 6, border: 'none', borderRadius: 10, padding: '8px 14px', fontSize: 13, fontWeight: 700, color: '#fff', background: brandGradient, cursor: 'pointer' }}>
          <Icon path="M12 5v14M5 12h14" size={15} stroke="#fff" />{t.csCreate}
        </button>
      </div>
      <SearchInput value={query} onChange={setQuery} placeholder={t.csSearchPh} />
      <FilterSelect value={status} onChange={setStatus} options={[['all', t.csAllStatus], ['ACTIVE', t.csStActive], ['PAUSED', t.csStPaused], ['DRAFT', t.csStDraft]]} />

      {load === 'loading' ? (
        <Loader label={t.listLoading} />
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '34px 12px', color: '#8a85a0', fontSize: 13.5 }}>{items.length === 0 ? t.csEmptyTitle : t.listEmpty}</div>
      ) : (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {filtered.map((s) => (
              <StrategyCard key={s.id} s={s} selected={(mode.kind === 'view' || mode.kind === 'edit') && mode.id === s.id} onSelect={() => setMode({ kind: 'view', id: s.id })} onToggleStatus={(next) => toggleStatus(s, next)} />
            ))}
          </div>
          <div style={{ fontSize: 12, color: '#8a85a0', textAlign: 'center', paddingTop: 4 }}>{t.csShowing} 1-{filtered.length}/{filtered.length} {t.csStrategiesWord}</div>
        </>
      )}
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
        <StrategyDetail s={selected} onEdit={() => setMode({ kind: 'edit', id: selected.id })} onDelete={() => setDeleting(selected)} />
      ) : (
        <div style={{ textAlign: 'center', padding: '60px 16px', color: '#a39bbf' }}>
          <Icon path="M4 5h16v6H4zM4 13h16v6H4z" size={30} stroke="#cdc4e6" />
          <div style={{ fontSize: 14, fontWeight: 600, marginTop: 12 }}>{t.csDetailEmpty}</div>
        </div>
      )}
    </Card>
  );

  return (
    <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: 18, alignItems: 'flex-start' }}>
      {list}
      {detail}
      {deleting && <ConfirmDialog title={t.csDelTitle} message={t.csDelMsg} confirmLabel={t.csDeleteBtn} busy={busy} onConfirm={confirmDelete} onClose={() => setDeleting(null)} />}
    </div>
  );
}
