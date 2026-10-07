import { useMemo, type CSSProperties } from 'react';
import { ChevronDown, Globe } from 'lucide-react';
import { useApp } from '../../context/AppContext.tsx';
import { C } from '../../styles/colors';

// Dropdown múi giờ của SchedulePlanner (text + chevron). Chỉ áp cho lần lên lịch đang mở — không đổi cài đặt tài
// khoản; khác múi giờ tài khoản thì hiện dòng nhắc ngay cạnh.

// Danh sách IANA của trình duyệt (lib TS của dự án chưa khai báo Intl.supportedValuesOf — ES2022).
const intl = Intl as typeof Intl & { supportedValuesOf?: (key: 'timeZone') => string[] };

export default function TimezoneSelect({ value, accountZone, onChange }: {
  value: string;
  /** Múi giờ trong cài đặt tài khoản (mặc định mỗi lần mở planner). */
  accountZone: string;
  onChange: (zone: string) => void;
}) {
  const { t } = useApp();
  const zones = useMemo(() => {
    const list = intl.supportedValuesOf ? intl.supportedValuesOf('timeZone') : [];
    return [...new Set([accountZone, value, ...list])].sort();
  }, [accountZone, value]);
  const differs = value !== accountZone;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontSize: 12, color: C.textMuted }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <Globe size={13} aria-hidden="true" />{t.schTimezone}:
        {/* Chữ ẩn giữ bề rộng đúng bằng giá trị đang chọn; select phủ lên trên (select gốc rộng theo option dài nhất). */}
        <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
          <span aria-hidden="true" style={{ ...box, visibility: 'hidden', whiteSpace: 'nowrap' }}>{value}</span>
          <select value={value} onChange={(e) => onChange(e.target.value)} aria-label={t.planTzChange} className="sch-hover"
            style={{ ...box, position: 'absolute', inset: 0, width: '100%', appearance: 'none', WebkitAppearance: 'none', color: C.textStrong, background: 'transparent', border: `1px solid ${differs ? C.amberText : 'transparent'}`, cursor: 'pointer' }}>
            {zones.map((z) => <option key={z} value={z}>{z}</option>)}
          </select>
          <ChevronDown size={13} aria-hidden="true" style={{ position: 'absolute', right: 6, pointerEvents: 'none', color: C.textMuted }} />
        </span>
      </span>
      {differs && (
        <span role="status" style={{ fontSize: 11.5, fontWeight: 600, color: C.amberText, background: C.amberSoft, borderRadius: 999, padding: '2px 9px' }}>
          {t.planTzDiffers.replace('{zone}', accountZone)}
        </span>
      )}
    </div>
  );
}

const box: CSSProperties = { font: 'inherit', fontSize: 12, fontWeight: 700, borderRadius: 8, padding: '3px 22px 3px 6px', border: '1px solid transparent' };
