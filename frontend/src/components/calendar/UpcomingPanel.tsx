import { AlertTriangle } from 'lucide-react';
import { useApp } from '../../context/AppContext.tsx';
import { TONE_COLORS } from '../../statusTokens.ts';
import type { PostSchedule, ScheduleStatus } from '../../api/schedules.ts';
import { FILTERS, STATUS_TONE } from './statusMeta.ts';
import ScheduleQueueList from './ScheduleQueueList.tsx';
import { C } from '../../styles/colors';

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
              border: `1px solid ${active ? C.legacyBorderc4b5fd : C.border}`, borderRadius: 999, padding: '5px 11px',
              fontSize: 11.5, fontWeight: 700, cursor: 'pointer',
              background: active ? C.purpleSoft : C.surface,
              color: active ? C.primary : tone ? tone.color : C.textSecondary,
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
      style={{ display: 'flex', alignItems: 'center', gap: 7, width: '100%', border: `1px solid ${C.legacyBorderf2d9df}`, background: C.legacyBgfdf5f7, borderRadius: 10, padding: '9px 12px', fontSize: 12.5, fontWeight: 700, color: C.legacyTextc0356a, cursor: 'pointer' }}
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
    <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, fontWeight: 700, color: C.success, background: C.successSoft, borderRadius: 999, padding: '4px 10px', width: 'fit-content' }}>
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#16a34a' }} />
      {t.calAuto}
      {count > 0 && <span>· {count}</span>}
    </span>
  );
}


export default function UpcomingPanel({
  schedules,
  statusFilter,
  onStatusFilter,
  failedCount,
  onGoFailed,
  autoCount,
  selectedDay,
  onClearDay,
  busyId,
  confirmCancelId,
  onReschedule,
  onCancel,
  onEditContent,
  onSelectSchedule,
}: {
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
  /** Mở đúng bài của lịch để sửa nội dung. */
  onEditContent: (schedule: PostSchedule) => void;
  onSelectSchedule: (s: PostSchedule) => void;
}) {
  const { t } = useApp();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      {/* Header cố định của Hàng đợi (flex-shrink-0) */}
      <div className="flex-shrink-0" style={{ flexShrink: 0, marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
          <div style={{ fontWeight: 800, fontSize: 16.5, color: C.textStrong, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            {t.schQueue}
          </div>
          <AutoPill count={autoCount} />
        </div>

        {failedCount > 0 && (
          <div style={{ marginBottom: 10 }}>
            <FailedBanner count={failedCount} onClick={onGoFailed} />
          </div>
        )}

        <div>
          <StatusChips value={statusFilter} onChange={onStatusFilter} />
        </div>
      </div>

      {/* Vùng danh sách bài viết cuộn nội bộ (flex-1 overflow-y-auto) */}
      <div
        className="flex-1 overflow-y-auto custom-scrollbar scrollbar-thin scrollbar-thumb-slate-200"
        style={{
          flex: '1 1 0%',
          minHeight: 0,
          overflowY: 'auto',
          paddingRight: 6,
          marginTop: 2,
        }}
      >
        <ScheduleQueueList
          schedules={schedules}
          busyId={busyId}
          confirmCancelId={confirmCancelId}
          onReschedule={onReschedule}
          onCancel={onCancel}
          onEditContent={onEditContent}
          selectedDay={selectedDay}
          onClearDay={onClearDay}
          onSelectSchedule={onSelectSchedule}
        />
      </div>
    </div>
  );
}

