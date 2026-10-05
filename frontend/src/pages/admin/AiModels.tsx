import {
useEffect, useMemo, useState, type CSSProperties } from 'react';
import { Plus } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Loader, Card } from '../../components/ui';
import Modal from '../../components/Modal';
import ConfirmModal from '../../components/ConfirmModal';
import StatusBadge from '../../components/admin/StatusBadge';
import SectionCard from '../../components/admin/SectionCard';
import AiServiceStatusBadge from '../../components/admin/AiServiceStatusBadge';
import AiStatusBanner from '../../components/admin/AiStatusBanner';
import RouteHealthBadge, { ModelBlockHint } from '../../components/admin/RouteHealthBadge';
import FallbackChainEditor from '../../components/admin/FallbackChainEditor';
import Switch from '../../components/admin/Switch';
import Pagination from '../../components/admin/Pagination';
import { DataTable } from '../../components/admin/AdminListPage';
import { useToast } from '../../components/toast/ToastProvider';
import {
  aiTaskLabel,
  createAiModel,
  deleteAiModel,
  fmtAiDateTime,
  getAiStatus,
  listAiModels,
  listAiProviders,
  listAiRouting,
  modelBlockReason,
  updateAiModel,
  updateAiRouting,
  type AiCatalogModel,
  type AiEffectiveStatus,
  type AiModelInfo,
  type AiProviderInfo,
  type AiRoutingInfo,
} from '../../api/adminAi';
import PageContainer from '../../components/PageContainer';
import { C } from '../../styles/colors';

const btnOutline: CSSProperties = {
  border: `1px solid ${C.border}`, background: C.surface, borderRadius: 9, padding: '6px 12px',
  fontSize: 12.5, fontWeight: 700, color: C.ink550, cursor: 'pointer',
};

const inputStyle: CSSProperties = {
  width: '100%', border: `1.5px solid ${C.border}`, borderRadius: 10, padding: '10px 14px',
  fontSize: 14, color: C.ink750, outline: 'none',
};

const labelStyle: CSSProperties = { display: 'block', fontSize: 12.5, fontWeight: 700, color: C.text, marginBottom: 6 };

const tdStyle: CSSProperties = { padding: '13px 16px', fontSize: 13.5, color: C.ink750 };

// Ô nhập trong chế độ "Chỉnh nhanh" định tuyến (gọn hơn tdStyle để vừa 1 hàng)
const editCell: CSSProperties = { padding: '9px 12px', verticalAlign: 'top' };
const miniSelect: CSSProperties = {
  width: '100%', minWidth: 150, border: `1px solid ${C.border}`, borderRadius: 8, padding: '7px 9px',
  fontSize: 12.5, color: C.ink750, outline: 'none', cursor: 'pointer', fontFamily: 'monospace',
};
const miniInput: CSSProperties = {
  width: 90, border: `1px solid ${C.border}`, borderRadius: 8, padding: '7px 9px',
  fontSize: 12.5, color: C.ink750, outline: 'none',
};

/** Input số nullable: chuỗi rỗng ↔ null (temperature/max tokens/đơn giá). */
const numOrNull = (s: string): number | null => (s.trim() === '' ? null : Number(s));

/** Ngưỡng bật tìm kiếm + phân trang client cho bảng model. */
const MODELS_PAGE_SIZE = 10;

/** Bản nháp một dòng định tuyến khi bật "Chỉnh nhanh" (số để dạng chuỗi cho input). */
type RouteDraft = { primaryModelId: string; fallbackModelIds: string[]; temp: string; maxTokens: string; enabled: boolean };
/** Chuỗi dự phòng của routing theo thứ tự (dữ liệu cũ chưa có `fallbacks` → cột legacy). */
const chainOf = (r: AiRoutingInfo): string[] =>
  r.fallbacks?.length ? r.fallbacks.map((f) => f.modelId) : r.fallbackModelId ? [r.fallbackModelId] : [];
const toDraft = (r: AiRoutingInfo): RouteDraft => ({
  primaryModelId: r.primaryModelId,
  fallbackModelIds: chainOf(r),
  temp: r.temperature != null ? String(r.temperature) : '',
  maxTokens: r.maxTokens != null ? String(r.maxTokens) : '',
  enabled: r.enabled,
});
const routeDirty = (r: AiRoutingInfo, d: RouteDraft): boolean =>
  d.primaryModelId !== r.primaryModelId
  || d.fallbackModelIds.join() !== chainOf(r).join()
  || numOrNull(d.temp) !== (r.temperature ?? null)
  || numOrNull(d.maxTokens) !== (r.maxTokens ?? null)
  || d.enabled !== r.enabled;

