import { AlertTriangle } from 'lucide-react';
import { useApp } from '../../context/AppContext.tsx';
import { TONE_COLORS } from '../../statusTokens.ts';
import type { PostSchedule, ScheduleStatus } from '../../api/schedules.ts';
import { FILTERS, STATUS_TONE } from './statusMeta.ts';
import AgendaView from './AgendaView.tsx';

// Panel "Hàng đợi đăng bài" (cột phải, desktop/tablet — UI-07 redesign): pill tự động đăng,
// banner lối vào trang Bài lỗi (chỉ hiện khi có bài lỗi — thẻ KPI "Thất bại" luôn là lối vào),
// chip lọc trạng thái (giữ từ bản cũ) + danh sách nhóm theo ngày.
// StatusChips / FailedBanner / AutoPill xuất riêng để mobile dùng ngoài panel (panel bị bỏ ở mobile).

export function StatusChips({ value, onChange }: { value: ScheduleStatus | 'ALL'; onChange: (f: ScheduleStatus | 'ALL') => void }) {
  const { t } = useApp();
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      {FILTERS.map((f) => {
        const active = value === f;
        const tone = f === 'ALL' ? null : TONE_COLORS[STATUS_TONE[f]];
        return (
          <button
            key={f}
            onClick={() => onChange(f)}
            aria-pressed={active}
            style={{
              border: `1px solid ${active ? '#c4b5fd' : '#ece8f6'}`, borderRadius: 999, padding: '5px 11px',
              fontSize: 11.5, fontWeight: 700, cursor: 'pointer',
              background: active ? '#f1e9ff' : '#fff',
              color: active ? '#7c3aed' : tone ? tone.color : '#6b6680',
            }}
          >
            {f === 'ALL' ? t.schAll : t[`schSt${f}` as keyof typeof t] as string}
          </button>
        );
      })}
    </div>
  );
}

/** Lối vào trung tâm hồi phục bài lỗi (FR-35..FR-39) — xử lý vi phạm chính sách / lỗi kỹ thuật. */
export function FailedBanner({ count, onClick }: { count: number; onClick: () => void }) {
  const { t } = useApp();
  return (
    <button
      onClick={onClick}
      style={{ display: 'flex', alignItems: 'center', gap: 7, width: '100%', border: '1px solid #f2d9df', background: '#fdf5f7', borderRadius: 10, padding: '9px 12px', fontSize: 12.5, fontWeight: 700, color: '#c0356a', cursor: 'pointer' }}
    >
      <AlertTriangle size={14} aria-hidden="true" />
      {t.fpNavFailed}
      <span style={{ fontSize: 10.5, fontWeight: 800, background: '#c0356a', color: '#fff', borderRadius: 999, padding: '1px 7px' }}>{count}</span>
      <span style={{ marginLeft: 'auto' }} aria-hidden="true">›</span>
    </button>
  );
}

export function AutoPill({ count }: { count: number }) {
  const { t } = useApp();
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, fontWeight: 700, color: '#16a34a', background: '#e8f8ee', borderRadius: 999, padding: '4px 10px', width: 'fit-content' }}>
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#16a34a' }} />
      {t.calAuto}
      {count > 0 && <span>· {count}</span>}
    </span>
  );
}

export default function UpcomingPanel({ schedules, statusFilter, onStatusFilter, failedCount, onGoFailed, autoCount, selectedDay, onClearDay, busyId, confirmCancelId, onReschedule, onCancel, onEditContent }: {
  schedules: PostSchedule[];
  statusFilter: ScheduleStatus | 'ALL';
  onStatusFilter: (f: ScheduleStatus | 'ALL') => void;
  failedCount: number;
  onGoFailed: () => void;
  autoCount: number;
  selectedDay: string | null;
  onClearDay: () => void;
  busyId: string | null;
  confirmCancelId: string | null;
  onReschedule: (s: PostSchedule) => void;
  onCancel: (s: PostSchedule) => void;
  onEditContent: () => void;
}) {
  const { t } = useApp();
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        <div style={{ fontWeight: 700, fontSize: 16, color: '#211c38' }}>{t.schQueue}</div>
        <AutoPill count={autoCount} />
      </div>

      {failedCount > 0 && (
        <div style={{ marginBottom: 14 }}>
          <FailedBanner count={failedCount} onClick={onGoFailed} />
        </div>
      )}

      <div style={{ marginBottom: 14 }}>
        <StatusChips value={statusFilter} onChange={onStatusFilter} />
      </div>

      <AgendaView
        schedules={schedules}
        busyId={busyId}
        confirmCancelId={confirmCancelId}
        onReschedule={onReschedule}
        onCancel={onCancel}
        onEditContent={onEditContent}
        selectedDay={selectedDay}
        onClearDay={onClearDay}
      />
    </>
  );
}
