import { C } from '../../styles/colors';
import type { CSSProperties } from 'react';
import { AlertTriangle, Info } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import type { AiEffectiveStatus } from '../../api/adminAi';

const bannerStyle = (tone: 'danger' | 'warning' | 'info'): CSSProperties => ({
  display: 'flex',
  alignItems: 'flex-start',
  gap: 10,
  padding: '11px 14px',
  borderRadius: 10,
  fontSize: 13,
  fontWeight: 600,
  color: tone === 'danger' ? C.danger : tone === 'warning' ? C.amberText : C.info,
  background: tone === 'danger' ? C.dangerSoft : tone === 'warning' ? C.warningSoft : C.infoSoft,
});

/**
 * Banner tổng effective status cấu hình AI — dùng chung cho 3 trang Cấu hình AI:
 * (1) cảnh báo khi AI_CONFIG_FROM_DB tắt (config DB vô hiệu, usage không được ghi);
 * (2) đếm số nghiệp vụ lỗi / suy giảm. Không hiển thị gì khi mọi thứ bình thường.
 */
export default function AiStatusBanner({ status }: { status: AiEffectiveStatus | null }) {
  const { t } = useApp();
  if (!status) return null;

  const parts: string[] = [];
  if (status.errorCount > 0) parts.push(t.aiBannerErr.replace('{n}', String(status.errorCount)));
  if (status.degradedCount > 0) parts.push(t.aiBannerDegraded.replace('{n}', String(status.degradedCount)));

  if (!parts.length && status.fromDb) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {!status.fromDb && (
        <div style={bannerStyle('info')}>
          <Info size={16} strokeWidth={2.4} style={{ flex: 'none', marginTop: 1 }} />
          <span>{t.aiFromDbOff}</span>
        </div>
      )}
      {parts.length > 0 && (
        <div style={bannerStyle(status.errorCount > 0 ? 'danger' : 'warning')}>
          <AlertTriangle size={16} strokeWidth={2.4} style={{ flex: 'none', marginTop: 1 }} />
          <span>{parts.join(' · ')}</span>
        </div>
      )}
    </div>
  );
}
