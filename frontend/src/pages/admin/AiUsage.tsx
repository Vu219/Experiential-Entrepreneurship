import { useEffect, useState, type CSSProperties } from 'react';
import { Coins, DollarSign } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Loader, Card } from '../../components/ui';
import StatCard from '../../components/admin/StatCard';
import SectionCard from '../../components/admin/SectionCard';
import AiServiceStatusBadge from '../../components/admin/AiServiceStatusBadge';
import Pagination from '../../components/admin/Pagination';
import { DataTable } from '../../components/admin/AdminListPage';
import {
  aiAuditActionLabel,
  aiTaskLabel,
  fmtAiDateTime,
  getAiAudit,
  getAiUsage,
  getAiUsageSummary,
  type AiAuditRow,
  type AiUsageRow,
  type AiUsageSummary,
} from '../../api/adminAi';

const tdStyle: CSSProperties = { padding: '12px 16px', fontSize: 13.5, color: '#2b2543' };
const tdMuted: CSSProperties = { ...tdStyle, color: '#8a85a0', fontSize: 13 };

const fmtTokens = (n: number) => n.toLocaleString('vi-VN');
const fmtUsd = (n: number | null) => (n == null ? '—' : `$${n.toLocaleString('en-US', { maximumFractionDigits: 4 })}`);

/** Bảng con "chưa có dữ liệu" dùng cho các khối tổng hợp/danh sách trống. */
function EmptyNote({ label }: { label: string }) {
  return <div style={{ textAlign: 'center', padding: '28px 16px', color: '#8a85a0', fontSize: 13.5 }}>{label}</div>;
}

