import { useEffect, useMemo, useState } from 'react';
import { CalendarClock, ChevronDown } from 'lucide-react';
import { useApp } from '../../context/AppContext.tsx';
import type { PostSchedule } from '../../api/schedules.ts';
import ScheduleItem from './ScheduleItem.tsx';
import { absDayLabel, dayRel, groupByDay } from './dateUtils.ts';

interface ScheduleQueueListProps {
  schedules: PostSchedule[];
  busyId: string | null;
  confirmCancelId: string | null;
  onReschedule: (s: PostSchedule) => void;
  onCancel: (s: PostSchedule) => void;
  /** Mở đúng bài của lịch để sửa nội dung. */
  onEditContent: (schedule: PostSchedule) => void;
  selectedDay: string | null;
  onClearDay: () => void;
  onSelectSchedule: (s: PostSchedule) => void;
  /** Giới hạn số bài hiển thị mỗi lần (mặc định 8 bài). Bấm "Tải thêm bài viết cũ hơn" để mở rộng */
  initialLimit?: number;
}

const DEFAULT_PAGE_SIZE = 8;

export default function ScheduleQueueList({
  schedules,
  busyId,
  confirmCancelId,
  onReschedule,
  onCancel,
  onEditContent,
  selectedDay,
  onClearDay,
  onSelectSchedule,
  initialLimit = DEFAULT_PAGE_SIZE,
}: ScheduleQueueListProps) {
  const { t, lang } = useApp();
  const [displayCount, setDisplayCount] = useState<number>(initialLimit);

  // Đặt lại số lượng hiển thị khi danh sách hoặc bộ lọc ngày thay đổi
  useEffect(() => {
    setDisplayCount(initialLimit);
  }, [schedules.length, selectedDay, initialLimit]);

  // Nếu người dùng chọn ngày cụ thể thì cho phép hiển thị hết ngày đó
  const activeLimit = selectedDay ? schedules.length : displayCount;
  const visibleSchedules = useMemo(() => {
    return schedules.slice(0, activeLimit);
  }, [schedules, activeLimit]);

  const remainingCount = Math.max(0, schedules.length - visibleSchedules.length);

  const handleLoadMore = () => {
    setDisplayCount((prev) => prev + DEFAULT_PAGE_SIZE);
  };

  if (schedules.length === 0) {
    return (
      <div
        style={{
          padding: '36px 16px',
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 10,
        }}
      >
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            background: '#f4f1fb',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#7c3aed',
          }}
        >
          <CalendarClock size={22} />
        </div>
        <div style={{ fontSize: 13.5, fontWeight: 700, color: '#3f3a55' }}>
          {selectedDay ? t.schEmptyDay : t.schEmpty}
        </div>
        <div style={{ fontSize: 12, color: '#8a85a0', maxWidth: 240, lineHeight: 1.45 }}>
          {selectedDay
            ? (lang === 'en' ? 'No posts scheduled for this day.' : 'Không có bài đăng nào trong ngày này.')
            : (lang === 'en' ? 'Your queue is empty. Schedule new posts to see them here.' : 'Hàng đợi đang trống. Hãy lên lịch bài viết mới.')}
        </div>
        {selectedDay && (
          <button onClick={onClearDay} style={clearBtn}>
            {t.schShowAll}
          </button>
        )}
      </div>
    );
  }

  const grouped = groupByDay(visibleSchedules);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {grouped.map((g) => {
        const rel = dayRel(g.key);
        const relLabel = rel === 'today' ? t.calToday : rel === 'tomorrow' ? t.calTomorrow : null;
        const abs = absDayLabel(g.key, lang);
        return (
          <div key={g.key}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 7, marginBottom: 8, paddingLeft: 2 }}>
              <span
                style={{
                  fontFamily: "'Plus Jakarta Sans', sans-serif",
                  fontSize: 13,
                  fontWeight: 800,
                  color: rel === 'today' ? '#7c3aed' : '#4b4660',
                }}
              >
                {relLabel ?? abs}
              </span>
              {relLabel && (
                <span style={{ fontSize: 11.5, fontWeight: 600, color: '#a59fbb' }}>
                  · {abs}
                </span>
              )}
              <span
                style={{
                  fontSize: 10.5,
                  fontWeight: 800,
                  background: '#f3f0fa',
                  color: '#8a85a0',
                  borderRadius: 999,
                  padding: '1px 7px',
                }}
              >
                {g.items.length}
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
              {g.items.map((s) => (
                <ScheduleItem
                  key={s.id}
                  schedule={s}
                  busy={busyId === s.id}
                  confirmingCancel={confirmCancelId === s.id}
                  onReschedule={onReschedule}
                  onCancel={onCancel}
                  onEditContent={onEditContent}
                  onSelect={onSelectSchedule}
                />
              ))}
            </div>
          </div>
        );
      })}

      {/* Nút Xem thêm khi danh sách dài */}
      {!selectedDay && remainingCount > 0 && (
        <div style={{ paddingTop: 4, paddingBottom: 8, textAlign: 'center' }}>
          <button
            onClick={handleLoadMore}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              background: '#fbfaff',
              border: '1px dashed #dcd4f0',
              borderRadius: 12,
              padding: '9px 16px',
              fontSize: 12.5,
              fontWeight: 700,
              color: '#7c3aed',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#f4effe';
              e.currentTarget.style.borderColor = '#c4b5fd';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = '#fbfaff';
              e.currentTarget.style.borderColor = '#dcd4f0';
            }}
          >
            <ChevronDown size={15} />
            <span>
              {lang === 'en'
                ? `Load more older posts (${remainingCount} left)`
                : `Tải thêm bài viết cũ hơn (${remainingCount} bài viết)`}
            </span>
          </button>
        </div>
      )}

      {selectedDay && (
        <div style={{ paddingTop: 4 }}>
          <button onClick={onClearDay} style={clearBtn}>
            {t.schShowAll}
          </button>
        </div>
      )}
    </div>
  );
}

const clearBtn = {
  background: 'none',
  border: 'none',
  color: '#7c3aed',
  fontSize: 12.5,
  fontWeight: 700,
  cursor: 'pointer',
  padding: '4px 0',
  width: 'fit-content',
} as const;
