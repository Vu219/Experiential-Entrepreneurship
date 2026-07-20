import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Download } from 'lucide-react';
import { useApp } from '../../../context/AppContext';
import StatusBadge from '../StatusBadge';
import Avatar from '../Avatar';
import Pagination from '../Pagination';
import AdminListPage, { SearchInput, FilterSelect, DataTable, type ListState } from '../AdminListPage';
import ActivityLogDetailModal from './ActivityLogDetailModal';
import { actionGroupLabel, actionGroupTone, actionLabel } from './activityLabels';
import { useToast } from '../../toast/ToastProvider';
import { usePageSize } from '../../../hooks/usePageSize';
import {
  getActivityLogs,
  exportActivityLogs,
  ACTIONS_BY_GROUP,
  type ActivityAction,
  type ActivityActionGroup,
  type ActivityLog,
  type ActivityResult,
} from '../../../api/admin';

// Tab B "Log hoạt động người dùng" — bảng RIÊNG activity_logs. Dùng lại đúng khung
// AdminListPage + DataTable + Pagination của tab lỗi; chỉ khác cột và nguồn dữ liệu.

const td: React.CSSProperties = { padding: '11px 16px', fontSize: 13, color: '#2b2543', whiteSpace: 'nowrap' };
const tdMuted: React.CSSProperties = { ...td, color: '#8a85a0', fontSize: 12.5 };
const initialsOf = (name: string) => name.trim().split(/\s+/).map((w) => w[0]).slice(-2).join('').toUpperCase();

