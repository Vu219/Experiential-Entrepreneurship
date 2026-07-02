import { CheckCircle2, XCircle, ChevronRight } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Icon } from '../ui';
import { SESSION_STATUS_COLORS, type ResearchSession } from '../../trendsData';
import { Pill } from './filters';

/** 1 dòng timeline trong sub-tab "Lịch sử research". */
export default function ResearchHistoryItem({ session }: { session: ResearchSession }) {
  const { t } = useApp();
  const done = session.status === 'done';
  const st = SESSION_STATUS_COLORS[session.status];

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 0', flexWrap: 'wrap' }}>
      <Icon icon={done ? CheckCircle2 : XCircle} size={22} stroke={st.color} />
      <div style={{ flex: 1, minWidth: 200 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13.5, fontWeight: 700, color: '#2b2543' }}>{session.date} · {session.time}</span>
          <Pill text={done ? t.trDone : t.trCancelled} color={st.color} bg={st.bg} />
        </div>
        <div style={{ fontSize: 12.5, color: '#8a85a0', marginTop: 3 }}>
          {session.industry} · {session.platforms} {t.trPlatformUnit} · {session.trendsFound} {t.trTrendUnit} · {session.ideasCreated} {t.trIdeaUnit}
        </div>
      </div>
      <button
        type="button"
        className="link-underline"
        style={{ display: 'inline-flex', alignItems: 'center', gap: 2, border: 'none', background: 'transparent', padding: '4px 0', fontSize: 12.5, fontWeight: 600, color: '#7c3aed', cursor: 'pointer', flex: 'none' }}
      >
        {t.trSessionDetail}
        <Icon icon={ChevronRight} size={13} stroke="#7c3aed" />
      </button>
    </div>
  );
}
