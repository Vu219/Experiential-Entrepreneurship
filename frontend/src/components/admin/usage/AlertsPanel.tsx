import { useEffect, useState, type CSSProperties } from 'react';
import { useApp } from '../../../context/AppContext';
import { Loader } from '../../ui';
import SectionCard from '../SectionCard';
import StatusBadge from '../StatusBadge';
import { DataTable } from '../AdminListPage';
import { useToast } from '../../toast/ToastProvider';
import {
  getAlerts,
  ackAlert,
  getAlertStats,
  getAlertConfig,
  updateAlertConfig,
  type AlertRuleStat,
  type UsageAlert,
  type UsageAlertRule,
} from '../../../api/adminUsage';

// Khối "Cảnh báo bất thường" trên tab Tổng quan (pha 5A — alert-only): danh sách OPEN
// (ACK + cờ báo nhầm), báo cáo đo FP theo rule, và bảng chỉnh ngưỡng (đọc/ghi system_config).

const tdStyle: CSSProperties = { padding: '10px 14px', fontSize: 13, color: '#2b2543' };
const tdMuted: CSSProperties = { ...tdStyle, color: '#8a85a0', fontSize: 12.5 };

const fmtDateTime = (iso: string) => iso.slice(0, 16).replace('T', ' ');
const sevTone = (s: UsageAlert['severity']) => (s === 'CRITICAL' ? 'danger' : s === 'WARNING' ? 'warning' : 'info');

export function alertRuleLabel(t: Record<string, string>, rule: UsageAlertRule): string {
  return ({
    HIGH_REQUEST_RATE: t.alrRuleR1, QUOTA_BURST: t.alrRuleR2, DAILY_SPIKE: t.alrRuleR3,
    MULTI_CLIENT: t.alrRuleR4, SYSTEM_ERROR_RATE: t.alrRuleR5, USER_COST: t.alrRuleR6,
    CREDIT_SHORTFALL: t.alrRuleR7, ADMIN_GRANT_ANOMALY: t.alrRuleR8, SYSTEM_COST: t.alrRuleR9,
  } as Record<UsageAlertRule, string>)[rule] ?? rule;
}

