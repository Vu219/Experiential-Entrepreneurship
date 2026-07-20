package com.aima.service.Impl;

import com.aima.dto.response.ApiResponse;
import com.aima.dto.response.PageResponse;
import com.aima.dto.response.PlanRevenueResponse;
import com.aima.dto.response.RevenueForecastResponse;
import com.aima.dto.response.RevenueSeriesPointResponse;
import com.aima.dto.response.RevenueSummaryResponse;
import com.aima.dto.response.RevenueTimeseriesResponse;
import com.aima.dto.response.RevenueTransactionResponse;
import com.aima.entity.Payment;
import com.aima.entity.Plan;
import com.aima.entity.User;
import com.aima.enums.PaymentGateway;
import com.aima.enums.PaymentStatus;
import com.aima.enums.RevenueGranularity;
import com.aima.exception.AppException;
import com.aima.exception.ErrorCode;
import com.aima.mapper.RevenueMapper;
import com.aima.repository.PaymentRepository;
import com.aima.repository.PlanRepository;
import com.aima.repository.UserRepository;
import com.aima.service.RevenueService;
import com.aima.service.SystemLogService;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.experimental.NonFinal;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.env.Environment;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.YearMonth;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Random;

/**
 * Báo cáo doanh thu từ sổ cái {@code payments}. Xem {@link RevenueService} cho công thức đã chốt.
 *
 * <p><b>Không có lớp cache.</b> Dự án chưa bật Spring Cache và các query ở đây là aggregate có
 * index, chạy một lần mỗi lần mở trang (không phải hot path như resolve hệ số quy đổi). Thêm cache
 * TTL ở đây chỉ tạo cửa sổ dữ liệu cũ ngay sau khi admin ghi nhận giao dịch — cố ý bỏ.
 */
