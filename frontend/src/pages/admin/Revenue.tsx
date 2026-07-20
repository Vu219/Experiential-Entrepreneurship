import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { BarChart3, Download, Printer, ShoppingBag, Wallet } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Card, Icon, Loader } from '../../components/ui';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import { useToast } from '../../components/toast/ToastProvider';
import SectionCard from '../../components/admin/SectionCard';
import Pagination from '../../components/admin/Pagination';
import { FilterSelect } from '../../components/admin/AdminListPage';
import PageContainer from '../../components/PageContainer';
import RevenueFilterBar from '../../components/admin/revenue/RevenueFilterBar';
import SparklineCard from '../../components/admin/revenue/SparklineCard';
import RevenueChart from '../../components/admin/revenue/RevenueChart';
import PlanDonut from '../../components/admin/revenue/PlanDonut';
import TransactionsTable, { type TxnSort } from '../../components/admin/revenue/TransactionsTable';
import { formatVND } from '../../api/admin';
import {
  countRevenueTransactions, exportRevenue, getRevenueForecast, getRevenuePlanBreakdown,
  getRevenueSummary, getRevenueTimeseries, getRevenueTransactions,
  type PaymentStatus, type PlanRevenue, type RevenueComparison, type RevenueFilter,
  type RevenueForecast, type RevenueGranularity, type RevenueSummary, type RevenueTimeseries,
  type RevenueTransaction,
} from '../../api/revenue';

// Trang admin "Quản lý doanh thu" — nối BE THẬT (/admin/revenue, sổ cái `payments`).
// Bộ lọc đồng bộ lên URL query để reload/chia sẻ link giữ nguyên trạng thái.

const EXPORT_ROW_LIMIT = 50_000;
const PAGE_SIZES: [string, string][] = [['10', '10'], ['20', '20'], ['50', '50']];

type Load = 'loading' | 'error' | 'ok';

/** Bộ lọc mặc định khi vào trang lần đầu: các ngày trong tháng hiện tại. */
function defaultFilter(): RevenueFilter {
  const now = new Date();
  return { granularity: 'DAY', year: now.getFullYear(), month: now.getMonth() + 1 };
}

