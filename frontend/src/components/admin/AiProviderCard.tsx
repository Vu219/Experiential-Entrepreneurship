import { type CSSProperties } from 'react';
import { AlertTriangle, CreditCard, KeyRound, PlugZap, RefreshCw, RotateCcw, Timer } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Card, Icon } from '../ui';
import StatusBadge, { type Tone } from './StatusBadge';
import Switch from './Switch';
import { TONE_COLORS } from '../../statusTokens';
import { providerVisual } from '../../pages/admin/aiProviderRegistry';
import {
  aiFreeTierText, aiModelHealthLabel, aiModelHealthText, aiTestStatusText, aiTestTone, fmtAiDateTime,
  type AiModelHealth, type AiProviderInfo,
} from '../../api/adminAi';

/** limited = key hợp lệ nhưng nhà cung cấp tạm từ chối (quá tải / hết quota / rate limit) — vàng, KHÔNG đỏ. */
export type ProviderStatus = 'connected' | 'limited' | 'error' | 'pending' | 'nokey';

/** Trạng thái kết nối suy ra từ dữ liệu THẬT của provider (không có latency/expiry persisted). */
export function providerStatus(p: AiProviderInfo): ProviderStatus {
  if (!p.apiKeyMasked) return 'nokey';
  const tone = aiTestTone(p.lastTestStatus);
  if (tone === 'error') return 'error';
  if (tone === 'limited') return 'limited';
  if (tone === 'ok' || p.modelCatalogSyncedAt) return 'connected';
  return 'pending';
}

const logoTile = (hue: string): CSSProperties => ({
  width: 44, height: 44, flex: 'none', borderRadius: 13, display: 'grid', placeItems: 'center', color: '#fff',
  background: hue, boxShadow: `inset 0 1px 0 rgba(255,255,255,.3), 0 8px 16px -10px ${hue}`,
});
const metricsWrap: CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 1, background: '#efeaf8', border: '1px solid #efeaf8', borderRadius: 12, overflow: 'hidden' };
const metricCell: CSSProperties = { background: '#faf9fe', padding: '9px 11px', display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 };
const mK: CSSProperties = { fontSize: 10.5, fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase', color: '#948eae' };
const mV: CSSProperties = { fontSize: 13.5, fontWeight: 700, color: '#2b2543', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' };
const keyRowStyle: CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, padding: '8px 11px', borderRadius: 10, background: '#f5f3fc', border: '1px solid #efeaf8', minWidth: 0 };
const ribbonErr: CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, fontWeight: 600, lineHeight: 1.35, padding: '8px 11px', borderRadius: 10, color: '#dc2626', background: '#fde8e8', border: '1px solid #f4cccc' };
const ribbonWarn: CSSProperties = { ...ribbonErr, color: '#b45309', background: '#fdf6ea', border: '1px solid #f6e2c2' };
const healthBox: CSSProperties = { display: 'flex', flexDirection: 'column', gap: 7, padding: '9px 11px', borderRadius: 10, background: '#fdf6ea', border: '1px solid #f6e2c2' };
const actBtn: CSSProperties = { border: '1px solid #ece8f6', background: '#fff', borderRadius: 9, padding: '7px 10px', fontSize: 12.5, fontWeight: 700, color: '#5b5670', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, flex: 1, minWidth: 92 };

