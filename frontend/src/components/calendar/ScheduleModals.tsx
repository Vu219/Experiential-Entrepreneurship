import { getPublishingTimezone } from '../../utils/publishingTime';
import { useState } from 'react';
import { useApp } from '../../context/AppContext.tsx';
import { useBreakpoint } from '../../hooks/useBreakpoint.ts';
import Modal from '../Modal.tsx';
import DaySheet from './DaySheet.tsx';
import SchedulePlanner from '../schedule/SchedulePlanner.tsx';
import { updateSchedule, type PostSchedule } from '../../api/schedules.ts';
import { nowLocal } from './dateUtils.ts';
import { C } from '../../styles/colors';

// Modal "Lên lịch đăng" (FR-47 + khung giờ vàng FR-48 — nay là vỏ của SchedulePlanner dùng chung) và
// modal "Dời giờ / Kích hoạt lại" (FR-50).
// Nghiệp vụ giữ nguyên: chỉ bản FORMATTED, tài khoản ACTIVE cùng nền tảng, giờ đăng phải ở tương lai
// (server kiểm lại mọi điều kiện); mobile (<760) chuyển thành bottom sheet.

export function CreateScheduleModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { t, go } = useApp();
  const { isMobile } = useBreakpoint();
  // Phase 4: dùng chung SchedulePlanner (chọn bài → một dòng mỗi nền tảng → gửi batch). Đóng khi mọi dòng thành
  // công; còn dòng lỗi thì giữ modal để người dùng sửa/thử lại (dòng thành công không bị gửi lại).
  const planner = (
    <SchedulePlanner
      onConnect={() => { onClose(); go('settings'); }}
      onSubmitted={(result) => { if (result.failed === 0) onCreated(); }}
    />
  );
  if (isMobile) {
    return <DaySheet title={t.schNew} subtitle={t.schNewSub} onClose={onClose}>{planner}</DaySheet>;
  }
  return <Modal title={t.schNew} subtitle={t.schNewSub} onClose={onClose} maxWidth={860}>{planner}</Modal>;
}

export function RescheduleModal({ schedule, onClose, onSaved }: { schedule: PostSchedule; onClose: () => void; onSaved: () => void }) {
  const { t } = useApp();
  const [time, setTime] = useState(schedule.scheduledTime.slice(0, 16));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (time <= nowLocal()) {
      setError(t.schErrPast);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await updateSchedule(schedule.id, `${time}:00`);
      onSaved();
    } catch (e) {
      setError(e instanceof RangeError ? t.schTimeInvalid : (e as Error).message);
      setSaving(false);
    }
  };

  return (
    <Modal
      title={schedule.status === 'ON_HOLD' ? t.schReactivate : t.schReschedule}
      subtitle={`${schedule.status === 'ON_HOLD' ? `${t.schReactivateSub} · ` : ''}${t.schTimezone}: ${getPublishingTimezone()}`}
      onClose={onClose}
      maxWidth={420}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <label style={lbl}>{t.schTime}</label>
          <input type="datetime-local" value={time} min={nowLocal()} onChange={(e) => setTime(e.target.value)} style={inp} />
        </div>
        {error && <div style={{ fontSize: 12.5, color: C.rose, background: C.roseSoft, borderRadius: 9, padding: '8px 11px' }}>{error}</div>}
        <button
          onClick={submit}
          disabled={saving}
          style={{ border: 'none', borderRadius: 11, padding: '11px 16px', fontWeight: 800, fontSize: 14, color: C.onBrand, background: 'var(--brand-gradient)', cursor: 'pointer', opacity: saving ? 0.55 : 1 }}
        >
          {saving ? t.schCreating : t.schSave}
        </button>
      </div>
    </Modal>
  );
}

const lbl = { display: 'block', fontSize: 12.5, fontWeight: 700, color: C.ink650, marginBottom: 6 } as const;
const inp = { width: '100%', border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 12px', fontSize: 13.5, color: C.textStrong, background: C.surface, outline: 'none' } as const;
