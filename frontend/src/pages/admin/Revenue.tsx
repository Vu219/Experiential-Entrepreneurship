import { useEffect, useState } from 'react';
import { DollarSign, ShoppingBag, BarChart3, Download } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Card, Loader, Icon } from '../../components/ui';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import Modal from '../../components/Modal';
import StatusBadge from '../../components/admin/StatusBadge';
import { DataTable } from '../../components/admin/AdminListPage';
import {
  getRevenue, getPlans, savePlan, formatVND,
  type RevenueData, type RevenuePeriod, type PricingPlan,
} from '../../api/admin';

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
  const { t, lang, brandGradient } = useApp();
  const { isMobile } = useBreakpoint();
  const [load, setLoad] = useState<'loading' | 'error' | 'ok'>('loading');
  const [period, setPeriod] = useState<RevenuePeriod>('1m');
  const [data, setData] = useState<RevenueData | null>(null);
  const [plans, setPlans] = useState<PricingPlan[]>([]);
  const [editing, setEditing] = useState<PricingPlan | null>(null);

  const fetchAll = (p: RevenuePeriod) => {
    setLoad('loading');
    Promise.all([getRevenue(p, lang), getPlans()])
      .then(([rev, pl]) => { setData(rev); setPlans(pl); setLoad('ok'); })
      .catch(() => setLoad('error'));
  };
  useEffect(() => fetchAll(period), [period, lang]);

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
  const exportPdf = () => alert(t.revExportPdfTodo);

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

      {/* Overview cards */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3,1fr)', gap: 18 }}>
        {cards.map((c, i) => (
          <Card key={i} style={{ padding: 20, borderRadius: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ width: 40, height: 40, borderRadius: 11, background: c.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon icon={c.icon} stroke={c.color} />
              </div>
              {i === 0 && <span style={{ fontSize: 12.5, fontWeight: 700, color: '#16a34a', background: '#e8f8ee', padding: '3px 9px', borderRadius: 999 }}>{data.growth}</span>}
            </div>
            <div style={{ fontFamily: "'Plus Jakarta Sans'", fontWeight: 800, fontSize: 24, color: '#211c38', margin: '14px 0 2px' }}>{c.value}</div>
            <div style={{ fontSize: 13, color: '#8a85a0' }}>{c.label}</div>
          </Card>
        ))}
      </div>

      {/* Revenue chart */}
      <Card>
        <div style={{ fontWeight: 700, fontSize: 16, color: '#211c38', marginBottom: 18 }}>{t.revChart} · {periodLabel(period)}</div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: data.series.length > 16 ? 3 : 6, height: 180 }}>
          {data.series.map((s, i) => (
            <div key={i} title={String(s.value)} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, height: '100%', justifyContent: 'flex-end' }}>
              <div style={{ width: '100%', height: `${(s.value / maxVal) * 100}%`, borderRadius: 5, background: brandGradient, minHeight: 4 }} />
              {data.series.length <= 12 && <span style={{ fontSize: 10.5, color: '#a59fbb' }}>{s.label}</span>}
            </div>
          ))}
        </div>
      </Card>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1.6fr 1fr', gap: 20, alignItems: 'start' }}>
        {/* Transactions */}
        <Card style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #f1eef8', fontWeight: 700, fontSize: 16, color: '#211c38' }}>{t.revTransactions}</div>
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
        </Card>

        {/* Plan pricing config */}
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div style={{ fontWeight: 700, fontSize: 16, color: '#211c38' }}>{t.revPlans}</div>
            <button onClick={() => setEditing({ id: '', name: '', price: 0, active: true })} style={{ border: 'none', borderRadius: 9, padding: '6px 12px', fontSize: 12.5, fontWeight: 700, color: '#fff', background: brandGradient, cursor: 'pointer' }}>+ {t.revAddPlan}</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {plans.map((p) => (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', border: '1px solid #f1eef8', borderRadius: 12 }}>
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: '#2b2543' }}>{p.name}</div>
                  <div style={{ fontSize: 13, color: '#8a85a0' }}>{p.price === 0 ? 'Free' : formatVND(p.price) + '/mo'}</div>
                </div>
                <button onClick={() => setEditing(p)} style={{ border: '1px solid #ece8f6', background: '#fff', borderRadius: 9, padding: '6px 12px', fontSize: 12.5, fontWeight: 700, color: '#5b5670', cursor: 'pointer' }}>{t.revEditPlan}</button>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {editing && (
        <PlanModal
          plan={editing}
          onClose={() => setEditing(null)}
          onSave={(p) => {
            savePlan(p).then((saved) => {
              setPlans((prev) => (prev.some((x) => x.id === saved.id) ? prev.map((x) => (x.id === saved.id ? saved : x)) : [...prev, saved]));
              setEditing(null);
            });
          }}
        />
      )}
    </div>
  );
}

function PlanModal({ plan, onClose, onSave }: { plan: PricingPlan; onClose: () => void; onSave: (p: PricingPlan) => void }) {
  const { t, brandGradient } = useApp();
  const isNew = !plan.id;
  const [name, setName] = useState(plan.name);
  const [price, setPrice] = useState(String(plan.price));

  const field = { width: '100%', border: '1px solid #ece8f6', borderRadius: 10, padding: '10px 12px', fontSize: 14, color: '#241f3a', outline: 'none' } as const;
  const label = { fontSize: 11.5, fontWeight: 700, letterSpacing: '.04em', color: '#a59fbb', marginBottom: 6, display: 'block' } as const;

  const submit = () => {
    const id = plan.id || name.trim().toLowerCase().replace(/\s+/g, '-');
    onSave({ id, name: name.trim(), price: Number(price) || 0, active: plan.active });
  };

  return (
    <Modal title={isNew ? t.revNewPlan : t.revEditPlan} onClose={onClose}>
      <div style={{ marginBottom: 14 }}>
        <label style={label}>{t.revPlanName}</label>
        <input value={name} onChange={(e) => setName(e.target.value)} style={field} placeholder="Pro" />
      </div>
      <div style={{ marginBottom: 18 }}>
        <label style={label}>{t.revPlanPrice}</label>
        <input value={price} onChange={(e) => setPrice(e.target.value.replace(/[^\d]/g, ''))} inputMode="numeric" style={field} placeholder="499000" />
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        <button onClick={onClose} style={{ flex: 1, border: '1px solid #ece8f6', background: '#fff', borderRadius: 10, padding: '10px 0', fontSize: 14, fontWeight: 700, color: '#5b5670', cursor: 'pointer' }}>{t.cancel}</button>
        <button onClick={submit} disabled={!name.trim()} style={{ flex: 1, border: 'none', borderRadius: 10, padding: '10px 0', fontSize: 14, fontWeight: 700, color: '#fff', background: brandGradient, cursor: name.trim() ? 'pointer' : 'default', opacity: name.trim() ? 1 : 0.6 }}>{t.save}</button>
      </div>
    </Modal>
  );
}