export default function AiProviderCard({
  provider, testing, syncing, busyToggle, health, resetting, onEdit, onTest, onSync, onToggle, onResetHealth,
}: {
  provider: AiProviderInfo;
  testing: boolean;
  syncing: boolean;
  busyToggle: boolean;
  /** Các model của provider đang bị circuit breaker cho nghỉ. */
  health: AiModelHealth[];
  resetting: boolean;
  onResetHealth: (p: AiProviderInfo) => void;
  onEdit: (p: AiProviderInfo) => void;
  onTest: (p: AiProviderInfo) => void;
  onSync: (p: AiProviderInfo) => void;
  onToggle: (p: AiProviderInfo, next: boolean) => void;
}) {
  const { t, lang } = useApp();
  const hx = aiModelHealthText(lang);
  const fx = aiFreeTierText(lang);
  const freeTier = !!provider.freeTierDetectedAt;
  const testText = provider.lastTestStatus ? aiTestStatusText(lang, provider.lastTestStatus, freeTier) : null;
  const v = providerVisual(provider.code);
  const status = providerStatus(provider);
  const noKey = !provider.apiKeyMasked;

  const meta: Record<ProviderStatus, { tone: Tone; label: string }> = {
    connected: { tone: 'success', label: t.aiStatusConnected },
    limited: { tone: 'warning', label: testText?.badge ?? t.aiStatusConnected },
    error: { tone: 'danger', label: testText?.badge ?? t.aiTestFail },
    pending: { tone: 'info', label: t.aiStatusPending },
    nokey: { tone: 'warning', label: t.aiNoKey },
  };
  const opBtn = (disabled: boolean, waiting: boolean): CSSProperties => ({
    ...actBtn,
    cursor: waiting ? 'wait' : disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1,
  });

  return (
    <Card style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12, position: 'relative', overflow: 'hidden', opacity: provider.enabled ? 1 : 0.72 }}>
      <span style={{ position: 'absolute', insetInline: 0, top: 0, height: 3, background: TONE_COLORS[meta[status].tone].color }} />

      {/* Header: logo + tên + mã | switch bật/tắt */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
          <span style={logoTile(v.hue)}>{v.logo(24)}</span>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 14.5, fontWeight: 700, color: '#2b2543', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{provider.name}</div>
            <div style={{ fontSize: 11.5, color: '#a59fbb', fontFamily: 'monospace' }}>{provider.code}</div>
          </div>
        </div>
        <Switch
          checked={provider.enabled}
          disabled={busyToggle}
          title={provider.enabled ? t.aiDisable : t.aiEnable}
          onChange={(val) => onToggle(provider, val)}
        />
      </div>

      {/* Trạng thái kết nối + thời điểm test gần nhất */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <StatusBadge tone={meta[status].tone} label={meta[status].label} />
        {provider.lastTestedAt && <span style={{ fontSize: 11.5, color: '#a59fbb' }}>{fmtAiDateTime(provider.lastTestedAt)}</span>}
      </div>

      {/* Đỏ chỉ khi key sai / không kết nối được; quá tải / hết quota = vàng (key vẫn hợp lệ) */}
      {(status === 'error' || status === 'limited') && (
        <div style={status === 'error' ? ribbonErr : ribbonWarn}>
          <AlertTriangle size={14} strokeWidth={2.2} style={{ flex: 'none' }} />
          <span>{testText?.detail ?? t.aiTestFail}{provider.lastTestedAt ? ` · ${fmtAiDateTime(provider.lastTestedAt)}` : ''}</span>
        </div>
      )}

      {/* Từng gặp 429 FreeTier — khuyên bật billing; nút reset xoá cờ (kể cả khi không còn model nào đang nghỉ) */}
      {freeTier && (
        <div style={{ ...healthBox, background: '#fdf1dd', borderColor: '#f3d9a8' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 7, fontSize: 12.5, fontWeight: 600, color: '#92400e', lineHeight: 1.4 }}>
            <CreditCard size={14} strokeWidth={2.2} style={{ flex: 'none', marginTop: 2 }} />
            <span>{fx.banner}</span>
          </div>
          <div style={{ fontSize: 11.5, color: '#a16207' }}>{fx.since(fmtAiDateTime(provider.freeTierDetectedAt))}</div>
          {health.length === 0 && (
            <button onClick={() => onResetHealth(provider)} disabled={resetting} style={{ ...opBtn(resetting, resetting), flex: 'none', alignSelf: 'flex-start' }}>
              <Icon icon={RotateCcw} size={14} stroke="#b45309" />{resetting ? t.processing : hx.reset}
            </button>
          )}
        </div>
      )}

      {/* Metrics thật: số model · đồng bộ lần cuối · số nghiệp vụ phụ thuộc */}
      <div style={metricsWrap}>
        <div style={metricCell}><span style={mK}>{t.aiMetricModels}</span><span style={mV}>{provider.modelCatalog?.length ?? '—'}</span></div>
        <div style={metricCell}><span style={mK}>{t.aiMetricSynced}</span><span style={mV}>{provider.modelCatalogSyncedAt ? fmtAiDateTime(provider.modelCatalogSyncedAt) : '—'}</span></div>
        <div style={metricCell}><span style={mK}>{t.aiColTask}</span><span style={mV}>{provider.dependentTaskCount || '—'}</span></div>
      </div>

      {/* Model đang tạm nghỉ (circuit breaker) + nút reset (vd sau khi bật billing) */}
      {health.length > 0 && (
        <div style={healthBox}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: '#b45309' }}>
            <Timer size={13} strokeWidth={2.2} style={{ flex: 'none' }} />{hx.title}
          </div>
          {health.map((h) => (
            <div key={h.model} style={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0 }}>
              <code style={{ fontFamily: 'monospace', fontSize: 12, color: '#3f3a55', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.model}</code>
              <span style={{ fontSize: 12, color: '#92400e' }}>{aiModelHealthLabel(lang, h)}</span>
            </div>
          ))}
          <div style={{ fontSize: 11.5, color: '#a16207' }}>{hx.hint}</div>
          <button onClick={() => onResetHealth(provider)} disabled={resetting} style={{ ...opBtn(resetting, resetting), flex: 'none', alignSelf: 'flex-start' }}>
            <Icon icon={RotateCcw} size={14} stroke="#b45309" />{resetting ? t.processing : hx.reset}
          </button>
        </div>
      )}

      {/* Masked key hoặc cảnh báo chưa có key */}
      {provider.apiKeyMasked ? (
        <div style={keyRowStyle}>
          <Icon icon={KeyRound} size={13} stroke="#8b5cf6" />
          <code style={{ fontFamily: 'monospace', fontSize: 12.5, color: '#3f3a55', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{provider.apiKeyMasked}</code>
        </div>
      ) : (
        <div style={{ ...keyRowStyle, background: '#fdf0dc', borderColor: '#f6e2c2' }}>
          <Icon icon={KeyRound} size={13} stroke="#b45309" />
          <span style={{ fontSize: 12.5, fontWeight: 600, color: '#b45309' }}>{t.aiNoKey}</span>
        </div>
      )}

      {/* Hành động */}
      <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', borderTop: '1px solid #f1eef8', paddingTop: 12 }}>
        <button onClick={() => onEdit(provider)} style={actBtn}>
          <Icon icon={KeyRound} size={14} stroke="#8b5cf6" />{t.aiEditKey}
        </button>
        <button onClick={() => onTest(provider)} disabled={noKey || testing} title={noKey ? t.aiNoKey : undefined} style={opBtn(noKey || testing, testing)}>
          <Icon icon={PlugZap} size={14} stroke="#0e7490" />{testing ? t.processing : t.aiTest}
        </button>
        <button onClick={() => onSync(provider)} disabled={noKey || syncing} title={noKey ? t.aiNoKey : undefined} style={opBtn(noKey || syncing, syncing)}>
          <Icon icon={RefreshCw} size={14} stroke="#7c3aed" />{syncing ? t.processing : t.aiSyncModels}
        </button>
      </div>
    </Card>
  );
}
