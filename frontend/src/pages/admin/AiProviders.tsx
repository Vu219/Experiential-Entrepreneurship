import {
useEffect, useMemo, useState, type CSSProperties } from 'react';
import { Boxes, Clock, KeyRound, Plus, PlugZap, RefreshCw, Search, Server } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Card, Icon, Loader } from '../../components/ui';
import Modal from '../../components/Modal';
import ConfirmModal from '../../components/ConfirmModal';
import AiServiceStatusBadge from '../../components/admin/AiServiceStatusBadge';
import AiStatusBanner from '../../components/admin/AiStatusBanner';
import AiProviderCard, { providerStatus, type ProviderStatus } from '../../components/admin/AiProviderCard';
import { useToast } from '../../components/toast/ToastProvider';
import {
  getAiStatus, listAiModelHealth, listAiProviders, resetAiModelHealth, syncAiProviderModels, testAiProvider,
  updateAiProvider, fmtAiDateTime, aiModelHealthText, aiTestStatusText, aiTestTone,
  type AiEffectiveStatus, type AiModelHealth, type AiProviderInfo, type AiTestResult,
} from '../../api/adminAi';
import PageContainer from '../../components/PageContainer';
import { C } from '../../styles/colors';

const btnOutline: CSSProperties = {
  border: `1px solid ${C.border}`, background: C.surface, borderRadius: 9, padding: '6px 12px',
  fontSize: 12.5, fontWeight: 700, color: C.ink550, cursor: 'pointer',
  display: 'inline-flex', alignItems: 'center', gap: 6,
};
const inputStyle: CSSProperties = {
  width: '100%', border: `1.5px solid ${C.border}`, borderRadius: 10, padding: '10px 14px',
  fontSize: 14, color: C.ink750, outline: 'none',
};
const labelStyle: CSSProperties = { display: 'block', fontSize: 12.5, fontWeight: 700, color: C.text, marginBottom: 6 };

const statCard: CSSProperties = {
  background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: '14px 16px',
  boxShadow: `0 10px 26px -22px ${C.legacyShadowrgba8040140_5_}`, display: 'flex', flexDirection: 'column', gap: 8,
  minWidth: 0, position: 'relative', overflow: 'hidden',
};
const quickBtn: CSSProperties = { ...btnOutline, padding: '8px 13px', fontSize: 13, borderRadius: 10 };
const addHint: CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600, color: C.textFaint,
  background: 'transparent', border: `1px dashed ${C.legacyBorderded7ee}`, borderRadius: 8, padding: '6px 10px', cursor: 'not-allowed',
};

type FilterKey = 'all' | 'connected' | 'limited' | 'error' | 'pending' | 'nokey' | 'off';
type SortKey = 'status' | 'name' | 'models' | 'synced';
const STATUS_RANK: Record<ProviderStatus, number> = { connected: 0, pending: 1, limited: 2, nokey: 3, error: 4 };

