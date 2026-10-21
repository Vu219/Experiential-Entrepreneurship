import {
useEffect, useState, type CSSProperties } from 'react';
import { RefreshCw, Lock, Unlock } from 'lucide-react';
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
import PageContainer from '../../components/PageContainer';
import { C } from '../../styles/colors';
import Switch from '../../components/admin/Switch';
import ConfirmModal from '../../components/ConfirmModal';
import { useToast } from '../../components/toast/ToastProvider';
import {
  listPlatformAvailability,
  updatePlatformAvailability,
  type PlatformAvailability,
} from '../../api/platformAvailability';
import { invalidatePlatformAccess } from '../../hooks/usePlatformAccess';

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

const reasonInput: CSSProperties = {
  width: '100%', minWidth: 0, border: `1.5px solid ${C.border}`, borderRadius: 10, padding: '9px 12px',
  fontSize: 13.5, color: C.ink750, background: C.surface, outline: 'none', resize: 'vertical', fontFamily: 'inherit',
  boxSizing: 'border-box',
};

export default function ApiVersions() {
  const { t, brandGradient } = useApp();
  const toast = useToast();
  const [load, setLoad] = useState<'loading' | 'error' | 'ok'>('loading');
  const [rows, setRows] = useState<ApiVersionInfo[]>([]);
  const [checking, setChecking] = useState(false);
  // Trạng thái mở/khoá liên kết toàn hệ thống (V20) — tách khỏi badge version.
  const [availability, setAvailability] = useState<Partial<Record<PlatformEnum, PlatformAvailability>>>({});
  const [lockTarget, setLockTarget] = useState<PlatformAvailability | null>(null);
  const [unlockTarget, setUnlockTarget] = useState<PlatformAvailability | null>(null);
  const [reasonVi, setReasonVi] = useState('');
  const [reasonEn, setReasonEn] = useState('');
  const [lockBusy, setLockBusy] = useState(false);

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
    Promise.all([listApiVersions(), listPlatformAvailability()])
      .then(([r, a]) => {
        setRows(r);
        setAvailability(Object.fromEntries(a.map((x) => [x.platform, x])));
        setLoad('ok');
      })
      .catch(() => setLoad('error'));
  };

  const openLock = (a: PlatformAvailability) => {
    setReasonVi(a.reasonVi ?? '');
    setReasonEn(a.reasonEn ?? '');
    setLockTarget(a);
  };

  // Khoá: backend giữ mọi lịch chưa đăng của nền tảng (PLATFORM_DISABLED) trong cùng transaction + báo user.
  const doLock = () => {
    if (!lockTarget) return;
    if (!reasonVi.trim() || !reasonEn.trim()) {
      toast.error(t.paReasonRequired);
      return;
    }
    setLockBusy(true);
    updatePlatformAvailability(lockTarget.platform, { enabled: false, reasonVi: reasonVi.trim(), reasonEn: reasonEn.trim() })
      .then((r) => {
        toast.success(t.paLocked.replace('{platform}', PLATFORM_NAMES[r.platform]).replace('{n}', String(r.heldSchedules ?? 0)));
        setLockTarget(null);
        invalidatePlatformAccess();
        fetchVersions();
      })
      .catch((err: Error) => toast.error(err.message || t.paUpdateFail))
      .finally(() => setLockBusy(false));
  };

  // Mở lại: tài khoản hết khoá; lịch đang tạm giữ KHÔNG tự đăng lại — người dùng tự tiếp tục từng lịch.
  const doUnlock = () => {
    if (!unlockTarget) return;
    setLockBusy(true);
    updatePlatformAvailability(unlockTarget.platform, { enabled: true })
      .then((r) => {
        toast.success(t.paUnlocked.replace('{platform}', PLATFORM_NAMES[r.platform]));
        setUnlockTarget(null);
        invalidatePlatformAccess();
        fetchVersions();
      })
      .catch((err: Error) => toast.error(err.message || t.paUpdateFail))
      .finally(() => setLockBusy(false));
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
      setUpdateError(t.apiVersionRequired);
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
        setUpdateError(err.message || t.apiUpdateFail);
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
    <PageContainer>
      {/* Top action header */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: -10 }}>
        <button
          onClick={handleCheckNow}
          disabled={checking || load === 'loading'}
          style={{
            border: `1.5px solid ${C.border}`,
            background: C.surface,
            borderRadius: 10,
            padding: '8px 16px',
            fontSize: 13,
            fontWeight: 700,
            color: C.primary,
            cursor: checking ? 'wait' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            boxShadow: `0 2px 8px ${C.legacyShadowrgba12458237008_}`,
            opacity: checking ? 0.6 : 1,
          }}
        >
          <RefreshCw size={15} color={C.primary} strokeWidth={2.2} />
          {checking ? t.processing : t.apiCheckNow}
        </button>
      </div>

      <AdminListPage state={state} onRetry={fetchVersions}>
        <DataTable head={[t.colPlatform, t.colCurrentVer, t.colLatestVer, t.colStatus, t.paColLink, t.colAction]} minWidth={940}>
          {rows.map((p) => {
            const badge = getBadgeMeta(p.status);
            const tag = PLATFORM_TAGS[p.platform];
            const name = PLATFORM_NAMES[p.platform];
            const upToDate = p.status === 'UP_TO_DATE';

            return (
              <tr key={p.platform} style={{ borderTop: `1px solid ${C.surfaceMuted}` }}>
                <td style={{ padding: '13px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <PlatformTag tag={tag} bg={PLATFORM_BG[tag]} />
                    <span style={{ fontSize: 13.5, fontWeight: 600, color: C.ink750 }}>{name}</span>
                  </div>
                </td>
                <td style={{ padding: '13px 16px', fontSize: 13.5, fontWeight: 700, color: C.text }}>{p.currentVersion}</td>
                <td style={{ padding: '13px 16px', fontSize: 13.5, fontWeight: 700, color: upToDate ? C.text : C.primary }}>
                  {p.latestVersion}
                </td>
                <td style={{ padding: '13px 16px' }}>
                  <StatusBadge tone={badge.tone} label={badge.label} />
                </td>
                <td style={{ padding: '13px 16px' }}>
                  {(() => {
                    const a = availability[p.platform];
                    if (!a) return <span style={{ color: C.textFaint }}>—</span>;
                    return (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <Switch
                          checked={a.connectionEnabled}
                          title={a.connectionEnabled ? t.paLockAction : t.paUnlockAction}
                          onChange={(on) => (on ? setUnlockTarget(a) : openLock(a))}
                        />
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
                          <StatusBadge tone={a.connectionEnabled ? 'success' : 'danger'}
                            label={a.connectionEnabled ? t.paOpen : t.paLockedBadge} />
                          <span style={{ fontSize: 11.5, color: C.textMuted, whiteSpace: 'nowrap' }}>
                            {t.paImpact.replace('{accounts}', String(a.connectedAccounts)).replace('{schedules}', String(a.pendingSchedules))}
                          </span>
                        </div>
                      </div>
                    );
                  })()}
                </td>
                <td style={{ padding: '13px 16px' }}>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      onClick={() => handleOpenHistory(p)}
                      style={{
                        border: `1px solid ${C.border}`,
                        background: C.surface,
                        borderRadius: 9,
                        padding: '6px 12px',
                        fontSize: 12.5,
                        fontWeight: 700,
                        color: C.ink550,
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
                        color: C.onBrand,
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
            <div style={{ textAlign: 'center', padding: '24px 0', color: C.textMuted, fontSize: 13.5 }}>
              {t.listEmpty}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0, maxHeight: 400, overflowY: 'auto' }}>
              {historyData.map((h, i) => (
                <div key={h.id || i} style={{ display: 'flex', gap: 12, padding: '14px 0', borderTop: i === 0 ? 'none' : `1px solid ${C.surfaceMuted}` }}>
                  <div style={{ display: 'flex', flexDirection: 'column', minWidth: 85 }}>
                    <span style={{ fontSize: 13.5, fontWeight: 800, color: C.primary }}>
                      {h.fromVersion ? `${h.fromVersion} → ${h.toVersion}` : h.toVersion}
                    </span>
                    <span style={{ fontSize: 10.5, fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', marginTop: 2 }}>
                      {h.changeType}
                    </span>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, color: C.text, lineHeight: 1.4 }}>{h.notes || '—'}</div>
                    <div style={{ fontSize: 11.5, color: C.textFaint, marginTop: 4 }}>
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
              <div style={{ padding: '10px 14px', borderRadius: 8, background: C.dangerSoft2, color: C.danger, fontSize: 13, fontWeight: 600 }}>
                {updateError}
              </div>
            )}

            <div>
              <label style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: C.text, marginBottom: 6 }}>
                {t.apiCurrentVersionLabel} <span style={{ color: C.primary }}>{updateTarget.currentVersion}</span>{' '}
                ({t.apiLatestVersionLabel} {updateTarget.latestVersion})
              </label>
              <input
                type="text"
                value={newVersionInput}
                onChange={(e) => setNewVersionInput(e.target.value)}
                placeholder={t.apiVersionPlaceholder}
                style={{
                  width: '100%',
                  border: `1.5px solid ${C.border}`,
                  borderRadius: 10,
                  padding: '10px 14px',
                  fontSize: 14,
                  fontWeight: 600,
                  color: C.ink750,
                  outline: 'none',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: C.text, marginBottom: 6 }}>
                {t.apiNotes}
              </label>
              <textarea
                value={notesInput}
                onChange={(e) => setNotesInput(e.target.value)}
                rows={3}
                placeholder={t.apiNotesPlaceholder}
                style={{
                  width: '100%',
                  border: `1.5px solid ${C.border}`,
                  borderRadius: 10,
                  padding: '10px 14px',
                  fontSize: 13.5,
                  color: C.ink750,
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
                  border: `1.5px solid ${C.border}`,
                  background: C.surface,
                  borderRadius: 10,
                  padding: '9px 18px',
                  fontSize: 13,
                  fontWeight: 700,
                  color: C.ink550,
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
                  color: C.onBrand,
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

      {/* Khoá liên kết nền tảng — ghi rõ mức ảnh hưởng + lý do VI/EN hiển thị cho người dùng. */}
      {lockTarget && (
        <ConfirmModal
          title={t.paLockTitle.replace('{platform}', PLATFORM_NAMES[lockTarget.platform])}
          message={t.paLockMessage
            .replace('{accounts}', String(lockTarget.connectedAccounts))
            .replace('{schedules}', String(lockTarget.pendingSchedules))}
          confirmLabel={t.paLockConfirm}
          busy={lockBusy}
          onConfirm={doLock}
          onClose={() => !lockBusy && setLockTarget(null)}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '10px 12px', borderRadius: 10,
            background: C.dangerSoft2, color: C.danger, fontSize: 12.5, lineHeight: 1.5, marginBottom: 14 }}>
            <Lock size={15} strokeWidth={2.2} aria-hidden style={{ flex: 'none', marginTop: 1 }} />
            <span>{t.paLockEffects}</span>
          </div>
          <label style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: C.text, marginBottom: 6 }}>
            {t.paReasonVi} <span style={{ color: C.danger }}>*</span>
          </label>
          <textarea rows={2} maxLength={300} value={reasonVi} onChange={(e) => setReasonVi(e.target.value)}
            placeholder={t.paReasonViPlaceholder} style={reasonInput} />
          <label style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: C.text, margin: '12px 0 6px' }}>
            {t.paReasonEn} <span style={{ color: C.danger }}>*</span>
          </label>
          <textarea rows={2} maxLength={300} value={reasonEn} onChange={(e) => setReasonEn(e.target.value)}
            placeholder={t.paReasonEnPlaceholder} style={{ ...reasonInput, marginBottom: 14 }} />
        </ConfirmModal>
      )}

      {unlockTarget && (
        <ConfirmModal
          title={t.paUnlockTitle.replace('{platform}', PLATFORM_NAMES[unlockTarget.platform])}
          message={t.paUnlockMessage}
          confirmLabel={t.paUnlockConfirm}
          variant="warning"
          busy={lockBusy}
          onConfirm={doUnlock}
          onClose={() => !lockBusy && setUnlockTarget(null)}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12.5, color: C.textMuted,
            lineHeight: 1.5, marginBottom: 14 }}>
            <Unlock size={15} strokeWidth={2.2} aria-hidden style={{ flex: 'none', marginTop: 1 }} />
            <span>{t.paUnlockEffects}</span>
          </div>
        </ConfirmModal>
      )}
    </PageContainer>
  );
}