export default function AlertsPanel() {
  const { t, brandGradient } = useApp();
  const toast = useToast();

  const [alerts, setAlerts] = useState<UsageAlert[] | null>(null);
  const [stats, setStats] = useState<AlertRuleStat[] | null>(null);
  const [config, setConfig] = useState<Record<string, string> | null>(null);
  const [configDraft, setConfigDraft] = useState<Record<string, string>>({});
  const [showConfig, setShowConfig] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [savingConfig, setSavingConfig] = useState(false);

  const fetchAll = () => {
    getAlerts({ status: 'OPEN' }).then(setAlerts).catch(() => setAlerts([]));
    getAlertStats().then(setStats).catch(() => setStats([]));
  };
  useEffect(fetchAll, []);
  useEffect(() => {
    if (showConfig && config === null) {
      getAlertConfig().then((c) => { setConfig(c); setConfigDraft(c); }).catch(() => setConfig({}));
    }
  }, [showConfig]);

  const doAck = async (alert: UsageAlert, falsePositive: boolean) => {
    setBusyId(alert.id);
    try {
      await ackAlert(alert.id, falsePositive);
      toast.success(t.alrAckOk);
      fetchAll();
    } catch {
      toast.error(t.auActionErr);
    } finally {
      setBusyId(null);
    }
  };

  const doSaveConfig = async () => {
    if (!config) return;
    const changes: Record<string, string> = {};
    for (const [key, value] of Object.entries(configDraft)) {
      if (value !== config[key]) changes[key] = value;
    }
    if (Object.keys(changes).length === 0) return;
    setSavingConfig(true);
    try {
      const updated = await updateAlertConfig(changes);
      setConfig(updated);
      setConfigDraft(updated);
      toast.success(t.alrConfigOk);
    } catch {
      toast.error(t.auActionErr);
    } finally {
      setSavingConfig(false);
    }
  };

  const smallBtn = (label: string, onClick: () => void, danger = false, disabled = false): JSX.Element => (
    <button onClick={onClick} disabled={disabled}
      style={{ border: `1px solid ${danger ? '#fecaca' : '#ece8f6'}`, background: '#fff', borderRadius: 9, padding: '5px 10px', fontSize: 12, fontWeight: 700, color: danger ? '#dc2626' : '#5b5670', cursor: disabled ? 'wait' : 'pointer', opacity: disabled ? 0.6 : 1 }}>
      {label}
    </button>
  );

  return (
    <SectionCard
      title={t.alrTitle}
      action={
        <button onClick={() => setShowConfig((v) => !v)}
          style={{ border: '1px solid #ece8f6', background: showConfig ? '#f4f1fa' : '#fff', borderRadius: 9, padding: '6px 12px', fontSize: 12.5, fontWeight: 700, color: '#5b5670', cursor: 'pointer' }}>
          {t.alrConfigTitle}
        </button>
      }
    >
      <div style={{ fontSize: 12, color: '#8a85a0', marginBottom: 12 }}>{t.alrNote}</div>

      {/* Chỉnh ngưỡng (system_config — 0 = tắt rule) */}
      {showConfig && (
        <div style={{ border: '1px solid #eee9f6', background: '#f8f6fd', borderRadius: 12, padding: 12, marginBottom: 14 }}>
          <div style={{ fontSize: 12, color: '#8a85a0', marginBottom: 10 }}>{t.alrConfigNote}</div>
          {config === null ? <Loader label={t.listLoading} /> : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: 8 }}>
                {Object.entries(configDraft).map(([key, value]) => (
                  <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#5b5670' }}>
                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={key}>{key.replace('alert.', '')}</span>
                    <input value={value} onChange={(e) => setConfigDraft((d) => ({ ...d, [key]: e.target.value }))}
                      style={{ width: 90, border: '1px solid #ece8f6', borderRadius: 8, padding: '5px 8px', fontSize: 12.5, textAlign: 'right' }} />
                  </label>
                ))}
              </div>
              <button onClick={doSaveConfig} disabled={savingConfig}
                style={{ marginTop: 10, border: 'none', borderRadius: 10, padding: '8px 16px', fontWeight: 700, fontSize: 12.5, color: '#fff', background: brandGradient, cursor: savingConfig ? 'wait' : 'pointer', opacity: savingConfig ? 0.7 : 1 }}>
                {t.alrConfigSave}
              </button>
            </>
          )}
        </div>
      )}

      {/* Danh sách OPEN */}
      {alerts === null ? <Loader label={t.listLoading} /> : alerts.length === 0 ? (
        <div style={{ fontSize: 13, color: '#a59fbb', marginBottom: 12 }}>{t.alrEmpty}</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
          {alerts.map((a) => (
            <div key={a.id} style={{ border: '1px solid #f1eef8', borderRadius: 12, padding: '10px 12px', display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
              <StatusBadge tone={sevTone(a.severity)} label={alertRuleLabel(t, a.ruleCode)} />
              <span style={{ fontSize: 12.5, fontWeight: 700, color: '#3f3a55' }}>{a.userEmail ?? t.alrSystem}</span>
              <span style={{ fontSize: 12.5, color: '#5b5670', flex: 1, minWidth: 200 }}>{a.message}</span>
              <span style={{ fontSize: 11.5, color: '#a59fbb', whiteSpace: 'nowrap' }}>
                {t.alrTimes.replace('{n}', String(a.occurrenceCount))} · {t.alrLast} {fmtDateTime(a.lastSeen)}
              </span>
              {smallBtn(t.alrAck, () => doAck(a, false), false, busyId === a.id)}
              {smallBtn(t.alrAckFp, () => doAck(a, true), true, busyId === a.id)}
            </div>
          ))}
        </div>
      )}

      {/* Báo cáo đo FP theo rule — căn cứ quyết định rule nào sang 5B */}
      <div style={{ fontSize: 12.5, fontWeight: 700, letterSpacing: '.03em', color: '#7d6aa3', marginBottom: 8 }}>{t.alrStatsTitle}</div>
      {stats === null ? <Loader label={t.listLoading} /> : stats.length === 0 ? (
        <div style={{ fontSize: 13, color: '#a59fbb' }}>{t.alrStatsEmpty}</div>
      ) : (
        <DataTable head={[t.alrColRule, t.alrColTotal, t.alrColFp, t.alrColFpPct]} minWidth={420}>
          {stats.map((s) => (
            <tr key={s.ruleCode} style={{ borderTop: '1px solid #f1eef8' }}>
              <td style={{ ...tdStyle, fontWeight: 600 }}>{alertRuleLabel(t, s.ruleCode)}</td>
              <td style={tdStyle}>{s.total}</td>
              <td style={tdStyle}>{s.falsePositives}</td>
              <td style={tdMuted}>
                {s.falsePositivePct === null ? '—' : (
                  <StatusBadge tone={s.falsePositivePct >= 50 ? 'danger' : s.falsePositivePct >= 20 ? 'warning' : 'success'} label={`${s.falsePositivePct}%`} />
                )}
              </td>
            </tr>
          ))}
        </DataTable>
      )}
    </SectionCard>
  );
}