export default function AiUsage() {
  const { t, lang } = useApp();
  const [load, setLoad] = useState<'loading' | 'error' | 'ok'>('loading');
  const [summary, setSummary] = useState<AiUsageSummary | null>(null);
  const [month, setMonth] = useState(''); // '' = tháng hiện tại (BE mặc định)

  const [rows, setRows] = useState<AiUsageRow[]>([]);
  const [page, setPage] = useState(0);
  const [pageCount, setPageCount] = useState(0);

  const [audit, setAudit] = useState<AiAuditRow[]>([]);
  const [auditPage, setAuditPage] = useState(0);
  const [auditPageCount, setAuditPageCount] = useState(0);

  const fetchSummary = (m: string) => {
    setLoad('loading');
    getAiUsageSummary(m || undefined)
      .then((s) => { setSummary(s); setLoad('ok'); })
      .catch(() => setLoad('error'));
  };
  useEffect(() => fetchSummary(month), [month]);

  useEffect(() => {
    getAiUsage(page)
      .then((p) => { setRows(p.content); setPageCount(p.totalPages); })
      .catch(() => { setRows([]); setPageCount(0); });
  }, [page]);

  useEffect(() => {
    getAiAudit(auditPage)
      .then((p) => { setAudit(p.content); setAuditPageCount(p.totalPages); })
      .catch(() => { setAudit([]); setAuditPageCount(0); });
  }, [auditPage]);

  if (load === 'loading' && !summary) {
    return <div className="view-pop" style={{ maxWidth: 1180, margin: '0 auto' }}><Card><Loader label={t.listLoading} /></Card></div>;
  }
  if (load === 'error' && !summary) {
    return (
      <div className="view-pop" style={{ maxWidth: 1180, margin: '0 auto' }}>
        <Card style={{ textAlign: 'center', padding: '54px 16px', color: '#8a85a0', fontSize: 14 }}>{t.listError}</Card>
      </div>
    );
  }

  const s = summary!;

  return (
    <div className="view-pop" style={{ maxWidth: 1180, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Chọn tháng + badge AI service */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <label style={{ fontSize: 13, fontWeight: 700, color: '#3f3a55' }}>{t.aiUsageMonth}</label>
          <input
            type="month"
            value={month || s.month}
            onChange={(e) => { setMonth(e.target.value); }}
            style={{ border: '1px solid #ece8f6', background: '#fff', borderRadius: 10, padding: '7px 12px', fontSize: 13.5, fontWeight: 600, color: '#4b4660', cursor: 'pointer' }}
          />
        </div>
        <AiServiceStatusBadge />
      </div>

      {/* Tổng quan tháng */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 18 }}>
        <StatCard icon={Coins} iconBg="linear-gradient(135deg,#f1e9ff,#fae9ff)" iconColor="#8b5cf6"
          value={fmtTokens(s.totalTokens)} label={`${t.aiUsageTotalTokens} · ${s.month}`} />
        <StatCard icon={DollarSign} iconBg="linear-gradient(135deg,#fff3e0,#ffe9f3)" iconColor="#ec4899"
          value={fmtUsd(s.estimatedCost)} label={`${t.aiUsageCost} · ${s.month}`} valueFontSize={24} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))', gap: 20, alignItems: 'start' }}>
        {/* Theo nghiệp vụ */}
        <SectionCard flush title={t.aiUsageByTask}>
          {s.byTask.length === 0 ? <EmptyNote label={t.aiUsageEmpty} /> : (
            <DataTable head={[t.aiColTask, 'Token', t.aiUsageCost]} minWidth={300}>
              {s.byTask.map((b) => (
                <tr key={b.taskCode} style={{ borderTop: '1px solid #f1eef8' }}>
                  <td style={{ ...tdStyle, fontWeight: 600 }}>{aiTaskLabel(lang, b.taskCode)}</td>
                  <td style={tdStyle}>{fmtTokens(b.totalTokens)}</td>
                  <td style={tdMuted}>{fmtUsd(b.estimatedCost)}</td>
                </tr>
              ))}
            </DataTable>
          )}
        </SectionCard>

        {/* Theo model */}
        <SectionCard flush title={t.aiUsageByModel}>
          {s.byModel.length === 0 ? <EmptyNote label={t.aiUsageEmpty} /> : (
            <DataTable head={['Model', 'Token', t.aiUsageCost]} minWidth={300}>
              {s.byModel.map((b, i) => (
                <tr key={i} style={{ borderTop: '1px solid #f1eef8' }}>
                  <td style={tdStyle}>
                    <div style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 600 }}>{b.modelCode}</div>
                    <div style={{ fontSize: 11.5, color: '#a59fbb' }}>{b.providerCode}</div>
                  </td>
                  <td style={tdStyle}>{fmtTokens(b.totalTokens)}</td>
                  <td style={tdMuted}>{fmtUsd(b.estimatedCost)}</td>
                </tr>
              ))}
            </DataTable>
          )}
        </SectionCard>
      </div>

      {/* Chi tiết gần đây (mọi tháng, mới nhất trước) */}
      <SectionCard flush title={t.aiUsageDetail}>
        {rows.length === 0 ? <EmptyNote label={t.aiUsageEmpty} /> : (
          <>
            <DataTable head={[t.aiUsageTime, t.aiUsageUser, t.aiColTask, 'Model', 'Token', t.aiUsageCost]} minWidth={780}>
              {rows.map((r) => (
                <tr key={r.id} style={{ borderTop: '1px solid #f1eef8' }}>
                  <td style={tdMuted}>{fmtAiDateTime(r.createdAt)}</td>
                  <td style={tdStyle}>{r.userEmail ?? t.aiSystemActor}</td>
                  <td style={tdStyle}>{aiTaskLabel(lang, r.taskCode)}</td>
                  <td style={{ ...tdStyle, fontFamily: 'monospace', fontSize: 13 }}>{r.modelCode}</td>
                  <td style={tdStyle}>{fmtTokens(r.totalTokens)}</td>
                  <td style={tdMuted}>{fmtUsd(r.estimatedCost)}</td>
                </tr>
              ))}
            </DataTable>
            <div style={{ padding: '0 16px 16px' }}>
              <Pagination page={page + 1} pageCount={pageCount} onChange={(p) => setPage(p - 1)} />
            </div>
          </>
        )}
      </SectionCard>

      {/* Nhật ký thay đổi cấu hình AI (audit — snapshot đã mask key từ backend) */}
      <SectionCard flush title={t.aiAuditTitle}>
        {audit.length === 0 ? <EmptyNote label={t.listEmpty} /> : (
          <>
            <DataTable head={[t.aiUsageTime, t.aiAuditActor, t.aiAuditAction, t.aiAuditEntity]} minWidth={640}>
              {audit.map((a) => (
                <tr key={a.id} style={{ borderTop: '1px solid #f1eef8' }} title={a.afterSnapshot ?? a.beforeSnapshot ?? undefined}>
                  <td style={tdMuted}>{fmtAiDateTime(a.createdAt)}</td>
                  <td style={tdStyle}>{a.actorEmail ?? t.aiSystemActor}</td>
                  <td style={{ ...tdStyle, fontWeight: 600 }}>{aiAuditActionLabel(lang, a.action)}</td>
                  <td style={tdMuted}>{a.entityType}</td>
                </tr>
              ))}
            </DataTable>
            <div style={{ padding: '0 16px 16px' }}>
              <Pagination page={auditPage + 1} pageCount={auditPageCount} onChange={(p) => setAuditPage(p - 1)} />
            </div>
          </>
        )}
      </SectionCard>
    </div>
  );
}
