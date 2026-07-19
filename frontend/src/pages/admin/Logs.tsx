import { useEffect, useState } from 'react';
import { useApp } from '../../context/AppContext';
import Modal from '../../components/Modal';
import StatusBadge from '../../components/admin/StatusBadge';
import Pagination from '../../components/admin/Pagination';
import AdminListPage, { SearchInput, FilterSelect, DataTable, DetailRow, type ListState } from '../../components/admin/AdminListPage';
import { getSystemLogs, logLevelTone, type SystemLog, type LogLevel } from '../../api/admin';
import PageContainer from '../../components/PageContainer';


const PAGE_SIZE = 12;
const LEVELS: LogLevel[] = ['ERROR', 'WARN', 'INFO', 'DEBUG'];

export default function Logs() {
  const { t } = useApp();
  const [load, setLoad] = useState<'loading' | 'error' | 'ok'>('loading');
  const [rows, setRows] = useState<SystemLog[]>([]);
  const [pageCount, setPageCount] = useState(0);
  const [query, setQuery] = useState('');
  const [level, setLevel] = useState('all');
  const [date, setDate] = useState('');
  const [grouped, setGrouped] = useState(false);
  const [page, setPage] = useState(1);
  const [reload, setReload] = useState(0);
  const [selected, setSelected] = useState<SystemLog | null>(null);
  const [copied, setCopied] = useState(false);

  // Lọc/tìm/gom nhóm/phân trang đều server-side; debounce chung 300ms để gõ tìm kiếm không spam.
  useEffect(() => {
    setLoad('loading');
    const timer = setTimeout(() => {
      getSystemLogs({
        level: level === 'all' ? undefined : (level as LogLevel),
        date: date || undefined,
        q: query || undefined,
        grouped,
        page: page - 1,
        size: PAGE_SIZE,
      })
        .then((p) => { setRows(p.rows); setPageCount(p.pageCount); setLoad('ok'); })
        .catch(() => setLoad('error'));
    }, 300);
    return () => clearTimeout(timer);
  }, [query, level, date, grouped, page, reload]);

  useEffect(() => setPage(1), [query, level, date, grouped]);

  const state: ListState = load === 'loading' ? 'loading' : load === 'error' ? 'error' : rows.length === 0 ? 'empty' : 'ready';

  const dateInput = { height: 38, border: '1px solid #ece8f6', background: '#fff', borderRadius: 10, padding: '0 10px', fontSize: 13, color: '#4b4660', cursor: 'pointer' } as const;

  const copy = (log: SystemLog) => {
    const text = `[${log.time}] ${log.level} ${log.module}\n${log.message}${log.detail ? '\n\n' + log.detail : ''}`;
    navigator.clipboard?.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1600); });
  };

  const toolbar = (
    <>
      <SearchInput value={query} onChange={setQuery} />
      <FilterSelect value={level} onChange={setLevel} options={[['all', `${t.filterLevel}: ${t.filterAll}`], ...LEVELS.map((l) => [l, l] as [string, string])]} />
      <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: '#8a85a0' }}>{t.logDate}<input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={dateInput} /></label>
      <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: '#6b5ca8', fontWeight: 600, cursor: 'pointer', userSelect: 'none' }}>
        <input type="checkbox" checked={grouped} onChange={(e) => setGrouped(e.target.checked)} style={{ cursor: 'pointer' }} />
        {t.logGroup}
      </label>
    </>
  );

  return (
    <PageContainer>
      <AdminListPage state={state} toolbar={toolbar} onRetry={() => setReload((r) => r + 1)}>
        <DataTable head={[t.colTime, t.colLevel, t.colModule, t.colMessage]} minWidth={820}>
          {rows.map((l) => (
            <tr key={l.id} onClick={() => setSelected(l)} style={{ borderTop: '1px solid #f1eef8', cursor: 'pointer' }}>
              <td style={{ padding: '12px 16px', fontSize: 12.5, color: '#8a85a0', whiteSpace: 'nowrap' }}>{l.time}</td>
              <td style={{ padding: '12px 16px' }}><StatusBadge tone={logLevelTone(l.level)} label={l.level} /></td>
              <td style={{ padding: '12px 16px', fontSize: 12.5, fontWeight: 600, color: '#6b5ca8', fontFamily: 'ui-monospace,Menlo,Consolas,monospace' }}>{l.module}</td>
              <td style={{ padding: '12px 16px', fontSize: 13, color: '#3f3a55' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                  <span style={{ maxWidth: 420, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.message}</span>
                  {l.count != null && l.count > 1 && (
                    <span style={{ flexShrink: 0, background: '#efeafc', color: '#6b5ca8', fontSize: 11.5, fontWeight: 700, borderRadius: 20, padding: '1px 8px' }}>×{l.count}</span>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </DataTable>
        <div style={{ padding: '0 16px 16px' }}>
          <Pagination page={page} pageCount={pageCount} onChange={setPage} />
        </div>
      </AdminListPage>

      {selected && (
        <Modal title={t.logDetailTitle} maxWidth={620} onClose={() => setSelected(null)}>
          <DetailRow label={t.colTime} value={selected.time} />
          <DetailRow label={t.colLevel} value={<StatusBadge tone={logLevelTone(selected.level)} label={selected.level} />} />
          <DetailRow label={t.colModule} value={selected.module} />
          {selected.count != null && selected.count > 1 && <DetailRow label={t.logCount} value={`×${selected.count}`} />}
          <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#a59fbb' }}>{t.colMessage}</div>
            <button onClick={() => copy(selected)} style={{ border: '1px solid #ece8f6', background: '#faf8ff', color: '#6b5ca8', borderRadius: 8, padding: '4px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
              {copied ? t.logCopied : t.logCopy}
            </button>
          </div>
          <pre style={{ margin: '6px 0 0', background: '#1f1b2e', color: '#e6e1ff', borderRadius: 10, padding: '12px 14px', fontSize: 12.5, lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: 'ui-monospace,Menlo,Consolas,monospace' }}>{selected.message}</pre>
          <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#a59fbb', marginBottom: 6 }}>{t.logDetailLabel}</div>
            {selected.detail ? (
              <pre style={{ margin: 0, background: '#1f1b2e', color: '#c9c2e8', borderRadius: 10, padding: '12px 14px', fontSize: 12, lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: 320, overflow: 'auto', fontFamily: 'ui-monospace,Menlo,Consolas,monospace' }}>{selected.detail}</pre>
            ) : (
              <div style={{ fontSize: 12.5, color: '#a59fbb' }}>{t.logNoDetail}</div>
            )}
          </div>
        </Modal>
      )}
    </PageContainer>
  );
}