@Service
@RequiredArgsConstructor
@Slf4j
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class RevenueServiceImpl implements RevenueService {

    /** Khoảng xem tối đa cho mọi chế độ (chặn quét toàn bảng do tham số bịa). */
    static final int MAX_SPAN_YEARS = 10;

    /** Chế độ tuỳ chỉnh gộp theo NGÀY nên phải chặn thêm, kẻo chart có hàng nghìn cột. */
    static final int MAX_CUSTOM_DAYS = 366;

    /** Tiền tố note của bản ghi do dev seeder sinh — dùng để dọn lại đúng phần đó. */
    static final String SEED_NOTE_PREFIX = "dev-seed:";

    static final DateTimeFormatter DAY_MONTH = DateTimeFormatter.ofPattern("dd/MM");
    static final DateTimeFormatter MONTH_KEY = DateTimeFormatter.ofPattern("yyyy-MM");

    PaymentRepository paymentRepository;
    PlanRepository planRepository;
    UserRepository userRepository;
    RevenueMapper revenueMapper;
    SystemLogService systemLogService;
    Environment environment;

    /** Cờ dev-only cho devSeed — mặc định TẮT, chỉ bật ở môi trường dev (.env). */
    @NonFinal
    @Value("${aima.dev.payment-seed-enabled:false}")
    boolean paymentSeedEnabled;

    /** Công tắc production ĐỘC LẬP với Spring profile — chặn cứng mọi dev-tool. */
    @NonFinal
    @Value("${aima.production-mode:false}")
    boolean productionMode;

    // ===================== Đọc báo cáo =====================

    @Override
    @Transactional(readOnly = true)
    public ApiResponse<RevenueSummaryResponse> summary(RevenueFilter filter) {
        Period period = resolve(filter);
        Collection<String> paid = PaymentStatus.revenueRecognizedNames();

        PaymentRepository.RevenueTotals current =
                paymentRepository.aggregateTotals(period.start(), period.end(), paid);
        PaymentRepository.RevenueTotals previous =
                paymentRepository.aggregateTotals(period.previousStart(), period.previousEnd(), paid);

        long net = netOf(current);
        long txn = value(current.getTxnCount());
        long failed = value(current.getFailedCount());
        long prevNet = netOf(previous);
        long prevTxn = value(previous.getTxnCount());

        long attempted = txn + failed;
        RevenueSummaryResponse summary = RevenueSummaryResponse.builder()
                .totalRevenue(net)
                .grossRevenue(value(current.getGross()))
                .refundedAmount(value(current.getRefunded()))
                .transactionCount(txn)
                .avgPerTransaction(txn > 0 ? net / txn : 0L)
                .failedCount(failed)
                .failureRatePct(attempted > 0 ? round1(failed * 100.0 / attempted) : null)
                .revenueDeltaPct(deltaPct(net, prevNet))
                .transactionDeltaPct(deltaPct(txn, prevTxn))
                .avgDeltaPct(deltaPct(txn > 0 ? net / txn : 0L, prevTxn > 0 ? prevNet / prevTxn : 0L))
                .comparison(period.comparison())
                .periodStart(period.start())
                .periodEnd(period.end())
                .build();
        return ApiResponse.success("Lấy tổng quan doanh thu thành công", summary);
    }

    @Override
    @Transactional(readOnly = true)
    public ApiResponse<RevenueTimeseriesResponse> timeseries(RevenueFilter filter) {
        Period period = resolve(filter);
        RevenueTimeseriesResponse series = RevenueTimeseriesResponse.builder()
                .granularity(period.granularity())
                .periodStart(period.start())
                .periodEnd(period.end())
                .points(buildPoints(period))
                .build();
        return ApiResponse.success("Lấy chuỗi doanh thu theo thời gian thành công", series);
    }

    @Override
    @Transactional(readOnly = true)
    public ApiResponse<PageResponse<RevenueTransactionResponse>> transactions(RevenueFilter filter,
                                                                              TransactionFilter txFilter,
                                                                              int page, int size, String sort) {
        Period period = resolve(filter);
        Pageable pageable = PageRequest.of(Math.max(page, 0), clampSize(size), parseSort(sort));

        Page<PaymentRepository.TransactionRow> rows = paymentRepository.search(
                txFilter.status(), txFilter.planId(), period.start(), period.end(), pageable);

        List<RevenueTransactionResponse> content = revenueMapper.toTransactionResponseList(rows.getContent());
        PageResponse<RevenueTransactionResponse> result = PageResponse.from(rows, content);
        return ApiResponse.success("Lấy danh sách giao dịch thành công", result);
    }

    @Override
    @Transactional(readOnly = true)
    public ApiResponse<List<PlanRevenueResponse>> planBreakdown(RevenueFilter filter) {
        Period period = resolve(filter);
        List<PaymentRepository.PlanRevenue> aggs = paymentRepository.aggregateByPlan(
                period.start(), period.end(), PaymentStatus.revenueRecognizedNames());

        long totalTxn = aggs.stream().mapToLong(a -> value(a.getTxnCount())).sum();
        List<PlanRevenueResponse> breakdown = revenueMapper.toPlanRevenueResponseList(aggs);
        // Tỉ lệ tính sau khi map vì cần TỔNG toàn kỳ — mapper không nhìn thấy các dòng khác.
        breakdown.forEach(row -> row.setSharePct(
                totalTxn > 0 ? round1(value(row.getTransactions()) * 100.0 / totalTxn) : 0.0));

        return ApiResponse.success("Lấy cơ cấu doanh thu theo gói thành công", breakdown);
    }

    @Override
    @Transactional(readOnly = true)
    public ApiResponse<RevenueForecastResponse> forecast() {
        LocalDateTime now = LocalDateTime.now();
        YearMonth thisMonth = YearMonth.from(now);
        LocalDateTime monthStart = thisMonth.atDay(1).atStartOfDay();
        LocalDateTime monthEnd = monthStart.plusMonths(1);

        // Chuỗi net theo NGÀY của tháng này (đã điền 0) — vừa để cộng thực tế vừa vẽ sparkline.
        Period monthPeriod = new Period(RevenueGranularity.DAY, monthStart, monthEnd,
                monthStart.minusMonths(1), monthStart, "PREV_MONTH");
        List<RevenueSeriesPointResponse> daily = buildPoints(monthPeriod);

        int daysInMonth = thisMonth.lengthOfMonth();
        int daysElapsed = now.getDayOfMonth();
        // Sparkline chỉ tới hôm nay; các ngày chưa tới để trống thay vì hiển thị 0 gây hiểu nhầm.
        List<Long> sparkline = daily.stream().limit(daysElapsed).map(RevenueSeriesPointResponse::getRevenue).toList();
        long actual = sparkline.stream().mapToLong(Long::longValue).sum();
        long projected = daysElapsed > 0 ? actual * daysInMonth / daysElapsed : 0L;

        long prevMonth = netOf(paymentRepository.aggregateTotals(
                monthStart.minusMonths(1), monthStart, PaymentStatus.revenueRecognizedNames()));

        RevenueForecastResponse response = RevenueForecastResponse.builder()
                .month(thisMonth.format(MONTH_KEY))
                .actualSoFar(actual)
                .projected(projected)
                .previousMonth(prevMonth)
                .deltaPct(deltaPct(projected, prevMonth))
                .daysElapsed(daysElapsed)
                .daysInMonth(daysInMonth)
                .sparkline(sparkline)
                .build();
        return ApiResponse.success("Lấy doanh thu dự kiến tháng này thành công", response);
    }

    @Override
    @Transactional(readOnly = true)
    public ApiResponse<Long> countTransactions(RevenueFilter filter, TransactionFilter txFilter) {
        Period period = resolve(filter);
        Page<PaymentRepository.TransactionRow> probe = paymentRepository.search(
                txFilter.status(), txFilter.planId(), period.start(), period.end(),
                PageRequest.of(0, 1));
        return ApiResponse.success("Đếm giao dịch thành công", probe.getTotalElements());
    }

    @Override
    @Transactional(readOnly = true)
    public ApiResponse<String> export(RevenueFilter filter, TransactionFilter txFilter, String format) {
        Period period = resolve(filter);

        long total = paymentRepository.search(txFilter.status(), txFilter.planId(),
                period.start(), period.end(), PageRequest.of(0, 1)).getTotalElements();
        // Không cắt cụt im lặng: vượt trần thì báo lỗi để admin thu hẹp bộ lọc.
        if (total > EXPORT_ROW_LIMIT) {
            throw new AppException(ErrorCode.REVENUE_EXPORT_TOO_LARGE);
        }

        List<RevenueTransactionResponse> rows = revenueMapper.toTransactionResponseList(
                paymentRepository.searchAll(txFilter.status(), txFilter.planId(), period.start(), period.end()));
        boolean asText = "txt".equalsIgnoreCase(format);
        String body = asText ? buildTxt(period, rows) : buildCsv(rows);
        return ApiResponse.success("Xuất báo cáo doanh thu thành công", body);
    }

    // ===================== Phân giải kỳ =====================

    /**
     * Quy bộ lọc thô thành khoảng {@code [start, end)} + khoảng kỳ trước để so sánh.
     * Mọi mốc là giờ VN (cột timestamp lưu local theo APP_TIMEZONE nên không cần convert).
     */
    private Period resolve(RevenueFilter filter) {
        RevenueGranularity granularity = filter.granularity() == null
                ? RevenueGranularity.MONTH : filter.granularity();

        Period period = switch (granularity) {
            case DAY -> {
                requireParams(filter.year() != null && filter.month() != null);
                validateYear(filter.year());
                requireRange(filter.month() >= 1 && filter.month() <= 12);
                LocalDateTime start = LocalDate.of(filter.year(), filter.month(), 1).atStartOfDay();
                yield new Period(granularity, start, start.plusMonths(1),
                        start.minusMonths(1), start, "PREV_MONTH");
            }
            case MONTH -> {
                requireParams(filter.year() != null);
                validateYear(filter.year());
                LocalDateTime start = LocalDate.of(filter.year(), 1, 1).atStartOfDay();
                yield new Period(granularity, start, start.plusYears(1),
                        start.minusYears(1), start, "PREV_YEAR");
            }
            case HALF_YEAR -> {
                requireParams(filter.year() != null && filter.half() != null);
                validateYear(filter.year());
                requireRange(filter.half() == 1 || filter.half() == 2);
                LocalDateTime start = LocalDate.of(filter.year(), filter.half() == 1 ? 1 : 7, 1).atStartOfDay();
                yield new Period(granularity, start, start.plusMonths(6),
                        start.minusMonths(6), start, "PREV_HALF");
            }
            case YEAR -> {
                requireParams(filter.fromYear() != null && filter.toYear() != null);
                validateYear(filter.fromYear());
                validateYear(filter.toYear());
                requireRange(filter.fromYear() <= filter.toYear());
                LocalDateTime start = LocalDate.of(filter.fromYear(), 1, 1).atStartOfDay();
                LocalDateTime end = LocalDate.of(filter.toYear() + 1, 1, 1).atStartOfDay();
                int span = filter.toYear() - filter.fromYear() + 1;
                yield new Period(granularity, start, end, start.minusYears(span), start, "PREV_RANGE");
            }
            case CUSTOM -> {
                requireParams(filter.from() != null && filter.to() != null);
                requireRange(!filter.from().isAfter(filter.to()));
                LocalDateTime start = filter.from().atStartOfDay();
                // `to` là ngày INCLUSIVE theo cảm nhận người dùng → mốc kết thúc là đầu ngày kế tiếp.
                LocalDateTime end = filter.to().plusDays(1).atStartOfDay();
                if (ChronoUnit.DAYS.between(start, end) > MAX_CUSTOM_DAYS) {
                    throw new AppException(ErrorCode.REVENUE_RANGE_TOO_LARGE);
                }
                long days = ChronoUnit.DAYS.between(start, end);
                yield new Period(granularity, start, end, start.minusDays(days), start, "PREV_RANGE");
            }
        };

        if (ChronoUnit.YEARS.between(period.start(), period.end()) > MAX_SPAN_YEARS) {
            throw new AppException(ErrorCode.REVENUE_RANGE_TOO_LARGE);
        }
        return period;
    }

    private void requireParams(boolean ok) {
        if (!ok) {
            throw new AppException(ErrorCode.REVENUE_PARAM_REQUIRED);
        }
    }

    private void requireRange(boolean ok) {
        if (!ok) {
            throw new AppException(ErrorCode.REVENUE_RANGE_INVALID);
        }
    }

    private void validateYear(int year) {
        requireRange(year >= 2000 && year <= 2100);
    }

    // ===================== Dựng chuỗi =====================

    /**
     * Gộp ở DB rồi ĐIỀN kỳ trống bằng 0 tại đây — DB chỉ trả bucket có dữ liệu, còn chart cần
     * đủ mọi kỳ để không bị gãy. Chỉ service mới biết bộ kỳ đầy đủ của granularity đang chọn.
     */
    private List<RevenueSeriesPointResponse> buildPoints(Period period) {
        List<PaymentRepository.RevenueBucket> aggs = paymentRepository.aggregateByBucket(
                period.granularity().getTruncUnit(), period.start(), period.end(),
                PaymentStatus.revenueRecognizedNames());

        Map<LocalDateTime, PaymentRepository.RevenueBucket> byBucket = new HashMap<>();
        for (PaymentRepository.RevenueBucket agg : aggs) {
            byBucket.put(agg.getBucket(), agg);
        }

        List<RevenueSeriesPointResponse> points = new ArrayList<>();
        for (LocalDateTime bucket : bucketStarts(period)) {
            PaymentRepository.RevenueBucket agg = byBucket.get(bucket);
            long gross = agg == null ? 0L : value(agg.getGross());
            long refunded = agg == null ? 0L : value(agg.getRefunded());
            points.add(RevenueSeriesPointResponse.builder()
                    .label(label(period.granularity(), bucket))
                    .bucket(bucket)
                    // Net CÓ THỂ ÂM khi hoàn tiền của kỳ trước rơi vào bucket này — không kẹp về 0,
                    // đó là con số đúng.
                    .revenue(gross - refunded)
                    .gross(gross)
                    .refunded(refunded)
                    .transactions(agg == null ? 0L : value(agg.getTxnCount()))
                    .build());
        }
        return points;
    }

    private List<LocalDateTime> bucketStarts(Period period) {
        List<LocalDateTime> buckets = new ArrayList<>();
        LocalDateTime cursor = period.start();
        while (cursor.isBefore(period.end())) {
            buckets.add(cursor);
            cursor = switch (period.granularity()) {
                case DAY, CUSTOM -> cursor.plusDays(1);
                case MONTH, HALF_YEAR -> cursor.plusMonths(1);
                case YEAR -> cursor.plusYears(1);
            };
        }
        return buckets;
    }

    /** Nhãn trục X. Năm/tháng đã hiển thị ở bộ lọc nên nhãn giữ ngắn cho đỡ chật trục. */
    private String label(RevenueGranularity granularity, LocalDateTime bucket) {
        return switch (granularity) {
            case DAY -> String.valueOf(bucket.getDayOfMonth());
            case MONTH, HALF_YEAR -> String.valueOf(bucket.getMonthValue());
            case YEAR -> String.valueOf(bucket.getYear());
            case CUSTOM -> bucket.format(DAY_MONTH);
        };
    }

    // ===================== Export =====================

    private String buildCsv(List<RevenueTransactionResponse> rows) {
        StringBuilder csv = new StringBuilder(
                "Ma giao dich,Khach hang,Email,Goi,So tien,Tien te,Trang thai,Ngay,Hoan tien,Cong,Ma cong\n");
        for (RevenueTransactionResponse row : rows) {
            csv.append(csvCell(row.getCode())).append(',')
                    .append(csvCell(row.getUserName())).append(',')
                    .append(csvCell(row.getUserEmail())).append(',')
                    .append(csvCell(row.getPlanNameVi())).append(',')
                    .append(row.getAmount()).append(',')
                    .append(csvCell(row.getCurrency())).append(',')
                    .append(row.getStatus()).append(',')
                    .append(csvCell(formatDate(row.getDate()))).append(',')
                    .append(row.getRefundedAmount()).append(',')
                    .append(row.getGateway()).append(',')
                    .append(csvCell(row.getGatewayTxnId()))
                    .append('\n');
        }
        return csv.toString();
    }

    private String buildTxt(Period period, List<RevenueTransactionResponse> rows) {
        long net = rows.stream()
                .filter(row -> row.getPaidAt() != null)
                .mapToLong(row -> row.getAmount() - value(row.getRefundedAmount()))
                .sum();
        StringBuilder txt = new StringBuilder("AIMA — BAO CAO DOANH THU\n");
        txt.append("Ky: ").append(formatDate(period.start())).append(" — ")
                .append(formatDate(period.end().minusDays(1))).append('\n');
        txt.append("Tong giao dich xuat: ").append(rows.size()).append('\n');
        txt.append("Doanh thu (net, uoc tinh tren cac dong da xuat): ").append(net).append(" VND\n\n");
        for (RevenueTransactionResponse row : rows) {
            txt.append("- ").append(row.getCode())
                    .append(" | ").append(row.getUserName())
                    .append(" | ").append(row.getPlanNameVi())
                    .append(" | ").append(row.getAmount()).append(' ').append(row.getCurrency())
                    .append(" | ").append(row.getStatus())
                    .append(" | ").append(formatDate(row.getDate()))
                    .append('\n');
        }
        return txt.toString();
    }

    private String csvCell(String raw) {
        String safe = raw == null ? "" : raw.replace("\"", "\"\"");
        return '"' + safe + '"';
    }

    private String formatDate(LocalDateTime value) {
        return value == null ? "" : value.toLocalDate().toString();
    }

    // ===================== Dev seeder (tạm thời, gỡ khi có payOS) =====================

    @Override
    @Transactional
    public ApiResponse<Integer> devSeed(String actorEmail) {
        guardDevTool();

        List<Plan> plans = planRepository.findByDeletedAtIsNullOrderByDisplayOrderAscCreatedAtAsc().stream()
                .filter(plan -> plan.getPrice() != null && plan.getPrice() > 0)
                .toList();
        List<User> users = userRepository.findAll().stream()
                .filter(user -> user.getDeletedAt() == null)
                .toList();
        if (plans.isEmpty() || users.isEmpty()) {
            throw new AppException(ErrorCode.REVENUE_PARAM_REQUIRED);
        }

        // Seed cố định để chạy lại cho ra cùng hình dạng dữ liệu — dễ so sánh khi sửa giao diện.
        Random random = new Random(20260720L);
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime firstMonth = now.toLocalDate().withDayOfMonth(1).atStartOfDay().minusMonths(17);

        List<Payment> batch = new ArrayList<>();
        int invoiceSeq = 1;
        for (int monthOffset = 0; monthOffset < 18; monthOffset++) {
            LocalDateTime monthStart = firstMonth.plusMonths(monthOffset);
            int daysInMonth = YearMonth.from(monthStart).lengthOfMonth();
            // Doanh số tăng dần theo thời gian cho chart có xu hướng đọc được.
            int ordersThisMonth = 12 + monthOffset + random.nextInt(8);

            for (int i = 0; i < ordersThisMonth; i++) {
                Plan plan = plans.get(random.nextInt(plans.size()));
                User user = users.get(random.nextInt(users.size()));
                LocalDateTime orderedAt = monthStart
                        .plusDays(random.nextInt(daysInMonth))
                        .plusHours(random.nextInt(24))
                        .plusMinutes(random.nextInt(60));
                if (!orderedAt.isBefore(now)) {
                    continue;
                }

                int roll = random.nextInt(100);
                PaymentStatus status;
                LocalDateTime paidAt = null;
                Long refundedAmount = 0L;
                LocalDateTime refundedAt = null;
                if (roll < 78) {
                    status = PaymentStatus.PAID;
                    paidAt = orderedAt.plusMinutes(1 + random.nextInt(30));
                } else if (roll < 86) {
                    status = PaymentStatus.PENDING;
                } else if (roll < 95) {
                    status = PaymentStatus.FAILED;
                } else if (roll < 98) {
                    status = PaymentStatus.REFUNDED;
                    paidAt = orderedAt.plusMinutes(1 + random.nextInt(30));
                    refundedAmount = plan.getPrice();
                    // Hoàn tiền rơi vào kỳ SAU kỳ trả tiền → đúng ca kiểm chứng "không hồi tố".
                    refundedAt = paidAt.plusDays(3 + random.nextInt(40));
                } else {
                    status = PaymentStatus.PARTIALLY_REFUNDED;
                    paidAt = orderedAt.plusMinutes(1 + random.nextInt(30));
                    refundedAmount = plan.getPrice() / 2;
                    refundedAt = paidAt.plusDays(3 + random.nextInt(40));
                }
                // Hoàn tiền trong tương lai thì coi như chưa xảy ra (giữ dữ liệu nhất quán với now).
                if (refundedAt != null && refundedAt.isAfter(now)) {
                    status = PaymentStatus.PAID;
                    refundedAmount = 0L;
                    refundedAt = null;
                }

                batch.add(revenueMapper.toPayment(user, plan, plan.getPrice(), "VND", status,
                        orderedAt, paidAt, refundedAmount, refundedAt,
                        monthStart, monthStart.plusMonths(1),
                        PaymentGateway.MANUAL, null,
                        String.format("INV-%06d", invoiceSeq++),
                        SEED_NOTE_PREFIX + " du lieu mau, khong phai giao dich that"));
            }
        }

        paymentRepository.saveAll(batch);
        systemLogService.info("admin.revenue.devseed",
                String.format("%s đã seed %d bản ghi payments mẫu (18 tháng)", actorEmail, batch.size()));
        log.warn("[RevenueSeed] Đã tạo {} payment MẪU — dữ liệu này KHÔNG phải doanh thu thật", batch.size());
        return ApiResponse.success("Đã tạo dữ liệu thanh toán mẫu", batch.size());
    }

    @Override
    @Transactional
    public ApiResponse<Integer> devSeedClear(String actorEmail) {
        guardDevTool();
        long removed = paymentRepository.deleteByGatewayAndNoteStartingWith(
                PaymentGateway.MANUAL, SEED_NOTE_PREFIX);
        systemLogService.info("admin.revenue.devseed",
                String.format("%s đã xoá %d bản ghi payments mẫu", actorEmail, removed));
        return ApiResponse.success("Đã xoá dữ liệu thanh toán mẫu", (int) removed);
    }

    /** Ba lớp khoá giống dev-credits: cờ .env + AIMA_PRODUCTION_MODE + profile prod (belt). */
    private void guardDevTool() {
        if (!paymentSeedEnabled || productionMode || isProductionProfile()) {
            throw new AppException(ErrorCode.DEV_PAYMENT_SEED_DISABLED);
        }
    }

    private boolean isProductionProfile() {
        for (String profile : environment.getActiveProfiles()) {
            if ("prod".equalsIgnoreCase(profile) || "production".equalsIgnoreCase(profile)) {
                return true;
            }
        }
        return false;
    }

    // ===================== Tiện ích =====================

    private long netOf(PaymentRepository.RevenueTotals totals) {
        return value(totals.getGross()) - value(totals.getRefunded());
    }

    private long value(Long raw) {
        return raw == null ? 0L : raw;
    }

    /** null = không có mẫu số để so (kỳ trước bằng 0) — FE hiển thị "—" thay vì +∞%. */
    private Double deltaPct(long current, long previous) {
        if (previous == 0) {
            return null;
        }
        return round1((current - previous) * 100.0 / Math.abs(previous));
    }

    private double round1(double raw) {
        return Math.round(raw * 10.0) / 10.0;
    }

    private int clampSize(int size) {
        if (size < 1) {
            return 10;
        }
        return Math.min(size, 100);
    }

    /**
     * Chỉ cho sắp xếp trên cột có ý nghĩa với người dùng; giá trị lạ rơi về mặc định.
     * "date" ánh xạ sang {@code orderedAt} (luôn có giá trị) chứ không phải {@code paidAt}
     * để đơn PENDING/FAILED không bị dồn cuối bảng vì null.
     */
    private Sort parseSort(String sort) {
        Sort fallback = Sort.by(Sort.Direction.DESC, "orderedAt");
        if (sort == null || sort.isBlank()) {
            return fallback;
        }
        String[] parts = sort.split(",");
        String field = switch (parts[0].trim().toLowerCase(Locale.ROOT)) {
            case "date", "orderedat" -> "orderedAt";
            case "amount" -> "amount";
            case "paidat" -> "paidAt";
            default -> null;
        };
        if (field == null) {
            return fallback;
        }
        boolean asc = parts.length > 1 && "asc".equalsIgnoreCase(parts[1].trim());
        return Sort.by(asc ? Sort.Direction.ASC : Sort.Direction.DESC, field);
    }

    /** Kỳ đã phân giải: khoảng hiện tại, khoảng kỳ trước để so sánh, và loại so sánh cho FE. */
    private record Period(RevenueGranularity granularity,
                          LocalDateTime start, LocalDateTime end,
                          LocalDateTime previousStart, LocalDateTime previousEnd,
                          String comparison) {
    }
}
