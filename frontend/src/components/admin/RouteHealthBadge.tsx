import { AlertTriangle } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import StatusBadge from './StatusBadge';
import { aiBlockReasonLabel, type AiModelBlockReason, type AiRouteHealth } from '../../api/adminAi';

/**
 * Badge sức khỏe một dòng định tuyến AI — DÙNG CHUNG cho cả 3 trang Cấu hình AI
 * (Provider / Model & định tuyến / Sử dụng). Nguồn dữ liệu duy nhất: GET /admin/ai/status.
 * Route tắt (enabled=false, health=null) hiển thị trung tính "Dùng env" — không phải sự cố.
 */
export default function RouteHealthBadge({
  health,
  enabled,
}: {
  health: AiRouteHealth | null;
  enabled: boolean;
}) {
  const { t } = useApp();
  if (!enabled || health == null) return <StatusBadge tone="neutral" label={t.aiHealthEnv} />;
  if (health === 'OK') return <StatusBadge tone="success" label={t.aiHealthOk} />;
  if (health === 'DEGRADED') return <StatusBadge tone="warning" label={t.aiHealthDegraded} />;
  return <StatusBadge tone="danger" label={t.aiHealthError} />;
}

/** Icon cảnh báo + tooltip lý do đặt cạnh model chính/dự phòng không dùng được. */
export function ModelBlockHint({ reason }: { reason: AiModelBlockReason | null }) {
  const { lang } = useApp();
  if (!reason) return null;
  return (
    <span
      title={aiBlockReasonLabel(lang, reason)}
      style={{ display: 'inline-flex', alignItems: 'center', marginLeft: 6, cursor: 'help', verticalAlign: 'middle' }}
    >
      <AlertTriangle size={13} stroke="#d97706" strokeWidth={2.4} />
    </span>
  );
}
