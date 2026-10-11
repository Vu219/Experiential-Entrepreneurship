import { Link2, RotateCcw, ShieldAlert } from 'lucide-react';
import { useApp } from '../../context/AppContext.tsx';
import { TONE_COLORS } from '../../statusTokens.ts';
import { platformDisplayName, publishErrorCopy } from '../../api/publishErrorCatalog.ts';
import type { RootCauseGroup } from './rootCause.ts';
import { alpha, C } from '../../styles/colors';

// Gom nguyên nhân gốc: "3 bài lỗi vì token Instagram @aima.coffee hết hạn → Kết nối lại một lần để xử lý tất cả".
// Tài khoản chưa kết nối lại → nút dẫn tới Cài đặt → Kết nối; đã ACTIVE lại → "Thử lại N bài" (bulk retry).

const DANGER = TONE_COLORS.danger;

export default function RootCauseBanner({
  groups,
  busy,
  onReconnect,
  onRetryAll,
  onShow,
}: {
  groups: RootCauseGroup[];
  busy: boolean;
  onReconnect: () => void;
  onRetryAll: (group: RootCauseGroup) => void;
  onShow: (group: RootCauseGroup) => void;
}) {
  const { t, lang } = useApp();
  if (groups.length === 0) return null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {groups.map((g) => {
        const title = publishErrorCopy(lang, g.code, {
          platform: platformDisplayName(g.platformName), account: g.accountName,
        }).title;
        return (
          <div
            key={g.key}
            role="status"
            style={{
              display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', background: DANGER.bg,
              border: `1px solid ${alpha(DANGER.color, 0.2)}`, borderRadius: 12, padding: '11px 14px',
            }}
          >
            <ShieldAlert size={18} color={DANGER.color} strokeWidth={2} aria-hidden style={{ flex: 'none' }} />
            <div style={{ flex: 1, minWidth: 220, fontSize: 13, color: C.ink750, lineHeight: 1.5 }}>
              <strong>{t.fpRootCause.replace('{n}', String(g.postIds.length)).replace('{title}', title)}</strong>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                onClick={() => onShow(g)}
                className="btn-soft"
                style={{ border: `1px solid ${C.border}`, background: C.surface, borderRadius: 9, padding: '7px 12px', fontSize: 12.5, fontWeight: 700, color: C.ink600, cursor: 'pointer' }}
              >
                {t.fpRootCauseShow}
              </button>
              {g.accountReady ? (
                <button
                  onClick={() => onRetryAll(g)}
                  disabled={busy}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: 'none', background: DANGER.color, borderRadius: 9, padding: '7px 12px', fontSize: 12.5, fontWeight: 700, color: C.onBrand, cursor: busy ? 'wait' : 'pointer', opacity: busy ? 0.7 : 1 }}
                >
                  <RotateCcw size={13} strokeWidth={2.2} />
                  {t.fpRootCauseRetryAll.replace('{n}', String(g.postIds.length))}
                </button>
              ) : (
                <button
                  onClick={onReconnect}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: 'none', background: DANGER.color, borderRadius: 9, padding: '7px 12px', fontSize: 12.5, fontWeight: 700, color: C.onBrand, cursor: 'pointer' }}
                >
                  <Link2 size={13} strokeWidth={2.2} />
                  {t.fpRootCauseFix}
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
