import type { LucideIcon } from 'lucide-react';
import { AlertTriangle, CalendarClock, CheckCircle2, ChevronRight, Minus, PauseCircle, TrendingDown, TrendingUp } from 'lucide-react';
import { Card, Icon, cardStyle } from '../ui.tsx';
import { TONE_COLORS, type Tone } from '../../statusTokens.ts';
import { useApp } from '../../context/AppContext.tsx';

// Hàng 4 thẻ thống kê lịch đăng (UI-07): icon chip bên trái, cột nội dung bên phải
// (số → nhãn → dòng so với tuần trước). Đếm client-side từ list /schedules.
// Dòng so kỳ CHỈ hiện ở thẻ "Đã đăng" — trạng thái POSTED là lịch sử bất biến nên đếm được
// theo cửa sổ 7 ngày; SCHEDULED/ON_HOLD là snapshot hàng đợi và FAILED bị mất khỏi lịch sử
// khi user hủy/lên lịch lại → không có dữ liệu so kỳ đáng tin, tuyệt đối không bịa số.
// Các thẻ không có dòng so kỳ vẫn chừa đúng chiều cao dòng để 4 thẻ bằng nhau.
// Thẻ "Thất bại" là lối vào trang Bài lỗi & cần xử lý (FR-35..39) nên render dạng button.

export interface ScheduleCounts { scheduled: number; onHold: number; failed: number; posted: number }

/** Chênh lệch số bài ĐÃ ĐĂNG: 7 ngày gần nhất so với 7 ngày liền trước (cửa sổ trượt từ hiện tại). */
export interface PostedDelta { current: number; previous: number }

const DELTA_LINE_HEIGHT = 18;

function DeltaLine({ delta }: { delta: PostedDelta | null }) {
  const { t } = useApp();
  if (!delta) return <div aria-hidden="true" style={{ height: DELTA_LINE_HEIGHT }} />;
  const diff = delta.current - delta.previous;
  const color = diff > 0 ? TONE_COLORS.success.color : diff < 0 ? TONE_COLORS.danger.color : TONE_COLORS.neutral.color;
  const TrendIcon = diff > 0 ? TrendingUp : diff < 0 ? TrendingDown : Minus;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, height: DELTA_LINE_HEIGHT, fontSize: 11.5, fontWeight: 700, color }}>
      <TrendIcon size={12} aria-hidden="true" />
      {diff > 0 ? `+${diff}` : String(diff)}
      <span style={{ fontWeight: 600, color: '#a59fbb' }}>{t.calVsLastWeek}</span>
    </div>
  );
}

function StatBody({ icon, tone, value, label, delta, arrow = false }: {
  icon: LucideIcon; tone: Tone; value: number; label: string; delta: PostedDelta | null; arrow?: boolean;
}) {
  const c = TONE_COLORS[tone];
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 13 }}>
      <div style={{ width: 40, height: 40, borderRadius: 11, background: c.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
        <Icon icon={icon} stroke={c.color} />
      </div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontFamily: "'Plus Jakarta Sans'", fontWeight: 800, fontSize: 24, lineHeight: 1.15, color: '#211c38' }}>{value}</div>
        <div style={{ fontSize: 13, color: '#8a85a0', margin: '2px 0 5px' }}>{label}</div>
        <DeltaLine delta={delta} />
      </div>
      {arrow && <ChevronRight size={16} color="#a59fbb" aria-hidden="true" style={{ flex: 'none', marginTop: 2 }} />}
    </div>
  );
}

export default function StatCards({ counts, postedDelta, onFailedClick }: {
  counts: ScheduleCounts;
  postedDelta: PostedDelta;
  onFailedClick: () => void;
}) {
  const { t } = useApp();
  return (
    <div className="grid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16 }}>
      <Card style={statCard}>
        <StatBody icon={CalendarClock} tone="purple" value={counts.scheduled} label={t.schStSCHEDULED} delta={null} />
      </Card>
      <Card style={statCard}>
        <StatBody icon={PauseCircle} tone="warning" value={counts.onHold} label={t.schStON_HOLD} delta={null} />
      </Card>
      <button
        onClick={onFailedClick}
        aria-label={t.fpNavFailed}
        className="lift-card"
        style={{ ...cardStyle, ...statCard, font: 'inherit', textAlign: 'left', cursor: 'pointer', width: '100%', display: 'block' }}
      >
        <StatBody icon={AlertTriangle} tone="danger" value={counts.failed} label={t.schStFAILED} delta={null} arrow />
      </button>
      <Card style={statCard}>
        <StatBody icon={CheckCircle2} tone="success" value={counts.posted} label={t.schStPOSTED} delta={postedDelta} />
      </Card>
    </div>
  );
}

const statCard = { padding: 18, borderRadius: 18 } as const;