export default function AiProviders() {
  const { t, lang, brandGradient } = useApp();
  const toast = useToast();
  const [load, setLoad] = useState<'loading' | 'error' | 'ok'>('loading');
  const [rows, setRows] = useState<AiProviderInfo[]>([]);
  const [status, setStatus] = useState<AiEffectiveStatus | null>(null);
  const [testing, setTesting] = useState<Set<string>>(new Set());
  const [syncing, setSyncing] = useState<Set<string>>(new Set());
  const [health, setHealth] = useState<AiModelHealth[]>([]);
  const [resetting, setResetting] = useState<Set<string>>(new Set());
  const [bulk, setBulk] = useState(false);

  // Toolbar (chỉ hiện khi > 4 provider)
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<FilterKey>('all');
  const [sortBy, setSortBy] = useState<SortKey>('status');

  // Modal sửa key/tên
  const [editing, setEditing] = useState<AiProviderInfo | null>(null);
  const [nameInput, setNameInput] = useState('');
  const [keyInput, setKeyInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Xác nhận TẮT provider
  const [disabling, setDisabling] = useState<AiProviderInfo | null>(null);
  const [busy, setBusy] = useState(false);

  const fetchProviders = () => {
    setLoad('loading');
    Promise.all([listAiProviders(), getAiStatus()])
      .then(([r, s]) => { setRows(r); setStatus(s); setLoad('ok'); })
      .catch(() => setLoad('error'));
    // Trạng thái model là phụ — lỗi (vd Redis) không được làm hỏng trang.
    listAiModelHealth().then(setHealth).catch(() => setHealth([]));
  };
  useEffect(fetchProviders, []);

  const replaceRow = (p: AiProviderInfo) => setRows((prev) => prev.map((x) => (x.id === p.id ? p : x)));
  const mark = (setter: typeof setTesting, id: string, on: boolean) =>
    setter((prev) => { const n = new Set(prev); if (on) n.add(id); else n.delete(id); return n; });

  const openEdit = (p: AiProviderInfo) => { setEditing(p); setNameInput(p.name); setKeyInput(''); setEditError(null); };

  const saveEdit = () => {
    if (!editing) return;
    setSaving(true); setEditError(null);
    updateAiProvider(editing.id, {
      name: nameInput.trim() || undefined,
      apiKey: keyInput.trim() || undefined, // trống = giữ key hiện tại (write-only)
    })
      .then((p) => { replaceRow(p); setEditing(null); toast.success(t.aiProviderSaved); })
      .catch((e: Error) => setEditError(e.message))
      .finally(() => setSaving(false));
  };

  const runTest = (p: AiProviderInfo) => {
    mark(setTesting, p.id, true);
    testAiProvider(p.id)
      .then((r) => {
        const tone = aiTestTone(r.status);
        const text = aiTestStatusText(lang, r.status, r.freeTier || !!p.freeTierDetectedAt);
        if (tone === 'ok') toast.success(`${t.aiTestOk}${r.latencyMs != null ? ` · ${r.latencyMs}ms` : ''}`);
        else if (tone === 'limited') toast.warning(text.detail, { title: text.badge });
        else toast.error(r.status === 'FAILED' && r.message ? r.message : text.detail, { title: text.badge });
        fetchProviders();
      })
      .catch((e: Error) => toast.error(e.message))
      .finally(() => mark(setTesting, p.id, false));
  };

  const runSync = (p: AiProviderInfo) => {
    mark(setSyncing, p.id, true);
    syncAiProviderModels(p.id)
      .then((updated) => { replaceRow(updated); toast.success(t.aiSyncOk); })
      .catch((e: Error) => toast.error(e.message))
      .finally(() => mark(setSyncing, p.id, false));
  };

  const runResetHealth = (p: AiProviderInfo) => {
    mark(setResetting, p.id, true);
    resetAiModelHealth(p.id)
      .then((n) => {
        toast.success(aiModelHealthText(lang).resetDone(n));
        listAiModelHealth().then(setHealth).catch(() => {});
      })
      .catch((e: Error) => toast.error(e.message))
      .finally(() => mark(setResetting, p.id, false));
  };

  const setEnabled = (p: AiProviderInfo, enabled: boolean) => {
    setBusy(true);
    updateAiProvider(p.id, { enabled })
      .then((updated) => {
        replaceRow(updated);
        toast.success(enabled ? t.aiProviderEnabled : t.aiProviderDisabled);
        getAiStatus().then(setStatus).catch(() => {});
      })
      .catch((e: Error) => toast.error(e.message))
      .finally(() => { setBusy(false); setDisabling(null); });
  };

  // ===== Mass actions (lặp các call đơn lẻ — hiện tối đa 2 provider) =====
  const syncAll = () => {
    const targets = rows.filter((p) => p.apiKeyMasked);
    if (!targets.length) return;
    setBulk(true); setSyncing(new Set(targets.map((p) => p.id)));
    Promise.allSettled(targets.map((p) => syncAiProviderModels(p.id)))
      .then((res) => {
        toast.success(t.aiSyncAllDone.replace('{n}', String(res.filter((r) => r.status === 'fulfilled').length)));
        fetchProviders();
      })
      .finally(() => { setSyncing(new Set()); setBulk(false); });
  };
  const testAll = () => {
    const targets = rows.filter((p) => p.apiKeyMasked);
    if (!targets.length) return;
    setBulk(true); setTesting(new Set(targets.map((p) => p.id)));
    Promise.allSettled(targets.map((p) => testAiProvider(p.id)))
      .then((res) => {
        const ok = res.filter((r) => r.status === 'fulfilled' && aiTestTone((r.value as AiTestResult).status) === 'ok').length;
        toast.success(t.aiTestAllDone.replace('{n}', String(ok)));
        fetchProviders();
      })
      .finally(() => { setTesting(new Set()); setBulk(false); });
  };

  const stats = useMemo(() => {
    const keyed = rows.filter((p) => p.apiKeyMasked).length;
    const models = rows.reduce((s, p) => s + (p.modelCatalog?.length ?? 0), 0);
    const lastSync = rows.map((p) => p.modelCatalogSyncedAt).filter(Boolean).sort().pop() ?? null;
    const enabled = rows.filter((p) => p.enabled).length;
    return { total: rows.length, keyed, models, lastSync, enabled };
  }, [rows]);

  const visibleRows = useMemo(() => {
    let list = rows.slice();
    if (query) {
      const q = query.toLowerCase();
      list = list.filter((p) => (`${p.name} ${p.code}`).toLowerCase().includes(q));
    }
    if (filter === 'off') list = list.filter((p) => !p.enabled);
    else if (filter !== 'all') list = list.filter((p) => providerStatus(p) === filter);
    list.sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      if (sortBy === 'models') return (b.modelCatalog?.length ?? 0) - (a.modelCatalog?.length ?? 0);
      if (sortBy === 'synced') return (b.modelCatalogSyncedAt ?? '').localeCompare(a.modelCatalogSyncedAt ?? '');
      return (STATUS_RANK[providerStatus(b)] - STATUS_RANK[providerStatus(a)]) || (Number(b.enabled) - Number(a.enabled));
    });
    return list;
  }, [rows, query, filter, sortBy]);

  const statTiles = [
    { key: 'prov', label: t.aiStatProviders, value: stats.total, sub: `${stats.enabled}/${stats.total} ${t.aiEnabled.toLowerCase()}`, icon: Server, hue: '#8b5cf6', tint: C.legacyBgf1ecfe },
    { key: 'keys', label: t.aiStatKeys, value: `${stats.keyed}/${stats.total}`, sub: undefined, icon: KeyRound, hue: '#0e7490', tint: C.legacyBge3f3f6 },
    { key: 'models', label: t.aiStatModels, value: stats.models, sub: undefined, icon: Boxes, hue: '#4285f4', tint: C.legacyBge8f0fe },
    { key: 'sync', label: t.aiStatLastSync, value: stats.lastSync ? fmtAiDateTime(stats.lastSync) : '—', sub: undefined, icon: Clock, hue: '#c0740b', tint: C.legacyBgfdf1dd },
  ] as const;

  const FILTERS: { key: FilterKey; label: string }[] = [
    { key: 'all', label: t.filterAll },
    { key: 'connected', label: t.aiStatusConnected },
    { key: 'limited', label: lang === 'en' ? 'Limited' : 'Tạm giới hạn' },
    { key: 'error', label: t.aiFilterError },
    { key: 'pending', label: t.aiStatusPending },
    { key: 'nokey', label: t.aiNoKey },
    { key: 'off', label: t.aiDisabled },
  ];

  return (
    <PageContainer>
      {/* Ghi chú bảo mật + badge trạng thái AI service */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 12.5, color: C.textMuted }}>{t.aiProvidersHint}</div>
        <AiServiceStatusBadge />
      </div>

      {/* Banner effective status (task-route health thật — GET /admin/ai/status) */}
      <AiStatusBanner status={status} />

      {load === 'loading' && <Card><Loader label={t.listLoading} /></Card>}

      {load === 'error' && (
        <Card style={{ textAlign: 'center', padding: '54px 16px' }}>
          <div style={{ fontSize: 14.5, fontWeight: 600, color: C.ink550, marginBottom: 14 }}>{t.listError}</div>
          <button onClick={fetchProviders} style={{ border: 'none', borderRadius: 10, padding: '9px 18px', fontWeight: 700, fontSize: 13, color: C.onBrand, background: brandGradient, cursor: 'pointer' }}>{t.retry}</button>
        </Card>
      )}

      {load === 'ok' && (
        <>
          {/* Stats overview */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
            {statTiles.map((s) => (
              <div key={s.key} style={statCard}>
                <span style={{ position: 'absolute', insetInline: 0, top: 0, height: 3, background: s.hue }} />
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase', color: C.ink350 }}>{s.label}</span>
                  <span style={{ width: 30, height: 30, borderRadius: 9, display: 'grid', placeItems: 'center', background: s.tint }}><Icon icon={s.icon} size={16} stroke={s.hue} /></span>
                </div>
                <div style={{ fontSize: 24, fontWeight: 800, color: C.textStrong, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{s.value}</div>
                {s.sub && <div style={{ fontSize: 12, color: C.textMuted }}>{s.sub}</div>}
              </div>
            ))}
          </div>

          {/* Quick actions + Add hint (nút mờ nhỏ, disabled — backend cố định 2 provider) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', justifyContent: 'space-between' }}>
            <button type="button" disabled title={t.aiAddProviderLocked} style={addHint}>
              <Icon icon={Plus} size={13} stroke={C.textFaint} />{t.aiAddProvider}
            </button>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button onClick={syncAll} disabled={bulk || !stats.keyed} style={{ ...quickBtn, opacity: bulk || !stats.keyed ? 0.5 : 1, cursor: bulk ? 'wait' : 'pointer' }}>
                <Icon icon={RefreshCw} size={14} stroke={C.primary} />{t.aiSyncAll}
              </button>
              <button onClick={testAll} disabled={bulk || !stats.keyed} style={{ ...quickBtn, opacity: bulk || !stats.keyed ? 0.5 : 1, cursor: bulk ? 'wait' : 'pointer' }}>
                <Icon icon={PlugZap} size={14} stroke={C.info} />{t.aiTestAll}
              </button>
            </div>
          </div>

          {/* Filter / sort / search — chỉ khi > 4 provider */}
          {rows.length > 4 && (
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              <div style={{ position: 'relative', flex: '1 1 220px', minWidth: 180 }}>
                <Search size={16} color={C.ink350} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t.aiSearchPlaceholder} style={{ ...inputStyle, padding: '9px 12px 9px 36px' }} />
              </div>
              <div style={{ display: 'inline-flex', flexWrap: 'wrap', gap: 6 }}>
                {FILTERS.map((f) => (
                  <button key={f.key} onClick={() => setFilter(f.key)} style={{ ...btnOutline, background: filter === f.key ? C.purpleSoft : C.surface, color: filter === f.key ? C.primary : C.ink550, borderColor: filter === f.key ? C.legacyBorderddc9fb : C.border }}>{f.label}</button>
                ))}
              </div>
              <select aria-label={t.aiSortLabel} value={sortBy} onChange={(e) => setSortBy(e.target.value as SortKey)} style={{ ...btnOutline, padding: '8px 12px', cursor: 'pointer' }}>
                <option value="status">{t.aiSortStatus}</option>
                <option value="name">{t.aiSortName}</option>
                <option value="models">{t.aiSortModels}</option>
                <option value="synced">{t.aiSortSynced}</option>
              </select>
            </div>
          )}

          {/* Grid */}
          {rows.length === 0 ? (
            <Card style={{ textAlign: 'center', padding: '54px 16px', color: C.textMuted, fontSize: 14.5, fontWeight: 600 }}>{t.listEmpty}</Card>
          ) : visibleRows.length === 0 ? (
            <Card style={{ textAlign: 'center', padding: '40px 16px', color: C.textMuted, fontSize: 14, fontWeight: 600 }}>{t.listEmpty}</Card>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
              {visibleRows.map((p) => (
                <AiProviderCard
                  key={p.id}
                  provider={p}
                  testing={testing.has(p.id)}
                  syncing={syncing.has(p.id)}
                  busyToggle={busy}
                  health={health.filter((h) => h.provider === p.code.toLowerCase())}
                  resetting={resetting.has(p.id)}
                  onResetHealth={runResetHealth}
                  onEdit={openEdit}
                  onTest={runTest}
                  onSync={runSync}
                  onToggle={(pp, next) => (next ? setEnabled(pp, true) : setDisabling(pp))}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* Modal sửa key/tên — key write-only, không bao giờ hiển thị full key cũ */}
      {editing && (
        <Modal title={`${t.aiEditKey} · ${editing.name}`} maxWidth={460} onClose={() => setEditing(null)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {editError && (
              <div style={{ padding: '10px 14px', borderRadius: 8, background: C.dangerSoft2, color: C.danger, fontSize: 13, fontWeight: 600 }}>{editError}</div>
            )}
            <div>
              <label style={labelStyle}>{t.aiNameLabel}</label>
              <input value={nameInput} onChange={(e) => setNameInput(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>
                {t.aiNewKey}
                {editing.apiKeyMasked && <span style={{ fontWeight: 600, color: C.textFaint }}> · {t.aiCurrentKey}: {editing.apiKeyMasked}</span>}
              </label>
              <input type="password" autoComplete="new-password" value={keyInput} onChange={(e) => setKeyInput(e.target.value)} placeholder={t.aiKeyPlaceholder} style={{ ...inputStyle, fontFamily: 'monospace' }} />
              <div style={{ fontSize: 12, color: C.textMuted, marginTop: 6 }}>{t.aiKeyHint}</div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 4 }}>
              <button onClick={() => setEditing(null)} style={{ ...btnOutline, padding: '9px 18px', fontSize: 13 }}>{t.cancel}</button>
              <button onClick={saveEdit} disabled={saving} style={{ border: 'none', background: brandGradient, borderRadius: 10, padding: '9px 20px', fontSize: 13, fontWeight: 700, color: C.onBrand, cursor: saving ? 'wait' : 'pointer', opacity: saving ? 0.6 : 1 }}>
                {saving ? t.processing : t.aiSave}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Xác nhận TẮT provider — kèm số nghiệp vụ đang định tuyến vào provider này */}
      {disabling && (
        <ConfirmModal
          variant="warning"
          title={`${t.aiDisable} · ${disabling.name}`}
          message={t.aiDisableConfirm}
          confirmLabel={t.aiDisable}
          busy={busy}
          onConfirm={() => setEnabled(disabling, false)}
          onClose={() => setDisabling(null)}
        >
          {disabling.dependentTaskCount > 0 && (
            <div style={{ padding: '10px 14px', borderRadius: 8, background: C.warningSoft, color: C.amberText, fontSize: 13, fontWeight: 600, marginBottom: 12 }}>
              {t.aiModelInUse.replace('{n}', String(disabling.dependentTaskCount))}
            </div>
          )}
        </ConfirmModal>
      )}
    </PageContainer>
  );
}
