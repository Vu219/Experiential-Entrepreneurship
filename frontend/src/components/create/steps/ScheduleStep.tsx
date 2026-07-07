import { CalendarClock } from 'lucide-react';
import { useApp } from '../../../context/AppContext';
import { Card, Icon } from '../../ui';
import type { ContentVersion } from '../../../api/contentCreationService';
import StepLayout from '../StepLayout';
import PostImagePreview from '../PostImagePreview';

/**
 * Mốc 5 — Lên lịch đăng bài: hiển thị trong timeline nhưng ở trạng thái "sắp có".
 * Nút disabled + tooltip; handler đã chừa sẵn để sau nối sang tab Lịch đăng bài
 * (go('calendar') — bỏ disabled khi tính năng sẵn sàng). Giữ khung 2 cột StepLayout
 * cho đồng nhất — cột phải là preview bản vừa duyệt (nếu có).
 */
export default function ScheduleStep({
  version,
  brandName,
}: {
  version: ContentVersion | null;
  brandName: string;
}) {
  const { t, go, brandGradient } = useApp();

  // TODO(schedule): khi tính năng lên lịch sẵn sàng — bỏ disabled và điều hướng kèm
  // id nội dung vừa lưu sang tab Lịch đăng bài.
  const goSchedule = () => go('calendar');
  void goSchedule;

  const mainCard = (
    <Card style={{ textAlign: 'center', padding: 36 }}>
      <div style={{ width: 64, height: 64, borderRadius: 18, background: 'linear-gradient(150deg,#f6f2ff,#fcf1fc)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
        <Icon icon={CalendarClock} size={28} stroke="#a78bfa" />
      </div>
      <div style={{ fontFamily: "'Plus Jakarta Sans'", fontWeight: 800, fontSize: 17, color: '#211c38' }}>{t.cwScheduleTitle}</div>
      <div style={{ fontSize: 13, color: '#8a85a0', margin: '8px auto 20px', maxWidth: 380, lineHeight: 1.55 }}>{t.cwScheduleSoon}</div>
      <button
        disabled
        title={t.cwStepSoon}
        style={{ border: 'none', borderRadius: 12, padding: '13px 26px', fontWeight: 700, fontSize: 14, color: '#fff', background: brandGradient, cursor: 'not-allowed', opacity: 0.5 }}
      >
        {t.cwScheduleBtn}
      </button>
    </Card>
  );

  return <StepLayout main={mainCard} side={<PostImagePreview version={version} brandName={brandName} />} />;
}