export default function AiModels() {
  const { t, lang, brandGradient } = useApp();
  const toast = useToast();
  const [load, setLoad] = useState<'loading' | 'error' | 'ok'>('loading');
  const [models, setModels] = useState<AiModelInfo[]>([]);
  const [providers, setProviders] = useState<AiProviderInfo[]>([]);
  const [routing, setRouting] = useState<AiRoutingInfo[]>([]);
  const [status, setStatus] = useState<AiEffectiveStatus | null>(null);
  const [busy, setBusy] = useState(false);

  // Tìm kiếm + phân trang client — chỉ hiện khi vượt MODELS_PAGE_SIZE dòng
  const [q, setQ] = useState('');
  const [mPage, setMPage] = useState(1);

  // Modal model (tạo mới khi editingModel == null && showModelModal)
  const [showModelModal, setShowModelModal] = useState(false);
  const [editingModel, setEditingModel] = useState<AiModelInfo | null>(null);
  const [mProviderId, setMProviderId] = useState('');
  const [mCode, setMCode] = useState('');
  const [mName, setMName] = useState('');
  const [mPriceIn, setMPriceIn] = useState('');
  const [mPriceOut, setMPriceOut] = useState('');
  const [mMaxTokens, setMMaxTokens] = useState('');
  const [mCatalogPick, setMCatalogPick] = useState(''); // '' = nhập tay
  const [modalError, setModalError] = useState<string | null>(null);

  const [deletingModel, setDeletingModel] = useState<AiModelInfo | null>(null);
  const [disablingModel, setDisablingModel] = useState<AiModelInfo | null>(null);

  // Modal routing
  const [editingRoute, setEditingRoute] = useState<AiRoutingInfo | null>(null);
  const [rPrimary, setRPrimary] = useState('');
  const [rFallbacks, setRFallbacks] = useState<string[]>([]);
  const [rTemp, setRTemp] = useState('');
  const [rMaxTokens, setRMaxTokens] = useState('');
  const [rEnabled, setREnabled] = useState(true);

  // Chỉnh nhanh định tuyến: inline edit toàn bảng + bulk-apply + lọc route lỗi
  const [routeEdit, setRouteEdit] = useState(false);
  const [draft, setDraft] = useState<Record<string, RouteDraft>>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [failedRoutes, setFailedRoutes] = useState<Set<string>>(new Set());
  const [savingRoutes, setSavingRoutes] = useState(false);
  const [onlyProblems, setOnlyProblems] = useState(false);
  const [bulkPrimary, setBulkPrimary] = useState('');
  const [bulkFallback, setBulkFallback] = useState('');

  const fetchAll = () => {
    setLoad('loading');
    Promise.all([listAiModels(), listAiProviders(), listAiRouting(), getAiStatus()])
      .then(([m, p, r, s]) => { setModels(m); setProviders(p); setRouting(r); setStatus(s); setLoad('ok'); })
      .catch(() => setLoad('error'));
  };
  useEffect(fetchAll, []);

  const modelLabel = (m: AiModelInfo) => `${m.modelCode} · ${m.providerCode}`;

  // Effective status theo routingId — nguồn duy nhất từ GET /admin/ai/status (BE tính)
  const statusByRouting = useMemo(
    () => new Map((status?.routes ?? []).map((r) => [r.routingId, r])),
    [status],
  );

  // Catalog của provider đang chọn trong modal tạo model — loại model đã thêm
  const createProvider = providers.find((p) => p.id === mProviderId);
  const availableCatalog: AiCatalogModel[] = (createProvider?.modelCatalog ?? []).filter(
    (c) => !models.some((m) => m.providerId === mProviderId && m.modelCode === c.id),
  );

  const openCreateModel = () => {
    setEditingModel(null);
    setMProviderId(providers[0]?.id ?? '');
    setMCode('');
    setMName('');
    setMPriceIn('');
    setMPriceOut('');
    setMMaxTokens('');
    setMCatalogPick('');
    setModalError(null);
    setShowModelModal(true);
  };

  const openEditModel = (m: AiModelInfo) => {
    setEditingModel(m);
    setMName(m.displayName ?? '');
    setMPriceIn(m.inputPricePer1m != null ? String(m.inputPricePer1m) : '');
    setMPriceOut(m.outputPricePer1m != null ? String(m.outputPricePer1m) : '');
    setMMaxTokens(m.maxTokens != null ? String(m.maxTokens) : '');
    setModalError(null);
    setShowModelModal(true);
  };

  /** Chọn model từ catalog → auto-fill tên/max tokens (từ provider) + giá (từ bảng giá) — cho ghi đè. */
  const pickFromCatalog = (id: string) => {
    setMCatalogPick(id);
    if (!id) return;
    const c = availableCatalog.find((x) => x.id === id);
    if (!c) return;
    setMCode(c.id);
    setMName(c.displayName ?? '');
    setMMaxTokens(c.maxTokens != null ? String(c.maxTokens) : '');
    setMPriceIn(c.suggestedInputPricePer1m != null ? String(c.suggestedInputPricePer1m) : '');
    setMPriceOut(c.suggestedOutputPricePer1m != null ? String(c.suggestedOutputPricePer1m) : '');
  };

  const saveModel = () => {
    setBusy(true);
    setModalError(null);
    const req = editingModel
      ? updateAiModel(editingModel.id, {
          displayName: mName.trim() || undefined,
          inputPricePer1m: numOrNull(mPriceIn),
          outputPricePer1m: numOrNull(mPriceOut),
          maxTokens: numOrNull(mMaxTokens),
        })
      : createAiModel({
          providerId: mProviderId,
          modelCode: mCode.trim(),
          displayName: mName.trim() || undefined,
          inputPricePer1m: numOrNull(mPriceIn),
          outputPricePer1m: numOrNull(mPriceOut),
          maxTokens: numOrNull(mMaxTokens),
        });
    req
      .then(() => { setShowModelModal(false); toast.success(t.aiModelSaved); fetchAll(); })
      .catch((e: Error) => setModalError(e.message))
      .finally(() => setBusy(false));
  };

  const setModelEnabled = (m: AiModelInfo, enabled: boolean) => {
    setBusy(true);
    updateAiModel(m.id, { enabled })
      .then(() => fetchAll()) // tải lại cả effective status — bật/tắt model đổi health các route
      .catch((e: Error) => toast.error(e.message))
      .finally(() => { setBusy(false); setDisablingModel(null); });
  };

  /** Tắt model đang được routing dùng → xác nhận kèm số nghiệp vụ ảnh hưởng; còn lại tắt thẳng. */
  const toggleModel = (m: AiModelInfo) => {
    if (m.enabled && (m.usedByTaskCodes?.length ?? 0) > 0) {
      setDisablingModel(m);
      return;
    }
    setModelEnabled(m, !m.enabled);
  };

  const confirmDeleteModel = () => {
    if (!deletingModel) return;
    setBusy(true);
    deleteAiModel(deletingModel.id)
      .then(() => { toast.success(t.aiModelDeleted); fetchAll(); })
      .catch((e: Error) => toast.error(e.message)) // vd mã 2015: model đang được routing dùng
      .finally(() => { setBusy(false); setDeletingModel(null); });
  };

  const openEditRoute = (r: AiRoutingInfo) => {
    setEditingRoute(r);
    setRPrimary(r.primaryModelId);
    setRFallbacks(chainOf(r));
    setRTemp(r.temperature != null ? String(r.temperature) : '');
    setRMaxTokens(r.maxTokens != null ? String(r.maxTokens) : '');
    setREnabled(r.enabled);
    setModalError(null);
  };

  const saveRoute = () => {
    if (!editingRoute) return;
    setBusy(true);
    setModalError(null);
    updateAiRouting(editingRoute.id, {
      primaryModelId: rPrimary,
      fallbackModelIds: rFallbacks,
      temperature: numOrNull(rTemp),
      maxTokens: numOrNull(rMaxTokens),
      enabled: rEnabled,
    })
      .then(() => { setEditingRoute(null); toast.success(t.aiRoutingSaved); fetchAll(); })
      .catch((e: Error) => setModalError(e.message))
      .finally(() => setBusy(false));
  };

  // ===== Chỉnh nhanh định tuyến =====
  const enterRouteEdit = () => {
    setDraft(Object.fromEntries(routing.map((r) => [r.id, toDraft(r)])));
    setSelected(new Set());
    setFailedRoutes(new Set());
    setBulkPrimary('');
    setBulkFallback('');
    setRouteEdit(true);
  };
  const cancelRouteEdit = () => {
    setRouteEdit(false);
    setDraft({});
    setSelected(new Set());
    setFailedRoutes(new Set());
  };
  const patchDraft = (id: string, patch: Partial<RouteDraft>) =>
    setDraft((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  const toggleSelect = (id: string) =>
    setSelected((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  /** Bulk: đặt model chính cho các hàng đã chọn; model đó bị bỏ khỏi chuỗi dự phòng của hàng. */
  const applyBulkPrimary = () => {
    if (!bulkPrimary) return;
    setDraft((prev) => {
      const next = { ...prev };
      selected.forEach((id) => {
        const d = next[id]; if (!d) return;
        next[id] = { ...d, primaryModelId: bulkPrimary, fallbackModelIds: d.fallbackModelIds.filter((x) => x !== bulkPrimary) };
      });
      return next;
    });
  };
  /** Bulk: thay CẢ chuỗi dự phòng bằng một model ('' = Không dùng); bỏ qua hàng có model chính trùng. */
  const applyBulkFallback = () => {
    setDraft((prev) => {
      const next = { ...prev };
      selected.forEach((id) => {
        const d = next[id]; if (!d) return;
        if (bulkFallback && d.primaryModelId === bulkFallback) return;
        next[id] = { ...d, fallbackModelIds: bulkFallback ? [bulkFallback] : [] };
      });
      return next;
    });
  };

  /** "Lưu tất cả": PUT tuần tự các hàng đã đổi (N audit), hàng lỗi không chặn hàng khác. */
  const saveAllRoutes = async () => {
    const dirty = routing.filter((r) => draft[r.id] && routeDirty(r, draft[r.id]));
    if (dirty.length === 0) { toast.info(t.aiNoRouteChanges); return; }
    setSavingRoutes(true);
    const results = await Promise.allSettled(
      dirty.map((r) => {
        const d = draft[r.id];
        return updateAiRouting(r.id, {
          primaryModelId: d.primaryModelId,
          fallbackModelIds: d.fallbackModelIds,
          temperature: numOrNull(d.temp),
          maxTokens: numOrNull(d.maxTokens),
          enabled: d.enabled,
        });
      }),
    );
    const okRows: AiRoutingInfo[] = [];
    const failedIds: string[] = [];
    results.forEach((res, i) => {
      if (res.status === 'fulfilled') okRows.push(res.value);
      else failedIds.push(dirty[i].id);
    });
    if (okRows.length) {
      setRouting((prev) => prev.map((r) => okRows.find((o) => o.id === r.id) ?? r));
      setDraft((prev) => { const n = { ...prev }; okRows.forEach((o) => { n[o.id] = toDraft(o); }); return n; });
      getAiStatus().then(setStatus).catch(() => {}); // health đổi theo route vừa lưu
    }
    setFailedRoutes(new Set(failedIds));
    setSavingRoutes(false);
    if (failedIds.length === 0) {
      toast.success(t.aiRoutingSavedN.replace('{n}', String(okRows.length)));
      cancelRouteEdit();
    } else {
      if (okRows.length) toast.success(t.aiRoutingSavedN.replace('{n}', String(okRows.length)));
      toast.error(t.aiRoutingSaveFailN.replace('{n}', String(failedIds.length)));
    }
  };

  if (load === 'loading') {
    return <PageContainer><Card><Loader label={t.listLoading} /></Card></PageContainer>;
  }
  if (load === 'error') {
    return (
      <PageContainer>
        <Card style={{ textAlign: 'center', padding: '54px 16px' }}>
          <div style={{ fontSize: 14.5, fontWeight: 600, color: C.ink550, marginBottom: 14 }}>{t.listError}</div>
          <button onClick={fetchAll} style={{ border: 'none', borderRadius: 10, padding: '9px 18px', fontWeight: 700, fontSize: 13, color: C.onBrand, background: brandGradient, cursor: 'pointer' }}>{t.retry}</button>
        </Card>
      </PageContainer>
    );
  }

  const enabledModels = models.filter((m) => m.enabled);
  const fmtPrice = (v: number | null) => (v == null ? '—' : `$${v}`);

  // Tìm kiếm + phân trang client — chỉ áp khi bảng vượt ngưỡng MODELS_PAGE_SIZE
  const norm = q.trim().toLowerCase();
  const filteredModels = models.filter((m) => !norm
    || m.modelCode.toLowerCase().includes(norm)
    || (m.displayName ?? '').toLowerCase().includes(norm)
    || m.providerCode.toLowerCase().includes(norm));
  const showModelControls = models.length > MODELS_PAGE_SIZE;
  const modelPageCount = Math.max(1, Math.ceil(filteredModels.length / MODELS_PAGE_SIZE));
  const pagedModels = showModelControls
    ? filteredModels.slice((mPage - 1) * MODELS_PAGE_SIZE, mPage * MODELS_PAGE_SIZE)
    : filteredModels;

  // Trần max tokens cho modal routing: min giữa trần model chính & cả chuỗi dự phòng (nếu khai)
  const capOf = (id: string) => models.find((m) => m.id === id)?.maxTokens;
  const rCaps = [rPrimary, ...rFallbacks].map(capOf).filter((v): v is number => v != null);
  const rCap = rCaps.length ? Math.min(...rCaps) : null;
  const rMaxTokensNum = numOrNull(rMaxTokens);
  const rCapExceeded = rCap != null && rMaxTokensNum != null && rMaxTokensNum > rCap;

  // ===== Chỉnh nhanh định tuyến: dữ liệu dẫn xuất =====
  const problemRouteIds = new Set(
    (status?.routes ?? []).filter((r) => r.health === 'DEGRADED' || r.health === 'ERROR').map((r) => r.routingId),
  );
  const problemCount = problemRouteIds.size;
  const visibleRouting = onlyProblems ? routing.filter((r) => problemRouteIds.has(r.id)) : routing;
  const dirtyCount = routeEdit ? routing.filter((r) => draft[r.id] && routeDirty(r, draft[r.id])).length : 0;
  const allVisibleSelected = visibleRouting.length > 0 && visibleRouting.every((r) => selected.has(r.id));
  const toggleSelectAll = () => setSelected((prev) => {
    const n = new Set(prev);
    if (allVisibleSelected) visibleRouting.forEach((r) => n.delete(r.id));
    else visibleRouting.forEach((r) => n.add(r.id));
    return n;
  });
  // Model chọn được cho dropdown = model đang bật; luôn kèm model hiện tại nếu nó đã bị tắt/xóa
  const routeModelOptions = (currentId: string): AiModelInfo[] => {
    if (currentId && !enabledModels.some((m) => m.id === currentId)) {
      const cur = models.find((m) => m.id === currentId);
      if (cur) return [cur, ...enabledModels];
    }
    return enabledModels;
  };
  // Trần max tokens một hàng nháp = min giữa trần model chính & cả chuỗi dự phòng (nếu khai)
  const rowCap = (d: RouteDraft): number | null => {
    const caps = [d.primaryModelId, ...d.fallbackModelIds].map(capOf).filter((v): v is number => v != null);
    return caps.length ? Math.min(...caps) : null;
  };

  return (
    <PageContainer>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 12.5, color: C.textMuted }}>{t.aiModelsHint}</div>
        <AiServiceStatusBadge />
      </div>

      {/* Banner tổng effective status (nguồn: GET /admin/ai/status) */}
      <AiStatusBanner status={status} />

      {/* ===== Danh sách model ===== */}
      <SectionCard
        flush
        title={t.aiModelsTitle}
        action={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {showModelControls && (
              <input
                value={q}
                onChange={(e) => { setQ(e.target.value); setMPage(1); }}
                placeholder={t.admSearchPh}
                style={{ border: `1px solid ${C.border}`, borderRadius: 9, padding: '7px 12px', fontSize: 12.5, color: C.ink750, outline: 'none', width: 180 }}
              />
            )}
            <button onClick={openCreateModel} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: 'none', borderRadius: 9, padding: '7px 14px', fontSize: 12.5, fontWeight: 700, color: C.onBrand, background: brandGradient, cursor: 'pointer' }}>
              <Plus size={14} strokeWidth={2.4} />{t.aiAddModel}
            </button>
          </div>
        }
      >
        <DataTable head={['Model', t.aiColProvider, t.aiPriceIn, t.aiPriceOut, t.colStatus, t.colAction]} minWidth={820}>
          {pagedModels.map((m) => (
            <tr key={m.id} style={{ borderTop: `1px solid ${C.surfaceMuted}` }}>
              <td style={tdStyle}>
                <div style={{ fontWeight: 700 }}>{m.displayName || m.modelCode}</div>
                {m.displayName && m.displayName !== m.modelCode && (
                  <div style={{ fontSize: 11.5, color: C.textFaint, fontFamily: 'monospace' }}>{m.modelCode}</div>
                )}
              </td>
              <td style={{ ...tdStyle, color: C.textSecondary }}>{m.providerCode}</td>
              <td style={tdStyle}>{fmtPrice(m.inputPricePer1m)}</td>
              <td style={tdStyle}>{fmtPrice(m.outputPricePer1m)}</td>
              <td style={tdStyle}><StatusBadge tone={m.enabled ? 'success' : 'neutral'} label={m.enabled ? t.aiEnabled : t.aiDisabled} /></td>
              <td style={tdStyle}>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button onClick={() => openEditModel(m)} style={btnOutline}>{t.aiEdit}</button>
                  <button onClick={() => toggleModel(m)} style={btnOutline}>{m.enabled ? t.aiDisable : t.aiEnable}</button>
                  <button onClick={() => setDeletingModel(m)} style={{ ...btnOutline, color: C.danger }}>{t.aiDelete}</button>
                </div>
              </td>
            </tr>
          ))}
        </DataTable>
        {showModelControls && modelPageCount > 1 && (
          <div style={{ padding: '0 16px 16px' }}>
            <Pagination page={mPage} pageCount={modelPageCount} onChange={setMPage} />
          </div>
        )}
      </SectionCard>

      {/* ===== Định tuyến theo nghiệp vụ ===== */}
      <SectionCard
        flush
        title={t.aiRoutingTitle}
        action={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <button
              onClick={() => setOnlyProblems((v) => !v)}
              style={{ ...btnOutline, ...(onlyProblems ? { background: C.legacyBgfdecec, borderColor: C.legacyBorderf6c6c6, color: C.danger } : {}) }}
            >
              {t.aiOnlyProblems}{problemCount > 0 ? ` (${problemCount})` : ''}
            </button>
            {!routeEdit && (
              <button onClick={enterRouteEdit} style={{ ...btnOutline, borderColor: C.legacyBorderd9cef7, color: C.primary }}>
                {t.aiQuickEdit}
              </button>
            )}
          </div>
        }
      >
        <DataTable
          head={
            routeEdit
              ? [
                  <input key="all" type="checkbox" checked={allVisibleSelected} onChange={toggleSelectAll} style={{ cursor: 'pointer' }} />,
                  t.aiColTask, t.aiColPrimary, t.aiColFallback, 'Temperature', 'Max tokens', t.colStatus,
                ]
              : [t.aiColTask, t.aiColPrimary, t.aiColFallback, 'Temperature', 'Max tokens', t.colStatus, t.colAction]
          }
          minWidth={routeEdit ? 940 : 880}
        >
          {visibleRouting.map((r) => {
            const rs = statusByRouting.get(r.id);
            const d = draft[r.id];
            if (routeEdit && d) {
              const cap = rowCap(d);
              const mt = numOrNull(d.maxTokens);
              const capExceeded = cap != null && mt != null && mt > cap;
              return (
                <tr key={r.id} style={{ borderTop: `1px solid ${C.surfaceMuted}`, background: failedRoutes.has(r.id) ? C.legacyBgfef2f2 : undefined }}>
                  <td style={editCell}>
                    <input type="checkbox" checked={selected.has(r.id)} onChange={() => toggleSelect(r.id)} style={{ cursor: 'pointer' }} />
                  </td>
                  <td style={{ ...editCell, fontWeight: 700, fontSize: 13.5, color: C.ink750 }}>{aiTaskLabel(lang, r.taskCode)}</td>
                  <td style={editCell}>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <select
                        value={d.primaryModelId}
                        onChange={(e) => patchDraft(r.id, { primaryModelId: e.target.value, fallbackModelIds: d.fallbackModelIds.filter((x) => x !== e.target.value) })}
                        style={miniSelect}
                      >
                        {routeModelOptions(d.primaryModelId).map((m) => <option key={m.id} value={m.id}>{modelLabel(m)}</option>)}
                      </select>
                      <ModelBlockHint reason={rs?.primaryBlockReason ?? null} />
                    </div>
                  </td>
                  <td style={editCell}>
                    <FallbackChainEditor
                      compact
                      value={d.fallbackModelIds}
                      onChange={(ids) => patchDraft(r.id, { fallbackModelIds: ids })}
                      primaryId={d.primaryModelId}
                      models={models}
                      providers={providers}
                    />
                  </td>
                  <td style={editCell}>
                    <input type="number" min={0} max={2} step="0.1" value={d.temp} onChange={(e) => patchDraft(r.id, { temp: e.target.value })} placeholder={t.aiProviderDefault} style={miniInput} />
                  </td>
                  <td style={editCell}>
                    <input type="number" min={1} step="1" value={d.maxTokens} onChange={(e) => patchDraft(r.id, { maxTokens: e.target.value })} placeholder={t.aiProviderDefault} style={miniInput} />
                    {capExceeded && <div style={{ fontSize: 11, marginTop: 4, color: C.warning, fontWeight: 700 }}>{t.aiMaxTokensWarn}</div>}
                  </td>
                  <td style={editCell}>
                    <Switch checked={d.enabled} onChange={(v) => patchDraft(r.id, { enabled: v })} />
                  </td>
                </tr>
              );
            }
            return (
              <tr key={r.id} style={{ borderTop: `1px solid ${C.surfaceMuted}` }}>
                <td style={{ ...tdStyle, fontWeight: 700 }}>{aiTaskLabel(lang, r.taskCode)}</td>
                <td style={tdStyle}>
                  <div style={{ fontFamily: 'monospace', fontSize: 13 }}>
                    {r.primaryModelCode}
                    <ModelBlockHint reason={rs?.primaryBlockReason ?? null} />
                  </div>
                  <div style={{ fontSize: 11.5, color: C.textFaint }}>{r.primaryProviderCode}</div>
                </td>
                <td style={tdStyle}>
                  {chainOf(r).length > 0
                    ? (
                      <ol style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {chainOf(r).map((id, i) => {
                          const m = models.find((x) => x.id === id);
                          const reason = m ? modelBlockReason(m, providers) : 'MODEL_DELETED';
                          return (
                            <li key={id} style={{ fontFamily: 'monospace', fontSize: 13, opacity: reason ? 0.55 : 1 }}>
                              <span style={{ color: C.textFaint, fontSize: 11.5 }}>{i + 1}. </span>
                              {m?.modelCode ?? r.fallbacks?.[i]?.modelCode ?? id}
                              <span style={{ fontSize: 11.5, color: C.textFaint }}> · {m?.providerCode ?? r.fallbacks?.[i]?.providerCode}</span>
                              <ModelBlockHint reason={reason} />
                            </li>
                          );
                        })}
                      </ol>
                    )
                    : <span style={{ color: C.textFaint }}>{t.aiNoFallback}</span>}
                </td>
                <td style={tdStyle}>{r.temperature ?? '—'}</td>
                <td style={tdStyle}>{r.maxTokens ?? '—'}</td>
                <td style={tdStyle}><RouteHealthBadge health={rs?.health ?? null} enabled={r.enabled} /></td>
                <td style={tdStyle}><button onClick={() => openEditRoute(r)} style={btnOutline}>{t.aiEdit}</button></td>
              </tr>
            );
          })}
        </DataTable>

        {/* Thanh bulk-apply (chỉ khi đang chỉnh nhanh & có hàng được chọn) */}
        {routeEdit && selected.size > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10, padding: '12px 16px', borderTop: `1px solid ${C.surfaceMuted}`, background: C.surfaceSubtle }}>
            <span style={{ fontSize: 12.5, fontWeight: 700, color: C.ink550 }}>{t.aiSelectedN.replace('{n}', String(selected.size))}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <select value={bulkPrimary} onChange={(e) => setBulkPrimary(e.target.value)} style={{ ...miniSelect, minWidth: 170 }}>
                <option value="">{t.aiBulkChoose}</option>
                {enabledModels.map((m) => <option key={m.id} value={m.id}>{modelLabel(m)}</option>)}
              </select>
              <button onClick={applyBulkPrimary} disabled={!bulkPrimary} style={{ ...btnOutline, opacity: bulkPrimary ? 1 : 0.5 }}>{t.aiBulkSetPrimary}</button>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <select value={bulkFallback} onChange={(e) => setBulkFallback(e.target.value)} style={{ ...miniSelect, minWidth: 170 }}>
                <option value="">{t.aiNoFallback}</option>
                {enabledModels.map((m) => <option key={m.id} value={m.id}>{modelLabel(m)}</option>)}
              </select>
              <button onClick={applyBulkFallback} style={btnOutline}>{t.aiBulkSetFallback}</button>
            </div>
          </div>
        )}

        {/* Lưu tất cả / Huỷ (cuối bảng) */}
        {routeEdit && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 10, padding: '12px 16px', borderTop: `1px solid ${C.surfaceMuted}` }}>
            <button onClick={cancelRouteEdit} disabled={savingRoutes} style={{ ...btnOutline, padding: '8px 16px' }}>{t.cancel}</button>
            <button
              onClick={saveAllRoutes}
              disabled={savingRoutes || dirtyCount === 0}
              style={{ border: 'none', background: brandGradient, borderRadius: 9, padding: '8px 18px', fontSize: 12.5, fontWeight: 700, color: C.onBrand, cursor: savingRoutes ? 'wait' : 'pointer', opacity: savingRoutes || dirtyCount === 0 ? 0.6 : 1 }}
            >
              {savingRoutes ? t.processing : `${t.aiSaveAll}${dirtyCount > 0 ? ` (${dirtyCount})` : ''}`}
            </button>
          </div>
        )}
      </SectionCard>

      {/* ===== Modal thêm/sửa model ===== */}
      {showModelModal && (
        <Modal title={editingModel ? `${t.aiEdit} · ${editingModel.modelCode}` : t.aiAddModel} maxWidth={460} onClose={() => setShowModelModal(false)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {modalError && (
              <div style={{ padding: '10px 14px', borderRadius: 8, background: C.dangerSoft2, color: C.danger, fontSize: 13, fontWeight: 600 }}>{modalError}</div>
            )}
            {!editingModel && (
              <>
                <div>
                  <label style={labelStyle}>{t.aiColProvider}</label>
                  <select
                    value={mProviderId}
                    onChange={(e) => { setMProviderId(e.target.value); setMCatalogPick(''); }}
                    style={{ ...inputStyle, cursor: 'pointer' }}
                  >
                    {providers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                {/* Gợi ý từ catalog đã đồng bộ (loại model đã thêm); không có catalog → nhập tay */}
                {availableCatalog.length > 0 && (
                  <div>
                    <label style={labelStyle}>{t.aiCatalogPick}</label>
                    <select value={mCatalogPick} onChange={(e) => pickFromCatalog(e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
                      <option value="">{t.aiCatalogManual}</option>
                      {availableCatalog.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.id}{c.displayName && c.displayName !== c.id ? ` · ${c.displayName}` : ''}
                        </option>
                      ))}
                    </select>
                    <div style={{ fontSize: 12, color: C.textMuted, marginTop: 6 }}>
                      {t.aiSyncedAt}: {createProvider?.modelCatalogSyncedAt ? fmtAiDateTime(createProvider.modelCatalogSyncedAt) : t.aiNeverSynced}
                    </div>
                  </div>
                )}
                <div>
                  <label style={labelStyle}>Model ID</label>
                  <input value={mCode} onChange={(e) => setMCode(e.target.value)} placeholder="claude-sonnet-4-6" style={{ ...inputStyle, fontFamily: 'monospace' }} />
                </div>
              </>
            )}
            <div>
              <label style={labelStyle}>{t.aiNameLabel}</label>
              <input value={mName} onChange={(e) => setMName(e.target.value)} style={inputStyle} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={labelStyle}>{t.aiPriceIn}</label>
                <input type="number" min={0} step="0.01" value={mPriceIn} onChange={(e) => setMPriceIn(e.target.value)} placeholder="—" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>{t.aiPriceOut}</label>
                <input type="number" min={0} step="0.01" value={mPriceOut} onChange={(e) => setMPriceOut(e.target.value)} placeholder="—" style={inputStyle} />
              </div>
            </div>
            <div>
              <label style={labelStyle}>{t.aiModelMaxTokens}</label>
              <input type="number" min={1} step="1" value={mMaxTokens} onChange={(e) => setMMaxTokens(e.target.value)} placeholder="—" style={inputStyle} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 4 }}>
              <button onClick={() => setShowModelModal(false)} style={{ ...btnOutline, padding: '9px 18px', fontSize: 13 }}>{t.cancel}</button>
              <button
                onClick={saveModel}
                disabled={busy || (!editingModel && (!mCode.trim() || !mProviderId))}
                style={{ border: 'none', background: brandGradient, borderRadius: 10, padding: '9px 20px', fontSize: 13, fontWeight: 700, color: C.onBrand, cursor: busy ? 'wait' : 'pointer', opacity: busy || (!editingModel && !mCode.trim()) ? 0.6 : 1 }}
              >
                {busy ? t.processing : t.aiSave}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ===== Modal sửa định tuyến ===== */}
      {editingRoute && (
        <Modal title={`${t.aiRoutingTitle} · ${aiTaskLabel(lang, editingRoute.taskCode)}`} maxWidth={520} onClose={() => setEditingRoute(null)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {modalError && (
              <div style={{ padding: '10px 14px', borderRadius: 8, background: C.dangerSoft2, color: C.danger, fontSize: 13, fontWeight: 600 }}>{modalError}</div>
            )}
            <div>
              <label style={labelStyle}>{t.aiColPrimary}</label>
              <select value={rPrimary} onChange={(e) => { setRPrimary(e.target.value); setRFallbacks((prev) => prev.filter((x) => x !== e.target.value)); }} style={{ ...inputStyle, cursor: 'pointer' }}>
                {enabledModels.map((m) => <option key={m.id} value={m.id}>{modelLabel(m)}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>{t.aiColFallback}</label>
              <FallbackChainEditor value={rFallbacks} onChange={setRFallbacks} primaryId={rPrimary} models={models} providers={providers} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={labelStyle}>Temperature (0–2)</label>
                <input type="number" min={0} max={2} step="0.1" value={rTemp} onChange={(e) => setRTemp(e.target.value)} placeholder={t.aiProviderDefault} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Max tokens</label>
                <input type="number" min={1} step="1" value={rMaxTokens} onChange={(e) => setRMaxTokens(e.target.value)} placeholder={t.aiProviderDefault} style={inputStyle} />
                {/* Gợi ý trần model (min giữa chính & dự phòng) + cảnh báo mềm khi vượt — không chặn lưu */}
                {rCap != null && (
                  <div style={{ fontSize: 12, marginTop: 6, color: rCapExceeded ? C.warning : C.textMuted, fontWeight: rCapExceeded ? 700 : 400 }}>
                    {rCapExceeded ? t.aiMaxTokensWarn : `${t.aiMaxTokensCap}: ≤ ${rCap.toLocaleString('en-US')}`}
                  </div>
                )}
              </div>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5, fontWeight: 600, color: C.text, cursor: 'pointer' }}>
              <input type="checkbox" checked={rEnabled} onChange={(e) => setREnabled(e.target.checked)} />
              {t.aiRoutingEnabled}
            </label>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 4 }}>
              <button onClick={() => setEditingRoute(null)} style={{ ...btnOutline, padding: '9px 18px', fontSize: 13 }}>{t.cancel}</button>
              <button
                onClick={saveRoute}
                disabled={busy || !rPrimary}
                style={{ border: 'none', background: brandGradient, borderRadius: 10, padding: '9px 20px', fontSize: 13, fontWeight: 700, color: C.onBrand, cursor: busy ? 'wait' : 'pointer', opacity: busy ? 0.6 : 1 }}
              >
                {busy ? t.processing : t.aiSave}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ===== Xác nhận xóa model (BE vẫn chặn khi đang được routing dùng — mã 2015) ===== */}
      {deletingModel && (
        <ConfirmModal
          title={`${t.aiDelete} · ${deletingModel.modelCode}`}
          message={t.aiDeleteModelMsg}
          confirmLabel={t.aiDelete}
          busy={busy}
          onConfirm={confirmDeleteModel}
          onClose={() => setDeletingModel(null)}
        >
          {(deletingModel.usedByTaskCodes?.length ?? 0) > 0 && (
            <InUseNote taskCodes={deletingModel.usedByTaskCodes!} />
          )}
        </ConfirmModal>
      )}

      {/* ===== Xác nhận TẮT model đang được định tuyến dùng ===== */}
      {disablingModel && (
        <ConfirmModal
          variant="warning"
          title={`${t.aiDisable} · ${disablingModel.modelCode}`}
          message={t.aiDisableModelConfirm}
          confirmLabel={t.aiDisable}
          busy={busy}
          onConfirm={() => setModelEnabled(disablingModel, false)}
          onClose={() => setDisablingModel(null)}
        >
          <InUseNote taskCodes={disablingModel.usedByTaskCodes ?? []} />
        </ConfirmModal>
      )}
    </PageContainer>
  );
}

/** Dòng "Đang dùng ở N nghiệp vụ: …" trong dialog xác nhận tắt/xóa model. */
function InUseNote({ taskCodes }: { taskCodes: string[] }) {
  const { t, lang } = useApp();
  if (taskCodes.length === 0) return null;
  return (
    <div style={{ padding: '10px 14px', borderRadius: 8, background: C.warningSoft, color: C.amberText, fontSize: 13, fontWeight: 600, marginBottom: 12 }}>
      {t.aiModelInUse.replace('{n}', String(taskCodes.length))}
      {': '}
      {taskCodes.map((c) => aiTaskLabel(lang, c as Parameters<typeof aiTaskLabel>[1])).join(', ')}
    </div>
  );
}
