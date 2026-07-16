import { useEffect, useState, type CSSProperties } from 'react';
import { KeyRound, PlugZap, Power } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Icon } from '../../components/ui';
import Modal from '../../components/Modal';
import ConfirmModal from '../../components/ConfirmModal';
import StatusBadge from '../../components/admin/StatusBadge';
import AiServiceStatusBadge from '../../components/admin/AiServiceStatusBadge';
import AdminListPage, { DataTable, type ListState } from '../../components/admin/AdminListPage';
import { useToast } from '../../components/toast/ToastProvider';
import {
  listAiProviders,
  testAiProvider,
  updateAiProvider,
  fmtAiDateTime,
  type AiProviderInfo,
} from '../../api/adminAi';

const btnOutline: CSSProperties = {
  border: '1px solid #ece8f6', background: '#fff', borderRadius: 9, padding: '6px 12px',
  fontSize: 12.5, fontWeight: 700, color: '#5b5670', cursor: 'pointer',
  display: 'inline-flex', alignItems: 'center', gap: 6,
};

const inputStyle: CSSProperties = {
  width: '100%', border: '1.5px solid #ece8f6', borderRadius: 10, padding: '10px 14px',
  fontSize: 14, color: '#2b2543', outline: 'none',
};

const labelStyle: CSSProperties = { display: 'block', fontSize: 12.5, fontWeight: 700, color: '#3f3a55', marginBottom: 6 };