export default function ActivityLogTab() {
  const { t, lang, brandGradient } = useApp();
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const param = (key: string) => searchParams.get(key) ?? '';

  const [query, setQuery] = useState(() => param('q'));
  const [action, setAction] = useState<ActivityAction | ''>(() => param('action') as ActivityAction | '');
  const [result, setResult] = useState<ActivityResult | ''>(() => param('result') as ActivityResult | '');
  const [userId, setUserId] = useState(() => param('userId'));
  const [from, setFrom] = useState(() => param('from'));
  const [to, setTo] = useState(() => param('to'));

  const [page, setPage] = useState(() => {
    const p = Number(param('page'));
    return Number.isFinite(p) && p > 0 ? p - 1 : 0;
  });
  const [pageSize, setPageSize] = usePageSize('logs-activity');
  const [pageCount, setPageCount] = useState(0);

  const [rows, setRows] = useState<ActivityLog[]>([]);
  const [load, setLoad] = useState<'loading' | 'error' | 'ok'>('loading');
  const [reload, setReload] = useState(0);
  const [selected, setSelected] = useState<ActivityLog | null>(null);
  const [exporting, setExporting] = useState(false);

  const filter = {
    q: query || undefined,
    action: action || undefined,
    result: result || undefined,
    userId: userId || undefined,
    from: from || undefined,
    to: to || undefined,
  };

  // Debounce 300ms như tab lỗi để gõ tìm kiếm không dội API mỗi phím.
  useEffect(() => {
    setLoad('loading');
    const timer = setTimeout(() => {
      getActivityLogs({ ...filter, page, size: pageSize })
        .then((p) => { setRows(p.content); setPageCount(p.totalPages); setLoad('ok'); })
        .catch(() => setLoad('error'));
    }, 300);
    return () => clearTimeout(timer);
  }, [query, action, result, userId, from, to, page, pageSize, reload]);

  useEffect(() => setPage(0), [query, action, result, userId, from, to, pageSize]);

  // Giữ tham số `tab` của trang cha, chỉ ghi thêm/bớt tham số của tab này.
  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    const put = (key: string, value: string) => (value ? next.set(key, value) : next.delete(key));
    put('page', page > 0 ? String(page + 1) : '');
    put('limit', String(pageSize));
    put('q', query);
    put('action', action);
    put('result', result);
    put('userId', userId);
    put('from', from);
    put('to', to);
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize, query, action, result, userId, from, to]);

  const doExport = async () => {
    setExporting(true);
    try {
      const csv = await exportActivityLogs(filter);
      const url = URL.createObjectURL(new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `aima-activity-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(t.alExportOk);
    } catch {
      toast.error(t.auActionErr);
    } finally {
      setExporting(false);
    }
  };

  const state: ListState = load === 'loading' ? 'loading' : load === 'error' ? 'error' : rows.length === 0 ? 'empty' : 'ready';
  const dateInput = { height: 38, border: '1px solid #ece8f6', background: '#fff', borderRadius: 10, padding: '0 10px', fontSize: 13, color: '#4b4660', cursor: 'pointer' } as const;

  const toolbar = (
    <>
      <SearchInput value={query} onChange={setQuery} placeholder={t.alSearchPh} />
      {/* Danh sách action dài → gom optgroup theo nhóm nghiệp vụ cho dễ tìm. */}
      <select value={action} onChange={(e) => setAction(e.target.value as ActivityAction | '')}
        style={{ height: 38, border: '1px solid #ece8f6', background: '#fff', borderRadius: 10, padding: '0 12px', fontSize: 13.5, fontWeight: 600, color: '#4b4660', cursor: 'pointer', maxWidth: 240 }}>
        <option value="">{`${t.alColAction}: ${t.filterAll}`}</option>
        {(Object.keys(ACTIONS_BY_GROUP) as ActivityActionGroup[]).map((group) => (
          <optgroup key={group} label={actionGroupLabel(lang, group)}>
            {ACTIONS_BY_GROUP[group].map((a) => (
              <option key={a} value={a}>{actionLabel(lang, a)}</option>
            ))}
          </optgroup>
        ))}
      </select>
      <FilterSelect value={result} onChange={(v) => setResult(v as ActivityResult | '')}
        options={[['', `${t.alColResult}: ${t.filterAll}`], ['SUCCESS', t.alResultSuccess], ['FAILURE', t.alResultFailure]]} />
      <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: '#8a85a0' }}>
        {t.filterFrom}<input type="date" value={from} onChange={(e) => setFrom(e.target.value)} style={dateInput} />
      </label>
      <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: '#8a85a0' }}>
        {t.filterTo}<input type="date" value={to} onChange={(e) => setTo(e.target.value)} style={dateInput} />
      </label>
      {/* Lọc theo người dùng đến từ link "xem hoạt động của user này"; ở đây chỉ cần gỡ được. */}
      {userId && (
        <button onClick={() => setUserId('')} title={t.aueUserClear}
          style={{ height: 38, border: '1px solid #ece8f6', background: '#fff', borderRadius: 10, padding: '0 12px', fontSize: 12.5, fontWeight: 700, color: '#7d6aa3', cursor: 'pointer' }}>
          {t.alFilteredByUser} ✕
        </button>
      )}
      <button onClick={doExport} disabled={exporting}
        style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto', height: 38, border: '1px solid #ece8f6', background: '#fff', borderRadius: 10, padding: '0 12px', fontSize: 12.5, fontWeight: 700, color: '#5b5670', cursor: exporting ? 'wait' : 'pointer', opacity: exporting ? 0.6 : 1 }}>
        <Download size={14} /> {t.aueExport}
      </button>
    </>
  );

  return (
    <>
      <AdminListPage state={state} toolbar={toolbar} onRetry={() => setReload((r) => r + 1)} emptyLabel={t.alEmpty}>
        <DataTable head={[t.colTime, t.alColUser, t.alColAction, t.alColTarget, t.alColClient, t.alColResult, '']} minWidth={1040}>
          {rows.map((l) => (
            <tr key={l.id} onClick={() => setSelected(l)} style={{ borderTop: '1px solid #f1eef8', cursor: 'pointer' }}>
              <td style={tdMuted}>{l.createdAt.slice(0, 19).replace('T', ' ')}</td>
              <td style={td}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Avatar url={l.userAvatarUrl ?? undefined}
                    initials={initialsOf(l.userFullName || l.userEmail || '?')} gradient={brandGradient} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600 }}>{l.userFullName || l.userEmail || t.alSystemActor}</div>
                    {l.userFullName && l.userEmail && (
                      <div style={{ fontSize: 12, color: '#a59fbb' }}>{l.userEmail}</div>
                    )}
                  </div>
                </div>
              </td>
              <td style={td}><StatusBadge tone={actionGroupTone(l.actionGroup)} label={actionLabel(lang, l.action)} /></td>
              <td style={tdMuted}>
                {l.targetType ? (
                  <>
                    {l.targetType}
                    {l.targetId && (
                      <div style={{ fontSize: 11.5, color: '#c4bdd6', fontFamily: 'ui-monospace,Menlo,Consolas,monospace' }}>
                        {l.targetId.length > 12 ? `${l.targetId.slice(0, 12)}…` : l.targetId}
                      </div>
                    )}
                  </>
                ) : '—'}
              </td>
              <td style={tdMuted}>
                {l.ip || '—'}
                {l.userAgent && (
                  <div style={{ fontSize: 11.5, color: '#c4bdd6', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis' }} title={l.userAgent}>
                    {l.userAgent}
                  </div>
                )}
              </td>
              <td style={td}>
                <StatusBadge tone={l.result === 'SUCCESS' ? 'success' : 'danger'}
                  label={l.result === 'SUCCESS' ? t.alResultSuccess : t.alResultFailure} />
              </td>
              <td style={{ ...td, textAlign: 'right' }}>
                <button onClick={(e) => { e.stopPropagation(); setSelected(l); }}
                  style={{ border: '1px solid #ece8f6', background: '#fff', borderRadius: 9, padding: '6px 12px', fontSize: 12.5, fontWeight: 700, color: '#5b5670', cursor: 'pointer' }}>
                  {t.detail}
                </button>
              </td>
            </tr>
          ))}
        </DataTable>
        <div style={{ padding: '0 16px 16px' }}>
          <Pagination page={page + 1} pageCount={pageCount} onChange={(p) => setPage(p - 1)}
            pageSize={pageSize} onPageSizeChange={setPageSize} />
        </div>
      </AdminListPage>

      {selected && <ActivityLogDetailModal log={selected} onClose={() => setSelected(null)} />}
    </>
  );
}
