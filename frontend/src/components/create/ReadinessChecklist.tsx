import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { PlatformTag } from '../ui';
import { PLATFORM_BG } from '../../theme';
import { PLATFORM_TO_TAG, listConnections } from '../../api/connections';
import { getPublishingSettings, type PublishingSettings } from '../../api/schedules';
import type { Platform } from '../../api/brandProfile';
import type { ContentVersion, SaveReviewChoice } from '../../api/contentCreationService';

// Mốc 3 — "sẵn sàng lên lịch" theo từng nền tảng (Phase 5): đã định dạng, có tài khoản đích, IG cần ảnh/video,
// brand voice dưới ngưỡng, bắt buộc duyệt. Mỗi mục thiếu có hành động sửa tại chỗ. Chỉ là gợi ý UX —
// bước 4 vẫn cho vào (chỉ gửi nền tảng đủ điều kiện) và server kiểm lại mọi điều kiện.

const PLATFORM_NAME: Record<string, string> = { FACEBOOK: 'Facebook', INSTAGRAM: 'Instagram', THREADS: 'Threads' };

export default function ReadinessChecklist({ platforms, versions, status, busy, onFormat, onApprove }: {
  platforms: Platform[];
  versions: ContentVersion[];
  status: SaveReviewChoice;
  busy: boolean;
  onFormat: (platform: Platform) => void;
  onApprove: () => void;
}) {
  const { t } = useApp();
  const navigate = useNavigate();
  const [connected, setConnected] = useState<Set<Platform> | null>(null);
  const [settings, setSettings] = useState<PublishingSettings | null>(null);

  useEffect(() => {
    listConnections()
      .then((conns) => setConnected(new Set(conns
        .filter((c) => c.connectionStatus === 'ACTIVE' && !(c.platform === 'FACEBOOK' && c.accountType !== 'PAGE'))
        .map((c) => c.platform as Platform))))
      .catch(() => setConnected(null));
    getPublishingSettings().then(setSettings).catch(() => setSettings(null));
  }, []);

  const connect = () => navigate('/settings?tab=connections');
  const approvalNeeded = !!settings?.requireApproval && status !== 'APPROVED';

  return (
    <div style={{ background: '#faf8fe', border: '1px solid #f1edfa', borderRadius: 14, padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '.04em', color: '#a59fbb' }}>{t.rdTitle}</div>
      {platforms.map((p) => {
        const v = versions.find((x) => x.platform === p);
        const tag = PLATFORM_TO_TAG[p] ?? p.slice(0, 2);
        const formatted = v?.status === 'FORMATTED';
        const voiceLow = !!settings?.brandVoiceBlockingEnabled && settings.brandVoiceThreshold != null
          && (v?.brandVoice.score ?? 0) < settings.brandVoiceThreshold;
        return (
          <div key={p} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <PlatformTag tag={tag} bg={PLATFORM_BG[tag] ?? '#6b7280'} size={20} radius={6} fontSize={9} />
              <span style={{ fontSize: 13, fontWeight: 700, color: '#211c38' }}>{PLATFORM_NAME[p]}</span>
            </div>
            {p === 'INSTAGRAM' ? (
              <Line tone="warn" text={t.rdIg} />
            ) : (
              <>
                <Line tone={formatted ? 'ok' : 'bad'} text={formatted ? t.rdFormatted : t.rdNotFormatted}
                  action={!formatted && <button type="button" disabled={busy} onClick={() => onFormat(p)} style={actionBtn}>{t.rdFormatNow}</button>} />
                {connected && (
                  <Line tone={connected.has(p) ? 'ok' : 'bad'} text={connected.has(p) ? t.rdAccount : t.rdNoAccount}
                    action={!connected.has(p) && <button type="button" onClick={connect} style={actionBtn}>{t.rdConnect}</button>} />
                )}
                {voiceLow && (
                  <Line tone="bad" text={t.rdVoiceLow.replace('{score}', String(v?.brandVoice.score ?? 0)).replace('{threshold}', String(settings?.brandVoiceThreshold))} />
                )}
              </>
            )}
          </div>
        );
      })}
      {approvalNeeded && (
        <Line tone="warn" text={t.rdApprovalNeeded}
          action={<button type="button" onClick={onApprove} style={actionBtn}>{t.rdApproveNow}</button>} />
      )}
    </div>
  );
}

function Line({ tone, text, action }: { tone: 'ok' | 'bad' | 'warn'; text: string; action?: ReactNode }) {
  const color = tone === 'ok' ? '#15803d' : tone === 'bad' ? '#e23d6e' : '#b45309';
  const IconCmp = tone === 'ok' ? CheckCircle2 : tone === 'bad' ? XCircle : AlertTriangle;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12.5, color, paddingLeft: 28 }}>
      <IconCmp size={14} aria-hidden="true" style={{ flex: 'none' }} />
      <span style={{ flex: 1, lineHeight: 1.45 }}>{text}</span>
      {action}
    </div>
  );
}

const actionBtn: CSSProperties = {
  border: '1px solid #e3d9fb', background: '#fff', color: '#6d28d9', borderRadius: 999, padding: '4px 10px',
  fontSize: 11.5, fontWeight: 700, cursor: 'pointer', flex: 'none',
};
