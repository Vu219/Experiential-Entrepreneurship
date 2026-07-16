import { useEffect, useState, type CSSProperties } from 'react';
import { Plus } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Loader, Card } from '../../components/ui';
import Modal from '../../components/Modal';
import ConfirmModal from '../../components/ConfirmModal';
import StatusBadge from '../../components/admin/StatusBadge';
import SectionCard from '../../components/admin/SectionCard';
import AiServiceStatusBadge from '../../components/admin/AiServiceStatusBadge';
import { DataTable } from '../../components/admin/AdminListPage';
import { useToast } from '../../components/toast/ToastProvider';
import {
  aiTaskLabel,
  createAiModel,
  deleteAiModel,
  listAiModels,
  listAiProviders,
  listAiRouting,
  updateAiModel,
  updateAiRouting,
  type AiModelInfo,
  type AiProviderInfo,
  type AiRoutingInfo,
} from '../../api/adminAi';

const btnOutline: CSSProperties = {
  border: '1px solid #ece8f6', background: '#fff', borderRadius: 9, padding: '6px 12px',
  fontSize: 12.5, fontWeight: 700, color: '#5b5670', cursor: 'pointer',
};

const inputStyle: CSSProperties = {
  width: '100%', border: '1.5px solid #ece8f6', borderRadius: 10, padding: '10px 14px',
  fontSize: 14, color: '#2b2543', outline: 'none',
};

const labelStyle: CSSProperties = { display: 'block', fontSize: 12.5, fontWeight: 700, color: '#3f3a55', marginBottom: 6 };

const tdStyle: CSSProperties = { padding: '13px 16px', fontSize: 13.5, color: '#2b2543' };

/** Input số nullable: chuỗi rỗng ↔ null (temperature/max tokens/đơn giá). */
const numOrNull = (s: string): number | null => (s.trim() === '' ? null : Number(s));

