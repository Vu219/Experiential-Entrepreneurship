import { CalendarClock } from 'lucide-react';
import { useApp } from '../../../context/AppContext';
import { Card, Icon } from '../../ui';
import type { ContentVersion } from '../../../api/contentCreationService';
import StepLayout from '../StepLayout';
import PostImagePreview from '../PostImagePreview';

/**
 * Mốc 6 — Lên lịch đăng bài: nội dung đã được định dạng (bản FORMATTED) nên có thể lên lịch.
 * Việc chọn tài khoản đích + khung giờ (kèm gợi ý giờ vàng) nằm ở tab Lịch đăng bài (UI-07) —
 * mốc này mở sang đó. Giữ khung 2 cột StepLayout — cột phải preview bản đã định dạng (nếu có).
 */
export default function ScheduleStep({
  version,
  brandName,
}: {
  version: ContentVersion | null;
  brandName: string;
}) {
  const { t, go, brandGradient } = useApp();

  const goSchedule = () => go('calendar');

  const mainCard = (
    <Card style={{ textAlign: 'center', padding: 36 }}>
      <div style={{ width: 64, height: 64, borderRadius: 18, background: 'linear-gradient(150deg,#f6f2ff,#fcf1fc)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
        <Icon icon={CalendarClock} size={28} stroke="#a78bfa" />
      </div>
      <div style={{ fontFamily: "'Plus Jakarta Sans'", fontWeight: 800, fontSize: 17, color: '#211c38' }}>{t.cwScheduleTitle}</div>
      <div style={{ fontSize: 13, color: '#8a85a0', margin: '8px auto 20px', maxWidth: 380, lineHeight: 1.55 }}>{t.cwScheduleSoon}</div>
      <button
        onClick={goSchedule}
        className="btn-grad"
        style={{ border: 'none', borderRadius: 12, padding: '13px 26px', fontWeight: 700, fontSize: 14, color: '#fff', background: brandGradient, boxShadow: '0 14px 28px -12px rgba(139,92,246,.6)', cursor: 'pointer' }}
      >
        {t.cwScheduleBtn}
      </button>
    </Card>
  );

  return <StepLayout main={mainCard} side={<PostImagePreview version={version} brandName={brandName} />} />;
}
