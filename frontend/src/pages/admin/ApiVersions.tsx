import { useEffect, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { PlatformTag, Loader } from '../../components/ui';
import { PLATFORM_BG } from '../../theme';
import Modal from '../../components/Modal';
import StatusBadge, { type Tone } from '../../components/admin/StatusBadge';
import AdminListPage, { DataTable, type ListState } from '../../components/admin/AdminListPage';
import {
  listApiVersions,
  getVersionHistory,
  updateVersion,
  checkNow,
  type ApiVersionInfo,
  type ApiVersionHistory,
  type PlatformEnum,
  type VersionStatus,
} from '../../api/adminApiVersions';

const PLATFORM_NAMES: Record<PlatformEnum, string> = {
  FACEBOOK: 'Facebook Graph API',
  INSTAGRAM: 'Instagram Graph API',
  THREADS: 'Threads API',
};

const PLATFORM_TAGS: Record<PlatformEnum, string> = {
  FACEBOOK: 'FB',
  INSTAGRAM: 'IG',
  THREADS: 'TH',
};

export default function ApiVersions() {
  const { t, brandGradient } = useApp();
  const [load, setLoad] = useState<'loading' | 'error' | 'ok'>('loading');
  const [rows, setRows] = useState<ApiVersionInfo[]>([]);
  const [checking, setChecking] = useState(false);

  // Modal states
  const [historyTarget, setHistoryTarget] = useState<ApiVersionInfo | null>(null);
  const [historyData, setHistoryData] = useState<ApiVersionHistory[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const [updateTarget, setUpdateTarget] = useState<ApiVersionInfo | null>(null);
  const [newVersionInput, setNewVersionInput] = useState('');
  const [notesInput, setNotesInput] = useState('');
  const [updating, setUpdating] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);

  const fetchVersions = () => {
    setLoad('loading');
    listApiVersions()
      .then((r) => {
        setRows(r);
        setLoad('ok');
      })
      .catch(() => setLoad('error'));
  };

  useEffect(() => {
    fetchVersions();
  }, []);

  const state: ListState =
    load === 'loading' ? 'loading' : load === 'error' ? 'error' : rows.length === 0 ? 'empty' : 'ready';

  // Trigger manual check
  const handleCheckNow = () => {
    setChecking(true);
    checkNow()
      .then((r) => {
        setRows(r);
      })
      .finally(() => setChecking(false));
  };

  // Open history modal
  const handleOpenHistory = (p: ApiVersionInfo) => {
    setHistoryTarget(p);
    setHistoryLoading(true);
    getVersionHistory(p.platform)
      .then((h) => setHistoryData(h))
      .catch(() => setHistoryData([]))
      .finally(() => setHistoryLoading(false));
  };

  // Open update modal
  const handleOpenUpdate = (p: ApiVersionInfo) => {
    setUpdateTarget(p);
    setNewVersionInput(p.latestVersion || p.currentVersion);
    setNotesInput('');
    setUpdateError(null);
  };

  // Submit version update
  const handleDoUpdate = () => {
    if (!updateTarget) return;
    if (!newVersionInput.trim()) {
      setUpdateError('Vui lòng nhập version mới.');
      return;
    }
    setUpdating(true);
    setUpdateError(null);
    updateVersion(updateTarget.platform, {
      newVersion: newVersionInput.trim(),
      notes: notesInput.trim() || undefined,
    })
      .then(() => {
        setUpdateTarget(null);
        fetchVersions();
      })
      .catch((err: Error) => {
        setUpdateError(err.message || 'Cập nhật thất bại.');
      })
      .finally(() => setUpdating(false));
  };

  const getBadgeMeta = (status: VersionStatus): { tone: Tone; label: string } => {
    switch (status) {
      case 'UP_TO_DATE':
        return { tone: 'success', label: t.apiUpToDate };
      case 'UPDATE_AVAILABLE':
        return { tone: 'warning', label: t.apiOutdated };
      case 'DEPRECATING_SOON':
        return { tone: 'danger', label: t.apiDeprecatingSoon };
      case 'DEPRECATED':
        return { tone: 'danger', label: t.apiDeprecated };
      default:
        return { tone: 'neutral', label: status };
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '—';
    try {
      return new Date(dateStr).toLocaleDateString('vi-VN');
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="view-pop" style={{ maxWidth: 1180, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Top action header */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: -10 }}>
        <button
          onClick={handleCheckNow}
          disabled={checking || load === 'loading'}
          style={{
            border: '1.5px solid #ece8f6',
            background: '#fff',
            borderRadius: 10,
            padding: '8px 16px',
            fontSize: 13,
            fontWeight: 700,
            color: '#7c3aed',
            cursor: checking ? 'wait' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            boxShadow: '0 2px 8px rgba(124,58,237,0.08)',
            opacity: checking ? 0.6 : 1,
          }}
        >
          <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M23 4v6h-6M1 20v-6h6" />
            <path d="M3.5 9a9 9 0 0114.8-3.4L23 10M1 14l4.6 4.4A9 9 0 0020.5 15" />
          </svg>
          {checking ? t.processing : t.apiCheckNow}
        </button>
      </div>

      <AdminListPage state={state} onRetry={fetchVersions}>
        <DataTable head={[t.colPlatform, t.colCurrentVer, t.colLatestVer, t.colStatus, t.colAction]} minWidth={780}>
          {rows.map((p) => {
            const badge = getBadgeMeta(p.status);
            const tag = PLATFORM_TAGS[p.platform];
            const name = PLATFORM_NAMES[p.platform];
            const upToDate = p.status === 'UP_TO_DATE';

            return (
              <tr key={p.platform} style={{ borderTop: '1px solid #f1eef8' }}>
                <td style={{ padding: '13px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <PlatformTag tag={tag} bg={PLATFORM_BG[tag]} />
                    <span style={{ fontSize: 13.5, fontWeight: 600, color: '#2b2543' }}>{name}</span>
                  </div>
                </td>
                <td style={{ padding: '13px 16px', fontSize: 13.5, fontWeight: 700, color: '#3f3a55' }}>{p.currentVersion}</td>
                <td style={{ padding: '13px 16px', fontSize: 13.5, fontWeight: 700, color: upToDate ? '#3f3a55' : '#7c3aed' }}>
                  {p.latestVersion}
                </td>
                <td style={{ padding: '13px 16px' }}>
                  <StatusBadge tone={badge.tone} label={badge.label} />
                </td>
                <td style={{ padding: '13px 16px' }}>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      onClick={() => handleOpenHistory(p)}
                      style={{
                        border: '1px solid #ece8f6',
                        background: '#fff',
                        borderRadius: 9,
                        padding: '6px 12px',
                        fontSize: 12.5,
                        fontWeight: 700,
                        color: '#5b5670',
                        cursor: 'pointer',
                      }}
                    >
                      {t.apiHistory}
                    </button>
                    <button
                      onClick={() => handleOpenUpdate(p)}
                      style={{
                        border: 'none',
                        borderRadius: 9,
                        padding: '6px 14px',
                        fontSize: 12.5,
                        fontWeight: 700,
                        color: '#fff',
                        cursor: 'pointer',
                        background: brandGradient,
                      }}
                    >
                      {t.apiUpdate}
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </DataTable>
      </AdminListPage>

      {/* Modal Lịch sử thay đổi */}
      {historyTarget && (
        <Modal title={`${t.apiHistoryTitle} · ${PLATFORM_NAMES[historyTarget.platform]}`} maxWidth={520} onClose={() => setHistoryTarget(null)}>
          {historyLoading ? (
            <Loader label={t.listLoading} />
          ) : historyData.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px 0', color: '#8a85a0', fontSize: 13.5 }}>
              {t.listEmpty}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0, maxHeight: 400, overflowY: 'auto' }}>
              {historyData.map((h, i) => (
                <div key={h.id || i} style={{ display: 'flex', gap: 12, padding: '14px 0', borderTop: i === 0 ? 'none' : '1px solid #f1eef8' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', minWidth: 85 }}>
                    <span style={{ fontSize: 13.5, fontWeight: 800, color: '#7c3aed' }}>
                      {h.fromVersion ? `${h.fromVersion} → ${h.toVersion}` : h.toVersion}
                    </span>
                    <span style={{ fontSize: 10.5, fontWeight: 700, color: '#8a85a0', textTransform: 'uppercase', marginTop: 2 }}>
                      {h.changeType}
                    </span>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, color: '#3f3a55', lineHeight: 1.4 }}>{h.notes || '—'}</div>
                    <div style={{ fontSize: 11.5, color: '#a59fbb', marginTop: 4 }}>
                      {formatDate(h.createdAt)} {h.changedByName ? `· ${h.changedByName}` : ''}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Modal>
      )}

      {/* Modal Cập nhật Version */}
      {updateTarget && (
        <Modal title={`${t.apiUpdateTitle} · ${PLATFORM_NAMES[updateTarget.platform]}`} maxWidth={460} onClose={() => setUpdateTarget(null)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {updateError && (
              <div style={{ padding: '10px 14px', borderRadius: 8, background: '#fee2e2', color: '#dc2626', fontSize: 13, fontWeight: 600 }}>
                {updateError}
              </div>
            )}

            <div>
              <label style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: '#3f3a55', marginBottom: 6 }}>
                Version hiện tại: <span style={{ color: '#7c3aed' }}>{updateTarget.currentVersion}</span> (Mới nhất: {updateTarget.latestVersion})
              </label>
              <input
                type="text"
                value={newVersionInput}
                onChange={(e) => setNewVersionInput(e.target.value)}
                placeholder="vd: v20.0"
                style={{
                  width: '100%',
                  border: '1.5px solid #ece8f6',
                  borderRadius: 10,
                  padding: '10px 14px',
                  fontSize: 14,
                  fontWeight: 600,
                  color: '#2b2543',
                  outline: 'none',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: '#3f3a55', marginBottom: 6 }}>
                {t.apiNotes}
              </label>
              <textarea
                value={notesInput}
                onChange={(e) => setNotesInput(e.target.value)}
                rows={3}
                placeholder="Nhập lý do hoặc ghi chú nâng cấp..."
                style={{
                  width: '100%',
                  border: '1.5px solid #ece8f6',
                  borderRadius: 10,
                  padding: '10px 14px',
                  fontSize: 13.5,
                  color: '#2b2543',
                  outline: 'none',
                  resize: 'vertical',
                  fontFamily: 'inherit',
                }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
              <button
                onClick={() => setUpdateTarget(null)}
                style={{
                  border: '1.5px solid #ece8f6',
                  background: '#fff',
                  borderRadius: 10,
                  padding: '9px 18px',
                  fontSize: 13,
                  fontWeight: 700,
                  color: '#5b5670',
                  cursor: 'pointer',
                }}
              >
                {t.cancel}
              </button>
              <button
                onClick={handleDoUpdate}
                disabled={updating}
                style={{
                  border: 'none',
                  background: brandGradient,
                  borderRadius: 10,
                  padding: '9px 20px',
                  fontSize: 13,
                  fontWeight: 700,
                  color: '#fff',
                  cursor: updating ? 'wait' : 'pointer',
                  opacity: updating ? 0.6 : 1,
                }}
              >
                {updating ? t.processing : t.apiUpdate}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
