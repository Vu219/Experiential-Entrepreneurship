import { useApp } from '../../context/AppContext.tsx';
import type { PostSchedule } from '../../api/schedules.ts';
import ScheduleItem from './ScheduleItem.tsx';
import { absDayLabel, dayRel, groupByDay } from './dateUtils.ts';

// Danh sách lịch đăng nhóm theo ngày (UI-07 redesign): header "Hôm nay · 17 Tháng 7" + đếm,
// item giữ nguyên đầy đủ hành động của hàng đợi. Dùng cho view Agenda (cột trái)
// lẫn panel "Hàng đợi" (cột phải) — cùng một dữ liệu, hai khung nhìn.

export default function AgendaView({ schedules, busyId, confirmCancelId, onReschedule, onCancel, onEditContent, selectedDay, onClearDay }: {
  schedules: PostSchedule[];
  busyId: string | null;
  confirmCancelId: string | null;
  onReschedule: (s: PostSchedule) => void;
  onCancel: (s: PostSchedule) => void;
  onEditContent: () => void;
  selectedDay: string | null;
  onClearDay: () => void;
}) {
  const { t, lang } = useApp();

  if (schedules.length === 0) {
    return (
      <div style={{ padding: '24px 0', textAlign: 'center', fontSize: 13, color: '#8a85a0' }}>
        {selectedDay ? t.schEmptyDay : t.schEmpty}
        {selectedDay && (
          <div style={{ marginTop: 8 }}>
            <button onClick={onClearDay} style={clearBtn}>{t.schShowAll}</button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {groupByDay(schedules).map((g) => {
        const rel = dayRel(g.key);
        const relLabel = rel === 'today' ? t.calToday : rel === 'tomorrow' ? t.calTomorrow : null;
        const abs = absDayLabel(g.key, lang);
        return (
          <div key={g.key}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 7, marginBottom: 8 }}>
              <span style={{ fontFamily: "'Plus Jakarta Sans'", fontSize: 13, fontWeight: 800, color: rel === 'today' ? '#7c3aed' : '#4b4660' }}>
                {relLabel ?? abs}
              </span>
              {relLabel && <span style={{ fontSize: 11.5, fontWeight: 600, color: '#a59fbb' }}>· {abs}</span>}
              <span style={{ fontSize: 10.5, fontWeight: 800, background: '#f3f0fa', color: '#8a85a0', borderRadius: 999, padding: '1px 7px' }}>{g.items.length}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {g.items.map((s) => (
                <ScheduleItem
                  key={s.id}
                  schedule={s}
                  busy={busyId === s.id}
                  confirmingCancel={confirmCancelId === s.id}
                  onReschedule={onReschedule}
                  onCancel={onCancel}
                  onEditContent={onEditContent}
                />
              ))}
            </div>
          </div>
        );
      })}
      {selectedDay && <button onClick={onClearDay} style={clearBtn}>{t.schShowAll}</button>}
    </div>
  );
}

const clearBtn = {
  background: 'none', border: 'none', color: '#7c3aed', fontSize: 12.5, fontWeight: 700,
  cursor: 'pointer', padding: 0, width: 'fit-content',
} as const;