export default function AiModels() {
  const { t, lang, brandGradient } = useApp();
  const toast = useToast();
  const [load, setLoad] = useState<'loading' | 'error' | 'ok'>('loading');
  const [models, setModels] = useState<AiModelInfo[]>([]);
  const [providers, setProviders] = useState<AiProviderInfo[]>([]);
  const [routing, setRouting] = useState<AiRoutingInfo[]>([]);
  const [busy, setBusy] = useState(false);

  // Modal model (tạo mới khi editingModel == null && showModelModal)
  const [showModelModal, setShowModelModal] = useState(false);
  const [editingModel, setEditingModel] = useState<AiModelInfo | null>(null);
  const [mProviderId, setMProviderId] = useState('');
  const [mCode, setMCode] = useState('');
  const [mName, setMName] = useState('');
  const [mPriceIn, setMPriceIn] = useState('');
  const [mPriceOut, setMPriceOut] = useState('');
  const [modalError, setModalError] = useState<string | null>(null);

  const [deletingModel, setDeletingModel] = useState<AiModelInfo | null>(null);

  // Modal routing
  const [editingRoute, setEditingRoute] = useState<AiRoutingInfo | null>(null);
  const [rPrimary, setRPrimary] = useState('');
  const [rFallback, setRFallback] = useState('');
  const [rTemp, setRTemp] = useState('');
  const [rMaxTokens, setRMaxTokens] = useState('');
  const [rEnabled, setREnabled] = useState(true);

  const fetchAll = () => {
    setLoad('loading');
    Promise.all([listAiModels(), listAiProviders(), listAiRouting()])
      .then(([m, p, r]) => { setModels(m); setProviders(p); setRouting(r); setLoad('ok'); })
      .catch(() => setLoad('error'));
  };
  useEffect(fetchAll, []);

  const modelLabel = (m: AiModelInfo) => `${m.modelCode} · ${m.providerCode}`;

  const openCreateModel = () => {
    setEditingModel(null);
    setMProviderId(providers[0]?.id ?? '');
    setMCode('');
    setMName('');
    setMPriceIn('');
    setMPriceOut('');
    setModalError(null);
    setShowModelModal(true);
  };

  const openEditModel = (m: AiModelInfo) => {
    setEditingModel(m);
    setMName(m.displayName ?? '');
    setMPriceIn(m.inputPricePer1m != null ? String(m.inputPricePer1m) : '');
    setMPriceOut(m.outputPricePer1m != null ? String(m.outputPricePer1m) : '');
    setModalError(null);
    setShowModelModal(true);
  };

  const saveModel = () => {
    setBusy(true);
    setModalError(null);
    const req = editingModel
      ? updateAiModel(editingModel.id, {
          displayName: mName.trim() || undefined,
          inputPricePer1m: numOrNull(mPriceIn),
          outputPricePer1m: numOrNull(mPriceOut),
        })
      : createAiModel({
          providerId: mProviderId,
          modelCode: mCode.trim(),
          displayName: mName.trim() || undefined,
          inputPricePer1m: numOrNull(mPriceIn),
          outputPricePer1m: numOrNull(mPriceOut),
        });
    req
      .then(() => { setShowModelModal(false); toast.success(t.aiModelSaved); fetchAll(); })
      .catch((e: Error) => setModalError(e.message))
      .finally(() => setBusy(false));
  };

  const toggleModel = (m: AiModelInfo) => {
    updateAiModel(m.id, { enabled: !m.enabled })
      .then((u) => setModels((prev) => prev.map((x) => (x.id === u.id ? u : x))))
      .catch((e: Error) => toast.error(e.message));
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
    setRFallback(r.fallbackModelId ?? '');
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
      fallbackModelId: rFallback || null,
      temperature: numOrNull(rTemp),
      maxTokens: numOrNull(rMaxTokens),
      enabled: rEnabled,
    })
      .then(() => { setEditingRoute(null); toast.success(t.aiRoutingSaved); fetchAll(); })
      .catch((e: Error) => setModalError(e.message))
      .finally(() => setBusy(false));
  };

  if (load === 'loading') {
    return <div className="view-pop" style={{ maxWidth: 1180, margin: '0 auto' }}><Card><Loader label={t.listLoading} /></Card></div>;
  }
  if (load === 'error') {
    return (
      <div className="view-pop" style={{ maxWidth: 1180, margin: '0 auto' }}>
        <Card style={{ textAlign: 'center', padding: '54px 16px' }}>
          <div style={{ fontSize: 14.5, fontWeight: 600, color: '#5b5670', marginBottom: 14 }}>{t.listError}</div>
          <button onClick={fetchAll} style={{ border: 'none', borderRadius: 10, padding: '9px 18px', fontWeight: 700, fontSize: 13, color: '#fff', background: brandGradient, cursor: 'pointer' }}>{t.retry}</button>
        </Card>
      </div>
    );
  }

  const enabledModels = models.filter((m) => m.enabled);
  const fmtPrice = (v: number | null) => (v == null ? '—' : `$${v}`);

  return (
    <div className="view-pop" style={{ maxWidth: 1180, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 12.5, color: '#8a85a0' }}>{t.aiModelsHint}</div>
        <AiServiceStatusBadge />
      </div>

      {/* ===== Danh sách model ===== */}
      <SectionCard
        flush
        title={t.aiModelsTitle}
        action={
          <button onClick={openCreateModel} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: 'none', borderRadius: 9, padding: '7px 14px', fontSize: 12.5, fontWeight: 700, color: '#fff', background: brandGradient, cursor: 'pointer' }}>
            <Plus size={14} strokeWidth={2.4} />{t.aiAddModel}
          </button>
        }
      >
        <DataTable head={['Model', t.aiColProvider, t.aiPriceIn, t.aiPriceOut, t.colStatus, t.colAction]} minWidth={820}>
          {models.map((m) => (
            <tr key={m.id} style={{ borderTop: '1px solid #f1eef8' }}>
              <td style={tdStyle}>
                <div style={{ fontWeight: 700 }}>{m.displayName || m.modelCode}</div>
                {m.displayName && m.displayName !== m.modelCode && (
                  <div style={{ fontSize: 11.5, color: '#a59fbb', fontFamily: 'monospace' }}>{m.modelCode}</div>
                )}
              </td>
              <td style={{ ...tdStyle, color: '#6b6680' }}>{m.providerCode}</td>
              <td style={tdStyle}>{fmtPrice(m.inputPricePer1m)}</td>
              <td style={tdStyle}>{fmtPrice(m.outputPricePer1m)}</td>
              <td style={tdStyle}><StatusBadge tone={m.enabled ? 'success' : 'neutral'} label={m.enabled ? t.aiEnabled : t.aiDisabled} /></td>
              <td style={tdStyle}>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button onClick={() => openEditModel(m)} style={btnOutline}>{t.aiEdit}</button>
                  <button onClick={() => toggleModel(m)} style={btnOutline}>{m.enabled ? t.aiDisable : t.aiEnable}</button>
                  <button onClick={() => setDeletingModel(m)} style={{ ...btnOutline, color: '#dc2626' }}>{t.aiDelete}</button>
                </div>
              </td>
            </tr>
          ))}
        </DataTable>
      </SectionCard>

      {/* ===== Định tuyến theo nghiệp vụ ===== */}
      <SectionCard flush title={t.aiRoutingTitle}>
        <DataTable head={[t.aiColTask, t.aiColPrimary, t.aiColFallback, 'Temperature', 'Max tokens', t.colStatus, t.colAction]} minWidth={880}>
          {routing.map((r) => (
            <tr key={r.id} style={{ borderTop: '1px solid #f1eef8' }}>
              <td style={{ ...tdStyle, fontWeight: 700 }}>{aiTaskLabel(lang, r.taskCode)}</td>
              <td style={tdStyle}>
                <div style={{ fontFamily: 'monospace', fontSize: 13 }}>{r.primaryModelCode}</div>
                <div style={{ fontSize: 11.5, color: '#a59fbb' }}>{r.primaryProviderCode}</div>
              </td>
              <td style={tdStyle}>
                {r.fallbackModelCode
                  ? (
                    <>
                      <div style={{ fontFamily: 'monospace', fontSize: 13 }}>{r.fallbackModelCode}</div>
                      <div style={{ fontSize: 11.5, color: '#a59fbb' }}>{r.fallbackProviderCode}</div>
                    </>
                  )
                  : <span style={{ color: '#a59fbb' }}>{t.aiNoFallback}</span>}
              </td>
              <td style={tdStyle}>{r.temperature ?? '—'}</td>
              <td style={tdStyle}>{r.maxTokens ?? '—'}</td>
              <td style={tdStyle}><StatusBadge tone={r.enabled ? 'success' : 'neutral'} label={r.enabled ? t.aiEnabled : t.aiDisabled} /></td>
              <td style={tdStyle}><button onClick={() => openEditRoute(r)} style={btnOutline}>{t.aiEdit}</button></td>
            </tr>
          ))}
        </DataTable>
      </SectionCard>

      {/* ===== Modal thêm/sửa model ===== */}
      {showModelModal && (
        <Modal title={editingModel ? `${t.aiEdit} · ${editingModel.modelCode}` : t.aiAddModel} maxWidth={460} onClose={() => setShowModelModal(false)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {modalError && (
              <div style={{ padding: '10px 14px', borderRadius: 8, background: '#fee2e2', color: '#dc2626', fontSize: 13, fontWeight: 600 }}>{modalError}</div>
            )}
            {!editingModel && (
              <>
                <div>
                  <label style={labelStyle}>{t.aiColProvider}</label>
                  <select value={mProviderId} onChange={(e) => setMProviderId(e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
                    {providers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
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
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 4 }}>
              <button onClick={() => setShowModelModal(false)} style={{ ...btnOutline, padding: '9px 18px', fontSize: 13 }}>{t.cancel}</button>
              <button
                onClick={saveModel}
                disabled={busy || (!editingModel && (!mCode.trim() || !mProviderId))}
                style={{ border: 'none', background: brandGradient, borderRadius: 10, padding: '9px 20px', fontSize: 13, fontWeight: 700, color: '#fff', cursor: busy ? 'wait' : 'pointer', opacity: busy || (!editingModel && !mCode.trim()) ? 0.6 : 1 }}
              >
                {busy ? t.processing : t.aiSave}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ===== Modal sửa định tuyến ===== */}
      {editingRoute && (
        <Modal title={`${t.aiRoutingTitle} · ${aiTaskLabel(lang, editingRoute.taskCode)}`} maxWidth={460} onClose={() => setEditingRoute(null)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {modalError && (
              <div style={{ padding: '10px 14px', borderRadius: 8, background: '#fee2e2', color: '#dc2626', fontSize: 13, fontWeight: 600 }}>{modalError}</div>
            )}
            <div>
              <label style={labelStyle}>{t.aiColPrimary}</label>
              <select value={rPrimary} onChange={(e) => setRPrimary(e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
                {enabledModels.map((m) => <option key={m.id} value={m.id}>{modelLabel(m)}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>{t.aiColFallback}</label>
              <select value={rFallback} onChange={(e) => setRFallback(e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
                <option value="">{t.aiNoFallback}</option>
                {enabledModels.filter((m) => m.id !== rPrimary).map((m) => <option key={m.id} value={m.id}>{modelLabel(m)}</option>)}
              </select>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={labelStyle}>Temperature (0–2)</label>
                <input type="number" min={0} max={2} step="0.1" value={rTemp} onChange={(e) => setRTemp(e.target.value)} placeholder={t.aiProviderDefault} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Max tokens</label>
                <input type="number" min={1} step="1" value={rMaxTokens} onChange={(e) => setRMaxTokens(e.target.value)} placeholder={t.aiProviderDefault} style={inputStyle} />
              </div>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5, fontWeight: 600, color: '#3f3a55', cursor: 'pointer' }}>
              <input type="checkbox" checked={rEnabled} onChange={(e) => setREnabled(e.target.checked)} />
              {t.aiRoutingEnabled}
            </label>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 4 }}>
              <button onClick={() => setEditingRoute(null)} style={{ ...btnOutline, padding: '9px 18px', fontSize: 13 }}>{t.cancel}</button>
              <button
                onClick={saveRoute}
                disabled={busy || !rPrimary}
                style={{ border: 'none', background: brandGradient, borderRadius: 10, padding: '9px 20px', fontSize: 13, fontWeight: 700, color: '#fff', cursor: busy ? 'wait' : 'pointer', opacity: busy ? 0.6 : 1 }}
              >
                {busy ? t.processing : t.aiSave}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ===== Xác nhận xóa model ===== */}
      {deletingModel && (
        <ConfirmModal
          title={`${t.aiDelete} · ${deletingModel.modelCode}`}
          message={t.aiDeleteModelMsg}
          confirmLabel={t.aiDelete}
          busy={busy}
          onConfirm={confirmDeleteModel}
          onClose={() => setDeletingModel(null)}
        />
      )}
    </div>
  );
}