/** Đọc bộ lọc từ URL; tham số hỏng/thiếu thì rơi về mặc định thay vì để BE báo lỗi 2038. */
function filterFromParams(params: URLSearchParams): RevenueFilter {
  const g = params.get('granularity') as RevenueGranularity | null;
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
    case 'HALF_YEAR':
      return { granularity: g, year: num('year') ?? now.getFullYear(), half: (num('half') === 2 ? 2 : 1) };
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
  const status = (params.get('status') as PaymentStatus | null) ?? undefined;
  const page = Number(params.get('page') ?? '1');
  const size = Number(params.get('size') ?? '10');
  const sort: TxnSort = {
    field: params.get('sortField') === 'amount' ? 'amount' : 'date',
    asc: params.get('sortDir') === 'asc',
  };

  /** Ghi state lên URL. Đổi bộ lọc luôn kéo trang về 1 (kết quả đã khác hoàn toàn). */
  const patchParams = useCallback((patch: Record<string, string | undefined>, resetPage = false) => {
    const next = new URLSearchParams(params);
    Object.entries(patch).forEach(([key, value]) => {
      if (value === undefined || value === '') next.delete(key);
      else next.set(key, value);
    });
    if (resetPage) next.delete('page');
    setParams(next, { replace: true });
  }, [params, setParams]);

  const applyFilter = useCallback((next: RevenueFilter) => {
    patchParams({
      granularity: next.granularity,
      year: next.year?.toString(),
      month: next.month?.toString(),
      half: next.half?.toString(),
      fromYear: next.fromYear?.toString(),
      toYear: next.toYear?.toString(),
      from: next.from,
      to: next.to,
    }, true);
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

  // ---- Bảng giao dịch (phân trang/sắp xếp server-side) ----
  const [txLoad, setTxLoad] = useState<Load>('loading');
  const [rows, setRows] = useState<RevenueTransaction[]>([]);
  const [pageCount, setPageCount] = useState(0);
  const [total, setTotal] = useState(0);

  const fetchTx = useCallback(() => {
    setTxLoad('loading');
    getRevenueTransactions(filter, {
      status,
      page: Math.max(page - 1, 0),
      size,
      sort: `${sort.field},${sort.asc ? 'asc' : 'desc'}`,
    })
      .then((p) => {
        setRows(p.rows); setPageCount(p.pageCount); setTotal(p.total);
        setTxLoad('ok');
      })
      .catch(() => setTxLoad('error'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterKey, status, page, size, sort.field, sort.asc]);
  useEffect(() => { fetchTx(); }, [fetchTx]);

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

  const statusOptions: [string, string][] = [
    ['', t.revStatusAll],
    ['PAID', t.revStatusPaid],
    ['PENDING', t.revStatusPending],
    ['FAILED', t.revStatusFailed],
    ['REFUNDED', t.revStatusRefunded],
    ['PARTIALLY_REFUNDED', t.revStatusPartial],
  ];

  const granularityOptions: [string, string][] = [
    ['DAY', t.revModeDay], ['MONTH', t.revModeMonth],
    ['HALF_YEAR', t.revModeHalf], ['YEAR', t.revModeYear],
  ];

  // ---- Khối trạng thái dùng lại ----
  const loadingBox = (height: number) => (
    <Card style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Loader label={t.listLoading} />
    </Card>
  );
  const errorBox = (retry: () => void) => (
    <Card style={{ textAlign: 'center', padding: '54px 16px' }}>
      <div style={{ fontSize: 14.5, fontWeight: 600, color: '#5b5670', marginBottom: 14 }}>{t.listError}</div>
      <button onClick={retry} style={{
        border: 'none', borderRadius: 10, padding: '9px 18px', fontWeight: 700, fontSize: 13,
        color: '#fff', background: brandGradient, cursor: 'pointer',
      }}>
        {t.retry}
      </button>
    </Card>
  );
  const emptyBox = (message: string) => (
    <div style={{ textAlign: 'center', padding: '44px 16px', color: '#8a85a0', fontSize: 13.5 }}>{message}</div>
  );

  const exportBtn = (label: string, onClick: () => void, icon = Download) => (
    <button onClick={onClick} disabled={exporting} style={{
      display: 'flex', alignItems: 'center', gap: 6, border: '1px solid #ece8f6', background: '#fff',
      borderRadius: 9, padding: '8px 12px', fontSize: 12.5, fontWeight: 700, color: '#5b5670',
      cursor: exporting ? 'wait' : 'pointer', opacity: exporting ? 0.6 : 1,
    }}>
      <Icon icon={icon} size={15} stroke="#8b5cf6" /> {label}
    </button>
  );

  // Sparkline của 3 thẻ KPI lấy từ chuỗi timeseries đã tải (không gọi thêm API).
  const revenueSpark = series?.points.map((p) => p.revenue) ?? [];
  const txnSpark = series?.points.map((p) => p.transactions) ?? [];
  const avgSpark = series?.points.map((p) => (p.transactions > 0 ? Math.round(p.revenue / p.transactions) : 0)) ?? [];

  return (
    <PageContainer>
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

      {coreLoad === 'loading' ? loadingBox(220)
        : coreLoad === 'error' ? errorBox(fetchCore)
          : summary && series && (
            <>
              {/* C — 3 thẻ KPI */}
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                <SparklineCard
                  icon={Wallet} iconBg="linear-gradient(135deg,#f1e9ff,#fae9ff)" iconColor="#8b5cf6"
                  label={t.revTotal} value={formatVND(summary.totalRevenue)}
                  deltaPct={summary.revenueDeltaPct} comparisonLabel={comparisonLabel[summary.comparison]}
                  sparkline={revenueSpark} tone="violet"
                />
                <SparklineCard
                  icon={ShoppingBag} iconBg="linear-gradient(135deg,#e9f0ff,#f1e9ff)" iconColor="#6366f1"
                  label={t.revOrders} value={summary.transactionCount.toLocaleString('vi-VN')}
                  deltaPct={summary.transactionDeltaPct} comparisonLabel={comparisonLabel[summary.comparison]}
                  sparkline={txnSpark}
                />
                <SparklineCard
                  icon={BarChart3} iconBg="linear-gradient(135deg,#e7fff4,#e9f7ff)" iconColor="#10b981"
                  label={t.revAvg} value={formatVND(summary.avgPerTransaction)}
                  deltaPct={summary.avgDeltaPct} comparisonLabel={comparisonLabel[summary.comparison]}
                  sparkline={avgSpark}
                />
              </div>

              {/* Dòng phụ: hoàn tiền + tỉ lệ giao dịch thất bại của kỳ */}
              {(summary.refundedAmount > 0 || summary.failedCount > 0) && (
                <div style={{ fontSize: 12.5, color: '#8a85a0', marginTop: -8, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                  {summary.refundedAmount > 0 && (
                    <span>{t.revRefundedInPeriod}: <strong style={{ color: '#dc2626' }}>{formatVND(summary.refundedAmount)}</strong></span>
                  )}
                  {summary.failureRatePct !== null && (
                    <span>{t.revFailureRate}: <strong style={{ color: summary.failureRatePct > 10 ? '#dc2626' : '#5b5670' }}>
                      {summary.failureRatePct}%
                    </strong> ({summary.failedCount})</span>
                  )}
                </div>
              )}

              {/* D — Chart chính, dropdown đổi nhanh granularity ở góc phải */}
              <SectionCard
                title={t.revChart}
                action={
                  <div className="no-print">
                    <FilterSelect
                      value={filter.granularity === 'CUSTOM' ? 'DAY' : filter.granularity}
                      options={granularityOptions}
                      onChange={(v) => {
                        const now = new Date();
                        const g = v as RevenueGranularity;
                        applyFilter(
                          g === 'DAY' ? { granularity: g, year: now.getFullYear(), month: now.getMonth() + 1 }
                            : g === 'MONTH' ? { granularity: g, year: now.getFullYear() }
                              : g === 'HALF_YEAR' ? { granularity: g, year: now.getFullYear(), half: now.getMonth() < 6 ? 1 : 2 }
                                : { granularity: g, fromYear: now.getFullYear() - 4, toYear: now.getFullYear() },
                        );
                      }}
                    />
                  </div>
                }
              >
                {series.points.every((p) => p.revenue === 0 && p.transactions === 0)
                  ? emptyBox(t.revNoDataPeriod)
                  : (
                    <div className="h-[280px] sm:h-[360px] xl:h-[440px]">
                      <RevenueChart points={series.points} />
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
                    <div className="no-print" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <FilterSelect value={status ?? ''} options={statusOptions}
                        onChange={(v) => patchParams({ status: v || undefined }, true)} />
                      <FilterSelect value={String(size)} options={PAGE_SIZES}
                        onChange={(v) => patchParams({ size: v }, true)} />
                    </div>
                  }
                >
                  {txLoad === 'loading' ? <div style={{ padding: '20px 0' }}><Loader label={t.listLoading} /></div>
                    : txLoad === 'error' ? (
                      <div style={{ textAlign: 'center', padding: '40px 16px' }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: '#5b5670', marginBottom: 12 }}>{t.listError}</div>
                        <button onClick={fetchTx} style={{
                          border: 'none', borderRadius: 10, padding: '8px 16px', fontWeight: 700,
                          fontSize: 13, color: '#fff', background: brandGradient, cursor: 'pointer',
                        }}>{t.retry}</button>
                      </div>
                    )
                      : rows.length === 0 ? emptyBox(t.revNoTransactions)
                        : (
                          <>
                            <TransactionsTable rows={rows} sort={sort}
                              onSortChange={(next) => patchParams({
                                sortField: next.field, sortDir: next.asc ? 'asc' : 'desc',
                              }, true)} />
                            <div className="no-print" style={{ padding: '0 16px 16px' }}>
                              <div style={{ fontSize: 12.5, color: '#8a85a0', marginTop: 12 }}>
                                {t.revTotalCount.replace('{n}', total.toLocaleString('vi-VN'))}
                              </div>
                              <Pagination page={page} pageCount={pageCount}
                                onChange={(p) => patchParams({ page: String(p) })} />
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
                        fontWeight: 700, color: '#fff', background: brandGradient, cursor: 'pointer',
                      }}>
                        + {t.revAddPlan}
                      </button>
                    }
                  >
                    <PlanDonut rows={plans} />
                  </SectionCard>

                  {forecast && (
                    <SparklineCard
                      label={t.revForecast} value={formatVND(forecast.projected)}
                      deltaPct={forecast.deltaPct} comparisonLabel={t.revVsPrevMonth}
                      sparkline={forecast.sparkline}
                      footer={
                        <div style={{ fontSize: 11.5, color: '#a59fbb', marginTop: 12, lineHeight: 1.5 }}>
                          {t.revForecastNote
                            .replace('{actual}', formatVND(forecast.actualSoFar))
                            .replace('{elapsed}', String(forecast.daysElapsed))
                            .replace('{total}', String(forecast.daysInMonth))}
                        </div>
                      }
                    />
                  )}
                </div>
              </div>
            </>
          )}
    </PageContainer>
  );
}
