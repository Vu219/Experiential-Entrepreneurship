import { CheckCircle2, XCircle, ChevronRight } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Icon } from '../ui';
import { SESSION_STATUS_COLORS, type ResearchSession } from '../../trendsData';
import { Pill } from './filters';
import { C } from '../../styles/colors';

/** 1 dòng timeline trong sub-tab "Lịch sử research". */
export default function ResearchHistoryItem({ session, onDetail }: { session: ResearchSession; onDetail: () => void }) {
  const { t } = useApp();
  const done = session.status === 'done';
  const st = SESSION_STATUS_COLORS[session.status];

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 0', flexWrap: 'wrap' }}>
      <Icon icon={done ? CheckCircle2 : XCircle} size={22} stroke={st.color} />
      <div style={{ flex: 1, minWidth: 200 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13.5, fontWeight: 700, color: C.ink750 }}>{session.date} · {session.time}</span>
          <Pill text={done ? t.trDone : t.trCancelled} color={st.color} bg={st.bg} />
        </div>
        <div style={{ fontSize: 12.5, color: C.textMuted, marginTop: 3 }}>
          {session.industry} · {session.platforms} {t.trPlatformUnit} · {session.trendsFound} {t.trTrendUnit} · {session.ideasCreated} {t.trIdeaUnit}
        </div>
      </div>
      <button
        type="button"
        onClick={onDetail}
        className="link-underline"
        style={{ display: 'inline-flex', alignItems: 'center', gap: 2, border: 'none', background: 'transparent', padding: '4px 0', fontSize: 12.5, fontWeight: 600, color: C.primary, cursor: 'pointer', flex: 'none' }}
      >
        {t.trSessionDetail}
        <Icon icon={ChevronRight} size={13} stroke={C.primary} />
      </button>
    </div>
  );
}