export default function AiProviders() {
  const { t, brandGradient } = useApp();
  const toast = useToast();
  const [load, setLoad] = useState<'loading' | 'error' | 'ok'>('loading');
  const [rows, setRows] = useState<AiProviderInfo[]>([]);
  const [testingId, setTestingId] = useState<string | null>(null);

  // Modal sửa key/tên
  const [editing, setEditing] = useState<AiProviderInfo | null>(null);
  const [nameInput, setNameInput] = useState('');
  const [keyInput, setKeyInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Xác nhận TẮT provider (routing đang trỏ vào sẽ rơi về cấu hình env)
  const [disabling, setDisabling] = useState<AiProviderInfo | null>(null);
  const [busy, setBusy] = useState(false);

  const fetchProviders = () => {
    setLoad('loading');
    listAiProviders()
      .then((r) => { setRows(r); setLoad('ok'); })
      .catch(() => setLoad('error'));
  };
  useEffect(fetchProviders, []);

  const state: ListState = load === 'loading' ? 'loading' : load === 'error' ? 'error' : rows.length === 0 ? 'empty' : 'ready';

  const replaceRow = (p: AiProviderInfo) => setRows((prev) => prev.map((x) => (x.id === p.id ? p : x)));

  const openEdit = (p: AiProviderInfo) => {
    setEditing(p);
    setNameInput(p.name);
    setKeyInput('');
    setEditError(null);
  };

  const saveEdit = () => {
    if (!editing) return;
    setSaving(true);
    setEditError(null);
    updateAiProvider(editing.id, {
      name: nameInput.trim() || undefined,
      apiKey: keyInput.trim() || undefined, // trống = giữ key hiện tại (write-only)
    })
      .then((p) => {
        replaceRow(p);
        setEditing(null);
        toast.success(t.aiProviderSaved);
      })
      .catch((e: Error) => setEditError(e.message))
      .finally(() => setSaving(false));
  };

  const runTest = (p: AiProviderInfo) => {
    setTestingId(p.id);
    testAiProvider(p.id)
      .then((r) => {
        if (r.status === 'SUCCESS') {
          toast.success(`${t.aiTestOk}${r.latencyMs != null ? ` · ${r.latencyMs}ms` : ''}`);
        } else {
          toast.error(r.message || t.aiTestFail, { title: t.aiTestFail });
        }
        fetchProviders(); // cập nhật lastTestedAt/lastTestStatus
      })
      .catch((e: Error) => toast.error(e.message))
      .finally(() => setTestingId(null));
  };

  const setEnabled = (p: AiProviderInfo, enabled: boolean) => {
    setBusy(true);
    updateAiProvider(p.id, { enabled })
      .then((updated) => {
        replaceRow(updated);
        toast.success(enabled ? t.aiProviderEnabled : t.aiProviderDisabled);
      })
      .catch((e: Error) => toast.error(e.message)) // vd mã 2017: bật khi chưa có key
      .finally(() => { setBusy(false); setDisabling(null); });
  };

  const testMeta = (p: AiProviderInfo) =>
    p.lastTestStatus === 'SUCCESS' ? { tone: 'success' as const, label: t.aiTestOk }
    : p.lastTestStatus === 'FAILED' ? { tone: 'danger' as const, label: t.aiTestFail }
    : null;

  return (
    <div className="view-pop" style={{ maxWidth: 1180, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Ghi chú bảo mật + badge trạng thái AI service (link sang trang Trạng thái hệ thống) */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 12.5, color: '#8a85a0' }}>{t.aiProvidersHint}</div>
        <AiServiceStatusBadge />
      </div>

      <AdminListPage state={state} onRetry={fetchProviders}>
        <DataTable head={[t.aiColProvider, 'API key', t.colStatus, t.aiColLastTest, t.colAction]} minWidth={820}>
          {rows.map((p) => {
            const tm = testMeta(p);
            return (
              <tr key={p.id} style={{ borderTop: '1px solid #f1eef8' }}>
                <td style={{ padding: '13px 16px' }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: '#2b2543' }}>{p.name}</div>
                  <div style={{ fontSize: 11.5, color: '#a59fbb' }}>{p.code}</div>
                </td>
                <td style={{ padding: '13px 16px' }}>
                  {p.apiKeyMasked
                    ? <span style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 700, color: '#3f3a55' }}>{p.apiKeyMasked}</span>
                    : <StatusBadge tone="warning" label={t.aiNoKey} />}
                </td>
                <td style={{ padding: '13px 16px' }}>
                  <StatusBadge tone={p.enabled ? 'success' : 'neutral'} label={p.enabled ? t.aiEnabled : t.aiDisabled} />
                </td>
                <td style={{ padding: '13px 16px' }}>
                  {tm ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <StatusBadge tone={tm.tone} label={tm.label} />
                      <span style={{ fontSize: 12, color: '#a59fbb' }}>{fmtAiDateTime(p.lastTestedAt)}</span>
                    </div>
                  ) : <span style={{ fontSize: 13, color: '#a59fbb' }}>—</span>}
                </td>
                <td style={{ padding: '13px 16px' }}>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button onClick={() => openEdit(p)} style={btnOutline}>
                      <Icon icon={KeyRound} size={14} stroke="#8b5cf6" />{t.aiEditKey}
                    </button>
                    <button
                      onClick={() => runTest(p)}
                      disabled={!p.apiKeyMasked || testingId === p.id}
                      title={!p.apiKeyMasked ? t.aiNoKey : undefined}
                      style={{ ...btnOutline, cursor: testingId === p.id ? 'wait' : !p.apiKeyMasked ? 'not-allowed' : 'pointer', opacity: !p.apiKeyMasked ? 0.5 : 1 }}
                    >
                      <Icon icon={PlugZap} size={14} stroke="#0e7490" />
                      {testingId === p.id ? t.processing : t.aiTest}
                    </button>
                    {p.enabled ? (
                      <button onClick={() => setDisabling(p)} style={{ ...btnOutline, color: '#dc2626' }}>
                        <Icon icon={Power} size={14} stroke="#dc2626" />{t.aiDisable}
                      </button>
                    ) : (
                      <button
                        onClick={() => setEnabled(p, true)}
                        disabled={busy}
                        style={{ ...btnOutline, border: 'none', background: brandGradient, color: '#fff' }}
                      >
                        <Icon icon={Power} size={14} stroke="#fff" />{t.aiEnable}
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </DataTable>
      </AdminListPage>

      {/* Modal sửa key/tên — key là write-only, không bao giờ hiển thị full key cũ */}
      {editing && (
        <Modal title={`${t.aiEditKey} · ${editing.name}`} maxWidth={460} onClose={() => setEditing(null)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {editError && (
              <div style={{ padding: '10px 14px', borderRadius: 8, background: '#fee2e2', color: '#dc2626', fontSize: 13, fontWeight: 600 }}>
                {editError}
              </div>
            )}
            <div>
              <label style={labelStyle}>{t.aiNameLabel}</label>
              <input value={nameInput} onChange={(e) => setNameInput(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>
                {t.aiNewKey}
                {editing.apiKeyMasked && <span style={{ fontWeight: 600, color: '#a59fbb' }}> · {t.aiCurrentKey}: {editing.apiKeyMasked}</span>}
              </label>
              <input
                type="password"
                autoComplete="new-password"
                value={keyInput}
                onChange={(e) => setKeyInput(e.target.value)}
                placeholder={t.aiKeyPlaceholder}
                style={{ ...inputStyle, fontFamily: 'monospace' }}
              />
              <div style={{ fontSize: 12, color: '#8a85a0', marginTop: 6 }}>{t.aiKeyHint}</div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 4 }}>
              <button onClick={() => setEditing(null)} style={{ ...btnOutline, padding: '9px 18px', fontSize: 13 }}>{t.cancel}</button>
              <button
                onClick={saveEdit}
                disabled={saving}
                style={{ border: 'none', background: brandGradient, borderRadius: 10, padding: '9px 20px', fontSize: 13, fontWeight: 700, color: '#fff', cursor: saving ? 'wait' : 'pointer', opacity: saving ? 0.6 : 1 }}
              >
                {saving ? t.processing : t.aiSave}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Xác nhận TẮT provider */}
      {disabling && (
        <ConfirmModal
          variant="warning"
          title={`${t.aiDisable} · ${disabling.name}`}
          message={t.aiDisableConfirm}
          confirmLabel={t.aiDisable}
          busy={busy}
          onConfirm={() => setEnabled(disabling, false)}
          onClose={() => setDisabling(null)}
        />
      )}
    </div>
  );
}
