import { Fragment, useEffect, useState, type CSSProperties } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Download } from 'lucide-react';
import { useApp } from '../../../context/AppContext';
import SectionCard from '../SectionCard';
import StatusBadge from '../StatusBadge';
import Pagination from '../Pagination';
import { DataTable } from '../AdminListPage';
import { useToast } from '../../toast/ToastProvider';
import { usePageSize } from '../../../hooks/usePageSize';
import { aiTaskLabel, type AiTaskCode } from '../../../api/adminAi';
import {
  getUsageEvents,
  getEventMeta,
  countUsageEvents,
  exportUsageEvents,
  getUsageByUser,
  type AiUsageEventStatus,
  type UsageEvent,
  type UsageEventFilter,
  type UsageEventMeta,
} from '../../../api/adminUsage';

// Bảng "Nhật ký sử dụng" dùng chung: tab admin (đủ filter + user picker) và trang chi tiết
// user (fixedUserId — ẩn picker). Phân trang SERVER-SIDE có số trang (offset), dùng chung
// component Pagination với các trang quản trị khác.
// IP/UA KHÔNG nằm trong bảng — chỉ tải khi mở rộng dòng (BE ghi audit mỗi lần xem).

const tdStyle: CSSProperties = { padding: '10px 14px', fontSize: 13, color: '#2b2543', whiteSpace: 'nowrap' };
const tdMuted: CSSProperties = { ...tdStyle, color: '#8a85a0', fontSize: 12.5 };
const inputStyle: CSSProperties = { border: '1px solid #ece8f6', borderRadius: 10, padding: '7px 10px', fontSize: 12.5, color: '#2b2543', background: '#fff' };

const TASKS: AiTaskCode[] = [
  'CONTENT_GENERATION', 'PLATFORM_FORMATTING', 'TREND_RESEARCH',
  'GOLDEN_HOURS', 'STRATEGY_OPTIMIZATION', 'CONTENT_REGENERATION',
];
const STATUSES: AiUsageEventStatus[] = ['SUCCESS', 'ERROR', 'TIMEOUT'];
const RETENTION_DAYS = 90;
const EXPORT_CAP = 50_000;

