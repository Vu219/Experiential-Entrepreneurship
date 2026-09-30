import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarCheck2, List, PlusCircle } from 'lucide-react';
import { useApp } from '../../../context/AppContext';
import { Card, Icon } from '../../ui';
import type { ContentVersion } from '../../../api/contentCreationService';
import type { ScheduleBatchResult } from '../../../api/schedules';
import StepLayout from '../StepLayout';
import PostImagePreview from '../PostImagePreview';
import SchedulePlanner from '../../schedule/SchedulePlanner';

/**
 * Mốc 4 — Lên lịch đăng bài ngay trong wizard (Phase 5): SchedulePlanner dùng chung, một dòng mỗi nền tảng,
 * chỉ gửi dòng đủ điều kiện. Mọi dòng thành công → màn "Đã lên lịch" với Xem lịch (mở đúng ngày) / Tạo bài mới /
 * Về danh sách; còn dòng lỗi thì ở lại để sửa và thử lại. Cột phải preview bản đã định dạng.
 */
export default function ScheduleStep({
  itemId,
  version,
  brandName,
  onScheduled,
}: {
  itemId: string;
  version: ContentVersion | null;
  brandName: string;
  /** Có ít nhất một nền tảng đã lên lịch → wizard khóa bước 1–3 (chỉ đọc). */
  onScheduled: () => void;
}) {
  const { t, brandGradient } = useApp();
  const navigate = useNavigate();
  const [done, setDone] = useState<ScheduleBatchResult | null>(null);

  const handleSubmitted = (result: ScheduleBatchResult) => {
    if (result.succeeded > 0) onScheduled();
    if (result.failed === 0) setDone(result);
  };

  // Ngày của lịch đầu tiên vừa tạo (giờ theo múi giờ đăng) — Lịch đăng mở thẳng ngày đó.
  const firstDay = done?.rows.find((r) => r.schedule)?.schedule?.scheduledTime.slice(0, 10);

  const mainCard = done ? (
    <Card style={{ textAlign: 'center', padding: 36 }}>
      <div style={{ width: 64, height: 64, borderRadius: 18, background: 'linear-gradient(150deg,#effcf3,#f1fbf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
        <Icon icon={CalendarCheck2} size={28} stroke="#16a34a" />
      </div>
      <div style={{ fontFamily: "'Plus Jakarta Sans'", fontWeight: 800, fontSize: 17, color: '#211c38' }}>{t.cwScheduledTitle}</div>
      <div style={{ fontSize: 13, color: '#8a85a0', margin: '8px auto 20px', maxWidth: 400, lineHeight: 1.55 }}>
        {t.cwScheduledSub.replace('{n}', String(done.succeeded))}
      </div>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
        <button onClick={() => navigate(firstDay ? `/calendar?day=${firstDay}` : '/calendar')} className="btn-grad"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 7, border: 'none', borderRadius: 12, padding: '12px 22px', fontWeight: 700, fontSize: 14, color: '#fff', background: brandGradient, cursor: 'pointer' }}>
          <Icon icon={CalendarCheck2} size={15} stroke="#fff" />{t.cwViewCalendar}
        </button>
        <button onClick={() => navigate('/create/new')} className="btn-soft"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 7, border: '1px solid #ece8f6', background: '#fff', borderRadius: 12, padding: '12px 18px', fontWeight: 700, fontSize: 14, color: '#574f6e', cursor: 'pointer' }}>
          <Icon icon={PlusCircle} size={15} stroke="#574f6e" />{t.cwNewPost}
        </button>
        <button onClick={() => navigate('/create')} className="btn-soft"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 7, border: '1px solid #ece8f6', background: '#fff', borderRadius: 12, padding: '12px 18px', fontWeight: 700, fontSize: 14, color: '#574f6e', cursor: 'pointer' }}>
          <Icon icon={List} size={15} stroke="#574f6e" />{t.cwBackToList}
        </button>
      </div>
    </Card>
  ) : (
    <Card style={{ padding: 22 }}>
      <div style={{ fontFamily: "'Plus Jakarta Sans'", fontWeight: 800, fontSize: 17, color: '#211c38', marginBottom: 4 }}>{t.cwScheduleTitle}</div>
      <div style={{ fontSize: 12.5, color: '#8a85a0', marginBottom: 14, lineHeight: 1.5 }}>{t.cwScheduleSub}</div>
      <SchedulePlanner itemId={itemId} onSubmitted={handleSubmitted} onConnect={() => navigate('/settings?tab=connections')} />
    </Card>
  );

  return <StepLayout main={mainCard} side={<PostImagePreview version={version} brandName={brandName} />} />;
}
