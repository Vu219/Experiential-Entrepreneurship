import { memo } from 'react';
import { Clock, PencilLine, RotateCcw, Trash2 } from 'lucide-react';
import { useApp } from '../../context/AppContext.tsx';
import { PlatformTag } from '../ui.tsx';
import { PLATFORM_BG } from '../../theme.ts';
import { TONE_COLORS } from '../../statusTokens.ts';
import { PLATFORM_TO_TAG } from '../../api/connections.ts';
import type { PostSchedule } from '../../api/schedules.ts';
import { fmtDate, fmtTime } from './dateUtils.ts';
import { STATUS_TONE } from './statusMeta.ts';

// Một dòng lịch đăng trong hàng đợi (UI-07) — tách từ pages/app/Calendar.tsx:
// giờ + ngày | nền tảng | caption + tài khoản | badge trạng thái; hint và hành động theo state machine.
// Callback nhận schedule để danh sách dùng chung 1 handler (không tạo closure mỗi item — rule hiệu năng FE).

function ScheduleItemBase({ schedule: s, busy, confirmingCancel, onReschedule, onCancel, onEditContent }: {
  schedule: PostSchedule;
  busy: boolean;
  confirmingCancel: boolean;
  onReschedule: (s: PostSchedule) => void;
  onCancel: (s: PostSchedule) => void;
  onEditContent: () => void;
}) {
  const { t } = useApp();
  const tone = TONE_COLORS[STATUS_TONE[s.status]];
  const tag = PLATFORM_TO_TAG[s.platformName] ?? s.platformName.slice(0, 2);
  const caption = s.contentVersion?.formattedCaption ?? '';
  const canReschedule = s.status === 'SCHEDULED' || s.status === 'ON_HOLD';
  const canCancel = canReschedule || s.status === 'FAILED';

  return (
    <div style={{ border: '1px solid #efeaf8', borderRadius: 14, padding: 13, background: '#fcfbfe', opacity: busy ? 0.6 : 1 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
        <div style={{ textAlign: 'center', flex: 'none', width: 50 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: '#211c38' }}>{fmtTime(s.scheduledTime)}</div>
          <div style={{ fontSize: 10.5, color: '#a59fbb' }}>{fmtDate(s.scheduledTime)}</div>
        </div>
        <div style={{ width: 1, alignSelf: 'stretch', background: '#efeaf8' }} />
        <PlatformTag tag={tag} bg={PLATFORM_BG[tag] ?? '#6b7280'} size={30} radius={8} fontSize={11} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#2b2543', lineHeight: 1.35, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {caption || t.schNoCaption}
          </div>
          <div style={{ fontSize: 11, color: '#a59fbb', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.platformAccountName}</div>
        </div>
        <span style={{ flex: 'none', fontSize: 10.5, fontWeight: 800, padding: '3px 9px', borderRadius: 999, color: tone.color, background: tone.bg }}>
          {t[`schSt${s.status}` as keyof typeof t] as string}
        </span>
      </div>

      {(s.status === 'ON_HOLD' || s.status === 'FAILED') && (
        <div style={{ fontSize: 11.5, color: s.status === 'FAILED' ? '#b91c1c' : '#b45309', background: s.status === 'FAILED' ? '#fdf1f1' : '#fdf6e7', borderRadius: 9, padding: '7px 10px', marginTop: 9, lineHeight: 1.45 }}>
          {s.status === 'ON_HOLD' ? t.schOnHoldHint : t.schFailedHint}
        </div>
      )}

      {(canReschedule || canCancel) && (
        <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
          {canReschedule && (
            <ActionBtn icon={<Clock size={13} />} label={s.status === 'ON_HOLD' ? t.schReactivate : t.schReschedule} onClick={() => onReschedule(s)} disabled={busy} />
          )}
          {s.status === 'FAILED' && (
            <ActionBtn icon={<PencilLine size={13} />} label={t.schEditContent} onClick={onEditContent} disabled={busy} />
          )}
          {canCancel && (
            <ActionBtn
              icon={s.status === 'FAILED' ? <RotateCcw size={13} /> : <Trash2 size={13} />}
              label={confirmingCancel ? t.schConfirmCancel : s.status === 'FAILED' ? t.schResetFailed : t.schCancel}
              onClick={() => onCancel(s)}
              disabled={busy}
              danger={!confirmingCancel}
              emphasized={confirmingCancel}
            />
          )}
        </div>
      )}
    </div>
  );
}

export default memo(ScheduleItemBase);

function ActionBtn({ icon, label, onClick, disabled, danger = false, emphasized = false }: {
  icon: React.ReactNode; label: string; onClick: () => void; disabled?: boolean; danger?: boolean; emphasized?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        display: 'flex', alignItems: 'center', gap: 5, border: `1px solid ${emphasized ? '#e23d6e' : '#ece8f6'}`,
        borderRadius: 9, padding: '6px 11px', fontSize: 12, fontWeight: 700,
        background: emphasized ? '#e23d6e' : '#fff',
        color: emphasized ? '#fff' : danger ? '#e23d6e' : '#5b5670',
        cursor: disabled ? 'default' : 'pointer',
      }}
    >
      {icon}
      {label}
    </button>
  );
}
