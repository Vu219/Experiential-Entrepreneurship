import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ArrowRight, BarChart3, Download, Printer, ShoppingBag, Wallet } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Card, Icon, Loader } from '../../components/ui';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import { useToast } from '../../components/toast/ToastProvider';
import SectionCard from '../../components/admin/SectionCard';
import PageContainer from '../../components/PageContainer';
import RevenueFilterBar, { weekOf } from '../../components/admin/revenue/RevenueFilterBar';
import SparklineCard from '../../components/admin/revenue/SparklineCard';
import RevenueChart, { type RevenueChartMode } from '../../components/admin/revenue/RevenueChart';
import PlanDonut from '../../components/admin/revenue/PlanDonut';
import ForecastCard from '../../components/admin/revenue/ForecastCard';
import TransactionsTable, { type TxnSort } from '../../components/admin/revenue/TransactionsTable';
import OrdersTab from '../../components/admin/revenue/OrdersTab';
import { formatVND } from '../../api/admin';
import { getPaymentSummary, type AdminPaymentSummary } from '../../api/adminPayments';
import {
  countRevenueTransactions, exportRevenue, getRevenueForecast, getRevenuePlanBreakdown,
  getRevenueSummary, getRevenueTimeseries, getRevenueTransactions,
  type PaymentStatus, type PlanRevenue, type RevenueComparison, type RevenueFilter,
  type RevenueFilterMode, type RevenueForecast, type RevenueSummary, type RevenueTimeseries,
  type RevenueTransaction,
} from '../../api/revenue';
import { C } from '../../styles/colors';

// Trang admin "Doanh thu & Đơn hàng" — nối BE THẬT, cùng nguồn sổ cái `payments`.
// Tab Tổng quan (KPI, chart, cơ cấu gói, dự kiến, vài giao dịch mới nhất) và tab Đơn hàng
// (?tab=orders — hàng đợi + danh sách + thao tác tay; link cũ /admin/payments chuyển về đây).
// Hai tab dùng chung bộ lọc kỳ; bộ lọc đồng bộ lên URL để reload/chia sẻ link giữ nguyên trạng thái.

const EXPORT_ROW_LIMIT = 50_000;
/** Tab Tổng quan chỉ xem nhanh vài giao dịch mới nhất — danh sách đầy đủ ở tab Đơn hàng. */
const PREVIEW_ROWS = 5;

type Tab = 'overview' | 'orders';

type Load = 'loading' | 'error' | 'ok';

/** Bộ lọc mặc định khi vào trang lần đầu: các ngày trong tháng hiện tại. */
function defaultFilter(): RevenueFilter {
  const now = new Date();
  return { granularity: 'DAY', year: now.getFullYear(), month: now.getMonth() + 1 };
}

const pad2 = (n: number) => String(n).padStart(2, '0');

/** Kỳ của bộ lọc → khoảng ngày YYYY-MM-DD (`to` bao gồm) cho API danh sách đơn hàng. */
function filterDateRange(f: RevenueFilter): { from: string; to: string } {
  switch (f.granularity) {
    case 'DAY': {
      const last = new Date(f.year!, f.month!, 0).getDate();
      return { from: `${f.year}-${pad2(f.month!)}-01`, to: `${f.year}-${pad2(f.month!)}-${pad2(last)}` };
    }
    case 'MONTH':
      return { from: `${f.year}-01-01`, to: `${f.year}-12-31` };
    case 'YEAR':
      return { from: `${f.fromYear}-01-01`, to: `${f.toYear}-12-31` };
    case 'WEEK':
    case 'CUSTOM':
      return { from: f.from!, to: f.to! };
  }
}

/** Đọc bộ lọc từ URL; tham số hỏng/thiếu thì rơi về mặc định thay vì để BE báo lỗi 2038. */
function filterFromParams(params: URLSearchParams): RevenueFilter {
  const g = params.get('granularity') as RevenueFilterMode | null;
  const num = (key: string) => {
    const raw = params.get(key);
    const parsed = raw === null ? NaN : Number(raw);
    return Number.isFinite(parsed) ? parsed : undefined;
  };
  const now = new Date();

  switch (g) {
    case 'DAY':
      return { granularity: g, year: num('year') ?? now.getFullYear(), month: num('month') ?? now.getMonth() + 1 };
    case 'MONTH':
      return { granularity: g, year: num('year') ?? now.getFullYear() };
    case 'WEEK': {
      // Luôn chuẩn hoá về Thứ 2 → Chủ nhật của tuần chứa `from` (link sửa tay vẫn ra tuần đúng).
      const from = params.get('from');
      return from && /^\d{4}-\d{2}-\d{2}$/.test(from) ? { granularity: g, ...weekOf(from) } : defaultFilter();
    }
    case 'YEAR':
      return { granularity: g, fromYear: num('fromYear') ?? now.getFullYear() - 4, toYear: num('toYear') ?? now.getFullYear() };
    case 'CUSTOM': {
      const from = params.get('from');
      const to = params.get('to');
      return from && to ? { granularity: g, from, to } : defaultFilter();
    }
    default:
      return defaultFilter();
  }
}

