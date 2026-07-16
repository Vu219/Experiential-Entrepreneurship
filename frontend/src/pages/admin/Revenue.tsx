import { useEffect, useState } from 'react';
import { DollarSign, ShoppingBag, BarChart3, Download } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Card, Loader, Icon } from '../../components/ui';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import StatusBadge from '../../components/admin/StatusBadge';
import StatCard from '../../components/admin/StatCard';
import SectionCard from '../../components/admin/SectionCard';
import { DataTable } from '../../components/admin/AdminListPage';
import { getRevenue, formatVND, type RevenueData, type RevenuePeriod } from '../../api/admin';
import { getAdminPlans, type PlanDto } from '../../api/plans';
import { PLANS_INTENT_KEY, type PlansIntent } from './Plans';
import { useToast } from '../../components/toast/ToastProvider';

const PERIODS: RevenuePeriod[] = ['1m', '3m', '12m'];

/** Tạo file Blob rồi kích hoạt tải xuống — không cần thư viện ngoài. */
function downloadBlob(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function Revenue() {
  const { t, lang, go, brandGradient } = useApp();
  const toast = useToast();
  const { isMobile } = useBreakpoint();
  const [load, setLoad] = useState<'loading' | 'error' | 'ok'>('loading');
  const [period, setPeriod] = useState<RevenuePeriod>('1m');
  const [data, setData] = useState<RevenueData | null>(null);
  const [plans, setPlans] = useState<PlanDto[]>([]);

  const fetchAll = (p: RevenuePeriod) => {
    setLoad('loading');
    // Gói đọc từ API thật (/admin/plans) — chỉ hiển thị; chỉnh sửa ở trang Quản lý gói.
    Promise.all([getRevenue(p, lang), getAdminPlans()])
      .then(([rev, pl]) => {
        setData(rev);
        setPlans([...pl.plans].sort((a, b) => a.displayOrder - b.displayOrder));
        setLoad('ok');
      })
      .catch(() => setLoad('error'));
  };
  useEffect(() => fetchAll(period), [period, lang]);

  // Điều hướng sang trang Quản lý gói và mở sẵn đúng modal (sửa gói / tạo mới).
  const openPlans = (intent: PlansIntent) => {
    sessionStorage.setItem(PLANS_INTENT_KEY, JSON.stringify(intent));
    go('adminPlans');
  };

  const periodLabel = (p: RevenuePeriod) => (p === '1m' ? t.rev1m : p === '3m' ? t.rev3m : t.rev12m);

  // ===== Export (tôn trọng khoảng thời gian đang chọn) =====
  const exportTxt = () => {
    if (!data) return;
    const lines = [
      `AIMA — ${t.navAdminRevenue} (${periodLabel(period)})`,
      `${t.revTotal}: ${formatVND(data.total)}`,
      `${t.revOrders}: ${data.orders}`,
      `${t.revGrowth}: ${data.growth}`,
      '',
      `${t.revTransactions}:`,
      ...data.transactions.map((x) => `- ${x.id} | ${x.customer} | ${x.plan} | ${formatVND(x.amount)} | ${x.status} | ${x.date}`),
    ];
    downloadBlob(lines.join('\n'), `aima-revenue-${period}.txt`, 'text/plain;charset=utf-8');
  };

  const exportExcel = () => {
    if (!data) return;
    const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
    const header = [t.colTxn, t.colCustomer, t.colPlan, t.colAmount, t.colStatus, t.colDate].map(esc).join(',');
    const body = data.transactions.map((x) => [x.id, x.customer, x.plan, x.amount, x.status, x.date].map(esc).join(','));
    // BOM để Excel nhận đúng UTF-8 (tiếng Việt không lỗi font).
    downloadBlob('\uFEFF' + [header, ...body].join('\r\n'), `aima-revenue-${period}.csv`, 'text/csv;charset=utf-8');
  };

  // TODO(export-pdf): cần thư viện (jsPDF) — hỏi người dùng trước khi thêm dependency.
  const exportPdf = () => toast.info(t.revExportPdfTodo);

  if (load === 'loading') return <div className="view-pop" style={{ maxWidth: 1180, margin: '0 auto' }}><Card><Loader label={t.listLoading} /></Card></div>;
  if (load === 'error' || !data) return (
    <div className="view-pop" style={{ maxWidth: 1180, margin: '0 auto' }}>
      <Card style={{ textAlign: 'center', padding: '54px 16px' }}>
        <div style={{ fontSize: 14.5, fontWeight: 600, color: '#5b5670', marginBottom: 14 }}>{t.listError}</div>
        <button onClick={() => fetchAll(period)} style={{ border: 'none', borderRadius: 10, padding: '9px 18px', fontWeight: 700, fontSize: 13, color: '#fff', background: brandGradient, cursor: 'pointer' }}>{t.retry}</button>
      </Card>
    </div>
  );

  const maxVal = Math.max(...data.series.map((s) => s.value), 1);
  const cards = [
    { label: t.revTotal, value: formatVND(data.total), icon: DollarSign, bg: 'linear-gradient(135deg,#fff3e0,#ffe9f3)', color: '#ec4899' },
    { label: t.revOrders, value: String(data.orders), icon: ShoppingBag, bg: 'linear-gradient(135deg,#e9f0ff,#f1e9ff)', color: '#6366f1' },
    { label: t.revAvg, value: formatVND(Math.round(data.total / Math.max(data.orders, 1))), icon: BarChart3, bg: 'linear-gradient(135deg,#e7fff4,#e9f7ff)', color: '#10b981' },
  ];

  const periodBtn = (p: RevenuePeriod) => {
    const active = period === p;
    return (
      <button key={p} onClick={() => setPeriod(p)} style={{ border: '1px solid', borderColor: active ? 'transparent' : '#ece8f6', background: active ? brandGradient : '#fff', color: active ? '#fff' : '#5b5670', borderRadius: 9, padding: '7px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>{periodLabel(p)}</button>
    );
  };

  const exportBtn = (label: string, onClick: () => void) => (
    <button onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: 6, border: '1px solid #ece8f6', background: '#fff', borderRadius: 9, padding: '8px 12px', fontSize: 12.5, fontWeight: 700, color: '#5b5670', cursor: 'pointer' }}>
      <Icon icon={Download} size={15} stroke="#8b5cf6" /> {label}
    </button>
  );

  return (
    <div className="view-pop" style={{ maxWidth: 1180, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Period filter + export toolbar */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: 8 }}>{PERIODS.map(periodBtn)}</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {exportBtn('TXT', exportTxt)}
          {exportBtn('Excel', exportExcel)}
          {exportBtn('PDF', exportPdf)}
        </div>
      </div>

      {/* Overview cards — component quản trị dùng chung */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3,1fr)', gap: 18 }}>
        {cards.map((c, i) => (
          <StatCard key={i} icon={c.icon} iconBg={c.bg} iconColor={c.color} value={c.value} label={c.label}
            pill={i === 0 ? data.growth : null} pillTone="success" valueFontSize={24} />
        ))}
      </div>

      {/* Revenue chart */}
      <SectionCard title={`${t.revChart} · ${periodLabel(period)}`}>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: data.series.length > 16 ? 3 : 6, height: 180 }}>
          {data.series.map((s, i) => (
            <div key={i} title={String(s.value)} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, height: '100%', justifyContent: 'flex-end' }}>
              <div style={{ width: '100%', height: `${(s.value / maxVal) * 100}%`, borderRadius: 5, background: brandGradient, minHeight: 4 }} />
              {data.series.length <= 12 && <span style={{ fontSize: 10.5, color: '#a59fbb' }}>{s.label}</span>}
            </div>
          ))}
        </div>
      </SectionCard>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1.6fr 1fr', gap: 20, alignItems: 'start' }}>
        {/* Transactions */}
        <SectionCard flush title={t.revTransactions}>
          <DataTable head={[t.colTxn, t.colCustomer, t.colPlan, t.colAmount, t.colStatus, t.colDate]} minWidth={620}>
            {data.transactions.map((x) => (
              <tr key={x.id} style={{ borderTop: '1px solid #f1eef8' }}>
                <td style={{ padding: '12px 16px', fontSize: 12.5, fontWeight: 700, color: '#6b5ca8' }}>{x.id}</td>
                <td style={{ padding: '12px 16px', fontSize: 13.5, color: '#2b2543' }}>{x.customer}</td>
                <td style={{ padding: '12px 16px', fontSize: 13, color: '#6b6680' }}>{x.plan}</td>
                <td style={{ padding: '12px 16px', fontSize: 13.5, fontWeight: 600, color: '#2b2543' }}>{formatVND(x.amount)}</td>
                <td style={{ padding: '12px 16px' }}><StatusBadge tone={x.tone} label={x.status} /></td>
                <td style={{ padding: '12px 16px', fontSize: 13, color: '#8a85a0' }}>{x.date}</td>
              </tr>
            ))}
          </DataTable>
        </SectionCard>

        {/* Cấu hình giá gói — READ-ONLY: nơi sửa duy nhất là trang Quản lý gói (adminPlans) */}
        <SectionCard
          title={t.revPlans}
          action={
            <button onClick={() => openPlans({ action: 'create' })} style={{ border: 'none', borderRadius: 9, padding: '6px 12px', fontSize: 12.5, fontWeight: 700, color: '#fff', background: brandGradient, cursor: 'pointer' }}>+ {t.revAddPlan}</button>
          }
        >
          <div style={{ fontSize: 12, color: '#8a85a0', margin: '-8px 0 12px' }}>{t.revPlansReadOnly}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {plans.map((p) => (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', border: '1px solid #f1eef8', borderRadius: 12, opacity: p.isActive ? 1 : 0.65 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 13.5, fontWeight: 700, color: '#2b2543' }}>{lang === 'en' ? p.nameEn : p.nameVi}</span>
                    {!p.isActive && <StatusBadge tone="neutral" label={t.plActiveOff} />}
                  </div>
                  <div style={{ fontSize: 13, color: '#8a85a0' }}>{p.price === 0 ? 'Free' : formatVND(p.price) + (lang === 'en' ? (p.billingCycleEn ?? '') : (p.billingCycleVi ?? ''))}</div>
                </div>
                <button onClick={() => openPlans({ action: 'edit', id: p.id })} style={{ border: '1px solid #ece8f6', background: '#fff', borderRadius: 9, padding: '6px 12px', fontSize: 12.5, fontWeight: 700, color: '#5b5670', cursor: 'pointer' }}>{t.revEditPlan}</button>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