const fmtTokens = (n: number) =>
  n >= 1_000_000 ? `${+(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `${+(n / 1_000).toFixed(1)}K` : n.toLocaleString('vi-VN');
const fmtUsd = (n: number | null) => (n == null ? '—' : `$${n.toLocaleString('en-US', { maximumFractionDigits: 4 })}`);
const fmtDateTime = (iso: string) => iso.slice(0, 19).replace('T', ' ');
/** null = "không biết" — hiển thị '—', KHÔNG coalesce về 0. */
const fmtNullable = (n: number | null) => (n == null ? '—' : fmtTokens(n));
const statusTone = (s: AiUsageEventStatus) => (s === 'SUCCESS' ? 'success' : s === 'TIMEOUT' ? 'warning' : 'danger');

/** Skeleton mô phỏng đúng số cột/độ cao của bảng — không nhảy layout khi dữ liệu về. */
function TableSkeleton({ rows, cols }: { rows: number; cols: number }) {
  return (
    <div style={{ padding: '0 16px 16px' }} role="status" aria-busy="true">
      {Array.from({ length: rows }, (_, r) => (
        <div key={r} style={{ display: 'flex', gap: 12, padding: '11px 0', borderTop: '1px solid #f1eef8' }}>
          {Array.from({ length: cols }, (_, c) => (
            <span key={c} className="skeleton" style={{ height: 12, borderRadius: 6, flex: c === 0 ? '0 0 130px' : 1 }} />
          ))}
        </div>
      ))}
    </div>
  );
}

export default function UsageEventsTable({ fixedUserId, syncUrl = false }: { fixedUserId?: string; syncUrl?: boolean }) {
  const { t, lang, brandGradient } = useApp();
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  // URL là nguồn khởi tạo khi bật syncUrl (reload/chia sẻ link giữ nguyên trạng thái).
  const urlValue = (key: string) => (syncUrl ? searchParams.get(key) ?? '' : '');

  // ----- Filter (chỉ áp khi bấm "Lọc" để không dội API theo từng phím) -----
  const [fromDate, setFromDate] = useState(() => urlValue('from'));
  const [toDate, setToDate] = useState(() => urlValue('to'));
  const [taskCode, setTaskCode] = useState<AiTaskCode | ''>(() => urlValue('task') as AiTaskCode | '');
  const [model, setModel] = useState(() => urlValue('model'));
  const [status, setStatus] = useState<AiUsageEventStatus | ''>(() => urlValue('status') as AiUsageEventStatus | '');
  const [minTokens, setMinTokens] = useState(() => urlValue('minTokens'));
  const [minCost, setMinCost] = useState(() => urlValue('minCost'));
  const [userId, setUserId] = useState(fixedUserId ?? (() => urlValue('userId'))());
  const [userLabel, setUserLabel] = useState('');
  const [userQ, setUserQ] = useState('');
  const [userSuggests, setUserSuggests] = useState<{ userId: string; label: string }[]>([]);

  const buildFilter = (): UsageEventFilter => ({
    from: fromDate ? `${fromDate}T00:00:00` : undefined,
    to: toDate ? `${toDate}T23:59:59` : undefined,
    userId: fixedUserId ?? (userId || undefined),
    taskCode: taskCode || undefined,
    model: model || undefined,
    status: status || undefined,
    minTokens: minTokens ? Number(minTokens) : undefined,
    minCost: minCost ? Number(minCost) : undefined,
  });

  const [applied, setApplied] = useState<UsageEventFilter>(buildFilter);

  // ----- Phân trang (offset, server-side) -----
  // Khoá lưu số dòng tách riêng cho 2 chỗ dùng: bảng ở trang chi tiết user hẹp hơn bảng
  // ở tab admin nên sở thích của user cho mỗi chỗ không nhất thiết giống nhau.
  const [pageSize, setPageSize] = usePageSize(fixedUserId ? 'usage-events-user' : 'usage-events');
  const [page, setPage] = useState(() => {
    const fromUrl = Number(urlValue('page'));
    return Number.isFinite(fromUrl) && fromUrl > 0 ? fromUrl - 1 : 0;
  });
  const [pageCount, setPageCount] = useState(0);

  // limit trên URL được ưu tiên hơn lựa chọn đã lưu — link chia sẻ phải hiện đúng như người gửi thấy.
  useEffect(() => {
    const fromUrl = Number(urlValue('limit'));
    if (Number.isFinite(fromUrl) && fromUrl > 0 && fromUrl !== pageSize) setPageSize(fromUrl);
    // Chỉ đọc URL một lần lúc mount; sau đó state là nguồn sự thật.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ----- Data -----
  const [rows, setRows] = useState<UsageEvent[]>([]);
  const [load, setLoad] = useState<'loading' | 'error' | 'ok'>('loading');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [metaById, setMetaById] = useState<Record<string, UsageEventMeta | 'loading' | 'error'>>({});
  const [exporting, setExporting] = useState(false);

  const fetchPage = () => {
    setLoad('loading');
    getUsageEvents(applied, page, pageSize)
      .then((res) => {
        setRows(res.content);
        setPageCount(res.totalPages);
        setLoad('ok');
      })
      .catch(() => setLoad('error'));
  };
  useEffect(fetchPage, [applied, page, pageSize]);

  // Đổi bộ lọc hoặc số dòng/trang thì phải về trang đầu, nếu không sẽ rơi vào trang trống.
  useEffect(() => { setPage(0); }, [applied, pageSize]);

  // Ghi trạng thái lên URL (chỉ trang chính) — bỏ tham số rỗng cho URL gọn.
  useEffect(() => {
    if (!syncUrl) return;
    const next = new URLSearchParams(searchParams);
    const put = (key: string, value: string) => (value ? next.set(key, value) : next.delete(key));
    put('page', page > 0 ? String(page + 1) : '');
    put('limit', String(pageSize));
    put('from', fromDate);
    put('to', toDate);
    put('task', taskCode);
    put('model', model);
    put('status', status);
    put('minTokens', minTokens);
    put('minCost', minCost);
    put('userId', fixedUserId ? '' : userId);
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [syncUrl, page, pageSize, applied]);

  const apply = () => { setExpanded(null); setApplied(buildFilter()); };

  // ----- User picker (chỉ tab admin; trang chi tiết đã fix user) -----
  useEffect(() => {
    if (fixedUserId || !userQ.trim()) { setUserSuggests([]); return; }
    const timer = setTimeout(() => {
      getUsageByUser({ q: userQ, page: 0, size: 5 })
        .then((p) => setUserSuggests(p.content.map((r) => ({ userId: r.userId, label: r.fullName || r.email }))))
        .catch(() => setUserSuggests([]));
    }, 300);
    return () => clearTimeout(timer);
  }, [userQ, fixedUserId]);

  // ----- Mở rộng dòng: tải IP/UA (BE ghi audit MỖI lần xem) -----
  const toggleExpand = (id: string) => {
    const next = expanded === id ? null : id;
    setExpanded(next);
    if (next && metaById[next] === undefined) {
      setMetaById((m) => ({ ...m, [next]: 'loading' }));
      getEventMeta(next)
        .then((meta) => setMetaById((m) => ({ ...m, [next]: meta })))
        .catch(() => setMetaById((m) => ({ ...m, [next]: 'error' })));
    }
  };

  // ----- Export: đếm trước, vượt trần báo số THỰC TẾ, không cắt cụt im lặng -----
  const doExport = async () => {
    setExporting(true);
    try {
      const filter = buildFilter();
      const count = await countUsageEvents(filter);
      if (count > EXPORT_CAP) {
        toast.warning(t.aueExportTooLarge.replace('{n}', count.toLocaleString('vi-VN')));
        return;
      }
      const csv = await exportUsageEvents(filter);
      const url = URL.createObjectURL(new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `aima-usage-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(t.aueExportOk.replace('{n}', count.toLocaleString('vi-VN')));
    } catch {
      toast.error(t.auActionErr);
    } finally {
      setExporting(false);
    }
  };

  // Cảnh báo khi filter vượt mốc retention (không chặn — dữ liệu lỗi còn tới 180 ngày).
  const retentionEdge = new Date();
  retentionEdge.setDate(retentionEdge.getDate() - RETENTION_DAYS);
  const beyondRetention = !!fromDate && new Date(fromDate) < retentionEdge;

  const colCount = fixedUserId ? 9 : 10;

  return (
    <SectionCard
      flush
      title={t.auTabEvents}
      action={
        <button onClick={doExport} disabled={exporting}
          style={{ display: 'flex', alignItems: 'center', gap: 6, border: '1px solid #ece8f6', background: '#fff', borderRadius: 9, padding: '7px 12px', fontSize: 12.5, fontWeight: 700, color: '#5b5670', cursor: exporting ? 'wait' : 'pointer', opacity: exporting ? 0.6 : 1 }}>
          <Download size={14} /> {t.aueExport}
        </button>
      }
    >
      <div style={{ padding: '8px 16px 0', fontSize: 12, color: '#8a85a0' }}>{t.aueRetentionNote}</div>
      {beyondRetention && (
        <div style={{ margin: '8px 16px 0', padding: '8px 12px', borderRadius: 10, background: '#fff7ed', border: '1px solid #fed7aa', fontSize: 12.5, color: '#b45309', fontWeight: 600 }}>
          {t.aueRetentionWarn}
        </div>
      )}

      {/* Bộ lọc */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', padding: '12px 16px' }}>
        <input type="date" title={t.aueFrom} value={fromDate} onChange={(e) => setFromDate(e.target.value)} style={inputStyle} />
        <input type="date" title={t.aueTo} value={toDate} onChange={(e) => setToDate(e.target.value)} style={inputStyle} />
        <select value={taskCode} onChange={(e) => setTaskCode(e.target.value as AiTaskCode | '')} style={inputStyle}>
          <option value="">{t.aueTaskAll}</option>
          {TASKS.map((task) => <option key={task} value={task}>{aiTaskLabel(lang, task)}</option>)}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value as AiUsageEventStatus | '')} style={inputStyle}>
          <option value="">{t.aueStatusAll}</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <input placeholder={t.aueModelPh} value={model} onChange={(e) => setModel(e.target.value)} style={{ ...inputStyle, width: 150 }} />
        <input type="number" min={0} placeholder={t.aueMinTokensPh} value={minTokens} onChange={(e) => setMinTokens(e.target.value)} style={{ ...inputStyle, width: 100 }} />
        <input type="number" min={0} step="any" placeholder={t.aueMinCostPh} value={minCost} onChange={(e) => setMinCost(e.target.value)} style={{ ...inputStyle, width: 110 }} />
        {!fixedUserId && (
          <div style={{ position: 'relative' }}>
            {userId ? (
              <button onClick={() => { setUserId(''); setUserLabel(''); setUserQ(''); }} title={t.aueUserClear}
                style={{ ...inputStyle, cursor: 'pointer', fontWeight: 700, color: '#7d6aa3' }}>
                {userLabel || userId} ✕
              </button>
            ) : (
              <input placeholder={t.aueUserPh} value={userQ} onChange={(e) => setUserQ(e.target.value)} style={{ ...inputStyle, width: 210 }} />
            )}
            {userSuggests.length > 0 && !userId && (
              <div style={{ position: 'absolute', top: '110%', left: 0, zIndex: 20, background: '#fff', border: '1px solid #ece8f6', borderRadius: 10, boxShadow: '0 8px 24px rgba(43,37,67,.12)', minWidth: 220, overflow: 'hidden' }}>
                {userSuggests.map((s) => (
                  <button key={s.userId} onClick={() => { setUserId(s.userId); setUserLabel(s.label); setUserSuggests([]); }}
                    style={{ display: 'block', width: '100%', textAlign: 'left', border: 'none', background: 'none', padding: '8px 12px', fontSize: 12.5, color: '#2b2543', cursor: 'pointer' }}>
                    {s.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        <button onClick={apply} style={{ border: 'none', borderRadius: 10, padding: '8px 16px', fontWeight: 700, fontSize: 12.5, color: '#fff', background: brandGradient, cursor: 'pointer' }}>{t.aueApply}</button>
      </div>

      {load === 'loading' ? (
        <TableSkeleton rows={Math.min(pageSize, 8)} cols={colCount} />
      ) : load === 'error' ? (
        <div style={{ textAlign: 'center', padding: '30px 16px' }}>
          <div style={{ fontSize: 13.5, color: '#8a85a0', marginBottom: 12 }}>{t.listError}</div>
          <button onClick={fetchPage} style={{ border: 'none', borderRadius: 10, padding: '8px 16px', fontWeight: 700, fontSize: 13, color: '#fff', background: brandGradient, cursor: 'pointer' }}>{t.retry}</button>
        </div>
      ) : rows.length === 0 ? (
        <>
          <div style={{ padding: '26px 16px', textAlign: 'center', fontSize: 13, color: '#a59fbb' }}>{t.aueEmpty}</div>
          <div style={{ padding: '0 16px 16px' }}>
            <Pagination page={page + 1} pageCount={pageCount} onChange={(p) => setPage(p - 1)}
              pageSize={pageSize} onPageSizeChange={setPageSize} />
          </div>
        </>
      ) : (
        <>
          <DataTable
            head={[t.aueColTime, ...(fixedUserId ? [] : [t.aueColUser]), t.aueColFeature, t.aueColModel, t.aueColIn, t.aueColOut, t.aueColBillable, t.aueColLatency, t.aueColCost, t.aueColStatus]}
            minWidth={fixedUserId ? 860 : 1020}
          >
            {rows.map((r) => (
              <Fragment key={r.id}>
                <tr onClick={() => toggleExpand(r.id)} style={{ borderTop: '1px solid #f1eef8', cursor: 'pointer', background: expanded === r.id ? '#faf8ff' : undefined }}>
                  <td style={tdMuted}>{fmtDateTime(r.createdAt)}</td>
                  {!fixedUserId && <td style={tdStyle}>{r.userFullName || r.userEmail || '—'}</td>}
                  <td style={tdStyle}>{aiTaskLabel(lang, r.taskCode)}</td>
                  <td style={tdMuted}>{r.modelCode}</td>
                  <td style={tdMuted}>{fmtNullable(r.inputTokens)}</td>
                  <td style={tdMuted}>{fmtNullable(r.outputTokens)}</td>
                  <td style={{ ...tdStyle, fontWeight: 700 }}>{fmtTokens(r.billableUnits ?? r.totalTokens)}</td>
                  <td style={tdMuted}>{r.latencyMs == null ? '—' : `${r.latencyMs.toLocaleString('vi-VN')}ms`}</td>
                  <td style={tdMuted}>{fmtUsd(r.estimatedCost)}</td>
                  <td style={tdStyle}><StatusBadge tone={statusTone(r.status)} label={r.status} /></td>
                </tr>
                {expanded === r.id && (
                  <tr style={{ background: '#faf8ff' }}>
                    <td colSpan={colCount} style={{ padding: '10px 16px', fontSize: 12.5 }}>
                      {metaById[r.id] === 'loading' || metaById[r.id] === undefined ? (
                        <span style={{ color: '#a59fbb' }}>{t.listLoading}</span>
                      ) : metaById[r.id] === 'error' ? (
                        <span style={{ color: '#dc2626' }}>{t.listError}</span>
                      ) : (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 18, color: '#5b5670' }}>
                          <span><b>{t.aueIp}:</b> {(metaById[r.id] as UsageEventMeta).clientIp || t.aueUnknown}</span>
                          <span><b>{t.aueUa}:</b> {(metaById[r.id] as UsageEventMeta).userAgent || t.aueUnknown}</span>
                          {r.creditUnits != null && r.creditUnits > 0 && (
                            <span><b>{t.auCreditUsed}:</b> {fmtTokens(r.creditUnits)}</span>
                          )}
                          <span style={{ color: '#a59fbb' }}>{t.aueMetaNote}</span>
                        </div>
                      )}
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </DataTable>
          <div style={{ padding: '0 16px 16px' }}>
            <Pagination page={page + 1} pageCount={pageCount} onChange={(p) => setPage(p - 1)}
              pageSize={pageSize} onPageSizeChange={setPageSize} />
          </div>
        </>
      )}
    </SectionCard>
  );
}