export default function Revenue() {
  const { t, go, brandGradient } = useApp();
  const toast = useToast();
  const { isMobile } = useBreakpoint();
  const [params, setParams] = useSearchParams();

  // ---- Trạng thái bộ lọc (nguồn sự thật là URL) ----
  const filter = useMemo(() => filterFromParams(params), [params]);
  const tab: Tab = params.get('tab') === 'orders' ? 'orders' : 'overview';
  // Trạng thái lọc của tab Đơn hàng — nằm trên URL vì export ở thanh trên cũng áp theo nó.
  const status = (params.get('status') as PaymentStatus | null) ?? undefined;
  const sort: TxnSort = {
    field: params.get('sortField') === 'amount' ? 'amount' : 'date',
    asc: params.get('sortDir') === 'asc',
  };
  const chartMode: RevenueChartMode = params.get('chart') === 'cumulative' ? 'cumulative' : 'daily';

  /** Ghi state lên URL. */
  const patchParams = useCallback((patch: Record<string, string | undefined>) => {
    const next = new URLSearchParams(params);
    Object.entries(patch).forEach(([key, value]) => {
      if (value === undefined || value === '') next.delete(key);
      else next.set(key, value);
    });
    setParams(next, { replace: true });
  }, [params, setParams]);

  const applyFilter = useCallback((next: RevenueFilter) => {
    patchParams({
      granularity: next.granularity,
      year: next.year?.toString(),
      month: next.month?.toString(),
      fromYear: next.fromYear?.toString(),
      toYear: next.toYear?.toString(),
      from: next.from,
      to: next.to,
    });
  }, [patchParams]);

  // ---- Dữ liệu khối trên (KPI + chart + donut + dự kiến) ----
  const [coreLoad, setCoreLoad] = useState<Load>('loading');
  const [summary, setSummary] = useState<RevenueSummary | null>(null);
  const [series, setSeries] = useState<RevenueTimeseries | null>(null);
  const [plans, setPlans] = useState<PlanRevenue[]>([]);
  const [forecast, setForecast] = useState<RevenueForecast | null>(null);

  const filterKey = JSON.stringify(filter);
  const fetchCore = useCallback(() => {
    setCoreLoad('loading');
    Promise.all([
      getRevenueSummary(filter),
      getRevenueTimeseries(filter),
      getRevenuePlanBreakdown(filter),
      getRevenueForecast(),
    ])
      .then(([s, ts, pl, fc]) => {
        setSummary(s); setSeries(ts); setPlans(pl); setForecast(fc);
        setCoreLoad('ok');
      })
      .catch(() => setCoreLoad('error'));
    // filterKey đại diện cho nội dung filter — tránh vòng lặp do object mới mỗi lần render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterKey]);
  useEffect(() => { fetchCore(); }, [fetchCore]);

  // ---- Vài giao dịch mới nhất của kỳ (tab Tổng quan; sắp xếp server-side) ----
  const [txLoad, setTxLoad] = useState<Load>('loading');
  const [rows, setRows] = useState<RevenueTransaction[]>([]);
  const [total, setTotal] = useState(0);

  const fetchTx = useCallback(() => {
    setTxLoad('loading');
    getRevenueTransactions(filter, {
      page: 0,
      size: PREVIEW_ROWS,
      sort: `${sort.field},${sort.asc ? 'asc' : 'desc'}`,
    })
      .then((p) => {
        setRows(p.rows); setTotal(p.total);
        setTxLoad('ok');
      })
      .catch(() => setTxLoad('error'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterKey, sort.field, sort.asc]);
  useEffect(() => { fetchTx(); }, [fetchTx]);

  // ---- Badge hàng đợi đơn hàng (số trên nhãn tab + 3 thẻ của tab Đơn hàng) — theo kỳ đang lọc ----
  const orderRange = useMemo(() => filterDateRange(filter), [filter]);
  const [orderSummary, setOrderSummary] = useState<AdminPaymentSummary | null>(null);
  const loadOrderSummary = useCallback(() => {
    // Thẻ số hỏng không được chặn trang — bảng mới là thứ admin cần nhất.
    getPaymentSummary(orderRange).then(setOrderSummary).catch(() => undefined);
  }, [orderRange]);
  useEffect(() => { loadOrderSummary(); }, [loadOrderSummary]);

  // ---- Export ----
  const download = (content: string, filename: string, mime: string) => {
    // BOM để Excel đọc đúng UTF-8 (tiếng Việt không lỗi font).
    const blob = new Blob([mime.includes('csv') ? '﻿' + content : content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const [exporting, setExporting] = useState(false);
  const doExport = async (format: 'txt' | 'csv') => {
    setExporting(true);
    try {
      // Đếm trước: vượt trần thì báo SỐ THỰC TẾ, không cắt cụt im lặng.
      const count = await countRevenueTransactions(filter, { status });
      if (count > EXPORT_ROW_LIMIT) {
        toast.error(t.revExportTooLarge.replace('{n}', count.toLocaleString('vi-VN')));
        return;
      }
      const content = await exportRevenue(filter, { status }, format);
      const stamp = new Date().toISOString().slice(0, 10);
      download(
        content,
        `aima-doanh-thu-${stamp}.${format}`,
        format === 'txt' ? 'text/plain;charset=utf-8' : 'text/csv;charset=utf-8',
      );
    } catch {
      toast.error(t.revExportFailed);
    } finally {
      setExporting(false);
    }
  };

  // PDF = hộp thoại in của trình duyệt (Save as PDF) — không thêm thư viện nào.
  // Print stylesheet ở index.css ẩn sidebar/topbar/nút và giữ KPI + chart + bảng.
  const doPrint = () => window.print();

  // ---- Nhãn động ----
  const comparisonLabel: Record<RevenueComparison, string> = {
    PREV_MONTH: t.revVsPrevMonth,
    PREV_YEAR: t.revVsPrevYear,
    PREV_HALF: t.revVsPrevHalf,
    PREV_RANGE: t.revVsPrevRange,
  };
  // Tuần là chế độ FE gửi BE dạng CUSTOM (PREV_RANGE) — nói rõ "tuần trước" cho dễ hiểu.
  const cmpLabel = filter.granularity === 'WEEK' ? t.revVsPrevWeek
    : summary ? comparisonLabel[summary.comparison] : '';

  // ---- Khối trạng thái dùng lại ----
  const loadingBox = (height: number) => (
    <Card style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Loader label={t.listLoading} />
    </Card>
  );
  const errorBox = (retry: () => void) => (
    <Card style={{ textAlign: 'center', padding: '54px 16px' }}>
      <div style={{ fontSize: 14.5, fontWeight: 600, color: C.ink550, marginBottom: 14 }}>{t.listError}</div>
      <button onClick={retry} style={{
        border: 'none', borderRadius: 10, padding: '9px 18px', fontWeight: 700, fontSize: 13,
        color: C.onBrand, background: brandGradient, cursor: 'pointer',
      }}>
        {t.retry}
      </button>
    </Card>
  );
  const emptyBox = (message: string) => (
    <div style={{ textAlign: 'center', padding: '44px 16px', color: C.textMuted, fontSize: 13.5 }}>{message}</div>
  );

  const exportBtn = (label: string, onClick: () => void, icon = Download) => (
    <button onClick={onClick} disabled={exporting} style={{
      display: 'flex', alignItems: 'center', gap: 6, border: `1px solid ${C.border}`, background: C.surface,
      borderRadius: 9, padding: '8px 12px', fontSize: 12.5, fontWeight: 700, color: C.ink550,
      cursor: exporting ? 'wait' : 'pointer', opacity: exporting ? 0.6 : 1,
    }}>
      <Icon icon={icon} size={15} stroke={C.violetLight} /> {label}
    </button>
  );

  // Đường dự kiến chỉ có nghĩa khi chart đang vẽ đúng các ngày của tháng hiện tại.
  const chartForecast = forecast && filter.granularity === 'DAY'
    && forecast.month === `${filter.year}-${String(filter.month).padStart(2, '0')}` ? forecast : null;

  // Nhãn chế độ "từng bucket" theo đúng đơn vị bucket BE trả (ngày / tháng / năm).
  const bucketModeLabel = filter.granularity === 'YEAR' ? t.revModeYear
    : filter.granularity === 'MONTH' ? t.revModeMonth : t.revModeDay;

  const modeBtn = (mode: RevenueChartMode, label: string) => {
    const active = chartMode === mode;
    return (
      <button onClick={() => patchParams({ chart: mode === 'daily' ? undefined : mode })} style={{
        border: 'none', borderRadius: 8, padding: '0 12px', height: 30, fontSize: 12.5, fontWeight: 700,
        cursor: 'pointer', background: active ? C.surface : 'transparent', color: active ? C.primary : C.textMuted,
        boxShadow: active ? `0 2px 8px -3px ${C.legacyShadowrgba8040140_35_}` : 'none',
      }}>
        {label}
      </button>
    );
  };

  // Sparkline của 3 thẻ KPI lấy từ chuỗi timeseries đã tải (không gọi thêm API).
  const revenueSpark = series?.points.map((p) => p.revenue) ?? [];
  const txnSpark = series?.points.map((p) => p.transactions) ?? [];
  const avgSpark = series?.points.map((p) => (p.transactions > 0 ? Math.round(p.revenue / p.transactions) : 0)) ?? [];

  const tabBtn = (key: Tab, label: string, badge?: number) => {
    const active = tab === key;
    return (
      <button key={key} onClick={() => patchParams({ tab: key === 'overview' ? undefined : key })} style={{
        display: 'inline-flex', alignItems: 'center', gap: 7,
        border: '1px solid', borderColor: active ? 'transparent' : C.border, background: active ? brandGradient : C.surface,
        color: active ? C.onBrand : C.ink550, borderRadius: 9, padding: '7px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer',
      }}>
        {label}
        {!!badge && (
          <span style={{
            minWidth: 20, height: 20, padding: '0 6px', borderRadius: 999, fontSize: 11.5, fontWeight: 800,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    background: active ? C.legacyBgrgba255255255_25_ : C.warningSoft, color: active ? C.onBrand : C.warning,
          }}>{badge}</span>
        )}
      </button>
    );
  };

  return (
    <PageContainer>
      <div className="no-print" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {tabBtn('overview', t.revTabOverview)}
        {tabBtn('orders', t.revTabOrders, orderSummary?.reconcileRequired)}
      </div>

      {/* B — Thanh lọc thời gian + export (ẩn khi in) */}
      <div className="no-print" style={{
        display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', justifyContent: 'space-between',
      }}>
        <RevenueFilterBar value={filter} onChange={applyFilter} />
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {exportBtn('TXT', () => doExport('txt'))}
          {exportBtn('Excel', () => doExport('csv'))}
          {exportBtn('PDF', doPrint, Printer)}
        </div>
      </div>

      {tab === 'orders' && (
        <OrdersTab
          from={orderRange.from}
          to={orderRange.to}
          status={status ?? ''}
          onStatusChange={(v) => patchParams({ status: v || undefined })}
          summary={orderSummary}
          onSummaryStale={loadOrderSummary}
        />
      )}

      {tab === 'overview' && (coreLoad === 'loading' ? loadingBox(220)
        : coreLoad === 'error' ? errorBox(fetchCore)
          : summary && series && (
            <>
              {/* C — 3 thẻ KPI */}
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                <SparklineCard
                  icon={Wallet} iconBg={`linear-gradient(135deg,${C.purpleSoft},${C.legacyBgfae9ff})`} iconColor={C.violetLight}
                  label={t.revTotal} value={formatVND(summary.totalRevenue)}
                  deltaPct={summary.revenueDeltaPct} comparisonLabel={cmpLabel}
                  sparkline={revenueSpark} tone="violet"
                />
                <SparklineCard
                  icon={ShoppingBag} iconBg={`linear-gradient(135deg,${C.legacyBge9f0ff},${C.purpleSoft})`} iconColor={C.legacyText6366f1}
                  label={t.revOrders} value={summary.transactionCount.toLocaleString('vi-VN')}
                  deltaPct={summary.transactionDeltaPct} comparisonLabel={cmpLabel}
                  sparkline={txnSpark}
                />
                <SparklineCard
                  icon={BarChart3} iconBg={`linear-gradient(135deg,${C.legacyBge7fff4},${C.legacyBge9f7ff})`} iconColor={C.legacyText10b981}
                  label={t.revAvg} value={formatVND(summary.avgPerTransaction)}
                  deltaPct={summary.avgDeltaPct} comparisonLabel={cmpLabel}
                  sparkline={avgSpark}
                />
              </div>

              {/* Dòng phụ: hoàn tiền + tỉ lệ giao dịch thất bại của kỳ */}
              {(summary.refundedAmount > 0 || summary.failedCount > 0) && (
                <div style={{ fontSize: 12.5, color: C.textMuted, marginTop: -8, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                  {summary.refundedAmount > 0 && (
                    <span>{t.revRefundedInPeriod}: <strong style={{ color: C.danger }}>{formatVND(summary.refundedAmount)}</strong></span>
                  )}
                  {summary.failureRatePct !== null && (
                    <span>{t.revFailureRate}: <strong style={{ color: summary.failureRatePct > 10 ? C.danger : C.ink550 }}>
                      {summary.failureRatePct}%
                    </strong> ({summary.failedCount})</span>
                  )}
                </div>
              )}

              {/* D — Chart chính; đổi kỳ/chế độ ở nút Lọc trên cùng (không còn dropdown tắt ở đây). */}
              <SectionCard
                title={t.revChart}
                action={
                  <div className="no-print" style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <div role="group" style={{ display: 'flex', gap: 2, padding: 4, borderRadius: 10, background: C.surfaceMuted }}>
                      {modeBtn('daily', bucketModeLabel)}
                      {modeBtn('cumulative', t.revChartCumulative)}
                    </div>
                  </div>
                }
              >
                {series.points.every((p) => p.revenue === 0 && p.transactions === 0)
                  ? emptyBox(t.revNoDataPeriod)
                  : (
                    <div className="h-[240px] sm:h-[280px] xl:h-[320px]">
                      <RevenueChart points={series.points} mode={chartMode} forecast={chartForecast} />
                    </div>
                  )}
              </SectionCard>

              <div style={{
                display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1.6fr 1fr', gap: 20, alignItems: 'start',
              }}>
                {/* E — Bảng giao dịch */}
                <SectionCard
                  flush
                  title={t.revTransactions}
                  action={
                    <button className="no-print" onClick={() => patchParams({ tab: 'orders' })} style={{
                      display: 'inline-flex', alignItems: 'center', gap: 4, border: 'none', background: 'none',
                      padding: 0, fontSize: 13, fontWeight: 700, color: C.primary, cursor: 'pointer', whiteSpace: 'nowrap',
                    }}>
                      {t.revViewAllOrders} <ArrowRight size={15} strokeWidth={2.2} />
                    </button>
                  }
                >
                  {txLoad === 'loading' ? <div style={{ padding: '20px 0' }}><Loader label={t.listLoading} /></div>
                    : txLoad === 'error' ? (
                      <div style={{ textAlign: 'center', padding: '40px 16px' }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: C.ink550, marginBottom: 12 }}>{t.listError}</div>
                        <button onClick={fetchTx} style={{
                          border: 'none', borderRadius: 10, padding: '8px 16px', fontWeight: 700,
                          fontSize: 13, color: C.onBrand, background: brandGradient, cursor: 'pointer',
                        }}>{t.retry}</button>
                      </div>
                    )
                      : rows.length === 0 ? emptyBox(t.revNoTransactions)
                        : (
                          <>
                            <TransactionsTable rows={rows} sort={sort}
                              onSortChange={(next) => patchParams({
                                sortField: next.field, sortDir: next.asc ? 'asc' : 'desc',
                              })} />
                            <div className="no-print" style={{ padding: '12px 16px 16px', fontSize: 12.5, color: C.textMuted }}>
                              {t.revTotalCount.replace('{n}', total.toLocaleString('vi-VN'))}
                            </div>
                          </>
                        )}
                </SectionCard>

                {/* F — Panel phải: cơ cấu gói + doanh thu dự kiến */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                  <SectionCard
                    title={t.revPlanMix}
                    action={
                      <button className="no-print" onClick={() => go('adminPlans')} style={{
                        border: 'none', borderRadius: 9, padding: '6px 12px', fontSize: 12.5,
                        fontWeight: 700, color: C.onBrand, background: brandGradient, cursor: 'pointer',
                      }}>
                        + {t.revAddPlan}
                      </button>
                    }
                  >
                    <PlanDonut rows={plans} />
                  </SectionCard>

                  {forecast && (
                    <ForecastCard forecast={forecast} />
                  )}
                </div>
              </div>
            </>
          ))}
    </PageContainer>
  );
}
