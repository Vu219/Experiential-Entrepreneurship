import type { CSSProperties, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { PlatformTag } from '../ui';
import { PLATFORM_BG } from '../../theme';
import { PLATFORM_TO_TAG } from '../../api/connections';
import type { Platform } from '../../api/brandProfile';
import type { Readiness } from './useReadiness';
import { C } from '../../styles/colors';
import { assistCardStyle } from './assistCardStyle';

// Mốc 3 — "sẵn sàng lên lịch" theo từng nền tảng (Phase 5): đã định dạng, có tài khoản đích, IG cần ảnh/video,
// brand voice dưới ngưỡng, bắt buộc duyệt. Mỗi mục thiếu có hành động sửa tại chỗ. Dữ liệu lấy từ useReadiness
// (cùng nguồn với chấm trạng thái trên tab). Chỉ là gợi ý UX — bước 4 vẫn cho vào và server kiểm lại mọi điều kiện.

const PLATFORM_NAME: Record<string, string> = { FACEBOOK: 'Facebook', INSTAGRAM: 'Instagram', THREADS: 'Threads' };

export default function ReadinessChecklist({ platforms, readiness, busy, onFormat, onApprove }: {
  platforms: Platform[];
  readiness: Readiness;
  busy: boolean;
  onFormat: (platform: Platform) => void;
  onApprove: () => void;
}) {
  const { t } = useApp();
  const navigate = useNavigate();
  const connect = () => navigate('/settings?tab=connections');
  const { settings } = readiness;

  return (
    <div style={{ ...assistCardStyle, borderRadius: 14, padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '.04em', color: C.accentText }}>{t.rdTitle}</div>
      {platforms.map((p) => {
        const r = readiness.byPlatform[p];
        const tag = PLATFORM_TO_TAG[p] ?? p.slice(0, 2);
        return (
          <div key={p} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <PlatformTag tag={tag} bg={PLATFORM_BG[tag] ?? '#6b7280'} size={20} radius={6} fontSize={9} />
              <span style={{ fontSize: 13, fontWeight: 700, color: C.textStrong }}>{PLATFORM_NAME[p]}</span>
            </div>
            {p === 'INSTAGRAM' ? (
              <Line tone="warn" text={t.rdIg} />
            ) : (
              <>
                <Line tone={r.formatted ? 'ok' : 'bad'} text={r.formatted ? t.rdFormatted : t.rdNotFormatted}
                  action={!r.formatted && <button type="button" disabled={busy} onClick={() => onFormat(p)} style={actionBtn}>{t.rdFormatNow}</button>} />
                {r.connected !== null && (
                  <Line tone={r.connected ? 'ok' : 'bad'} text={r.connected ? t.rdAccount : t.rdNoAccount}
                    action={!r.connected && <button type="button" onClick={connect} style={actionBtn}>{t.rdConnect}</button>} />
                )}
                {r.issues.includes('VOICE_LOW') && (
                  <Line tone="bad" text={t.rdVoiceLow.replace('{score}', String(r.version?.brandVoice.score ?? 0)).replace('{threshold}', String(settings?.brandVoiceThreshold))} />
                )}
              </>
            )}
          </div>
        );
      })}
      {readiness.approvalNeeded && (
        <Line tone="warn" text={t.rdApprovalNeeded}
          action={<button type="button" onClick={onApprove} style={actionBtn}>{t.rdApproveNow}</button>} />
      )}
    </div>
  );
}

function Line({ tone, text, action }: { tone: 'ok' | 'bad' | 'warn'; text: string; action?: ReactNode }) {
  const color = tone === 'ok' ? C.legacyText15803d : tone === 'bad' ? C.danger : C.amberText;
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
  border: `1px solid ${C.legacyBordere3d9fb}`, background: C.surface, color: C.primaryStrong, borderRadius: 999, padding: '4px 10px',
  fontSize: 11.5, fontWeight: 700, cursor: 'pointer', flex: 'none',
};
