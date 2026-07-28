package com.aima.dto.response;

import com.aima.enums.FailedPostFilter;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;

import java.time.LocalDate;
import java.util.List;

/**
 * 4 thẻ KPI của trang admin "Bài đăng lỗi & bị từ chối" (FR-82/FR-83) + số đếm badge của 2 tab.
 * Mỗi thẻ mang giá trị kỳ này, % lệch so với kỳ trước LIỀN KỀ (cùng độ dài) và chuỗi đếm theo
 * ngày để vẽ sparkline — FE không tự tính lại con số nào từ trang đang tải.
 */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@Schema(name = "AdminFailedPostSummaryResponse", description = "KPI block for the admin failed/rejected posts page.")
public class AdminFailedPostSummaryResponse {

    /**
     * Trạng thái của ô "% thay đổi". Tách thành enum thay vì để client tự suy từ deltaPct null:
     * chia cho 0 có HAI nghĩa hoàn toàn khác nhau và mỗi nghĩa hiển thị một kiểu.
     */
    @Schema(name = "AdminFailedPostKpiDelta", description = "How the delta cell must be rendered.")
    public enum DeltaState {
        /** Kỳ trước > 0 → dùng deltaPct. */
        PERCENT,
        /** Kỳ trước = 0 nhưng kỳ này > 0 → hiện "Mới", KHÔNG hiện +∞%. */
        NEW,
        /** Cả hai kỳ đều = 0 → hiện "—", không mũi tên, không màu cảnh báo. */
        NONE
    }

    @Data
    @Builder
    @AllArgsConstructor
    @NoArgsConstructor
    @FieldDefaults(level = AccessLevel.PRIVATE)
    @Schema(name = "AdminFailedPostKpi", description = "One KPI card: value, delta vs previous period, daily series.")
    public static class Kpi {

        @Schema(description = "Value over the requested range.")
        long value;

        @Schema(description = "Percent change vs the previous adjacent period. Chỉ có giá trị khi "
                + "deltaState = PERCENT; các trạng thái khác trả null.")
        Integer deltaPct;

        @Schema(description = "Cách hiển thị ô delta — xem AdminFailedPostKpiDelta.")
        DeltaState deltaState;

        @Schema(description = "One entry per day of the range, oldest first (zero-filled).")
        List<Long> sparkline;
    }

    @Schema(description = "Tab mà bộ số này được tính cho (POLICY = Bị từ chối, TECHNICAL = Lỗi hệ thống).")
    FailedPostFilter kind;

    @Schema(description = "Tổng theo tab: POLICY ⇒ TẤT CẢ bài lỗi trong kỳ; TECHNICAL ⇒ chỉ bài lỗi kỹ thuật.")
    Kpi total;

    @Schema(description = "Bài bị nền tảng từ chối vì vi phạm chính sách (FR-82) — thẻ của tab \"Bị từ chối\".")
    Kpi policyViolation;

    @Schema(description = "Bài lỗi kỹ thuật khi đăng (FR-83) — thẻ của tab \"Bị từ chối\".")
    Kpi technical;

    @Schema(description = "Lỗi tạm thời, còn được thử lại (FR-56) — thẻ của tab \"Lỗi hệ thống\".")
    Kpi temporary;

    @Schema(description = "Lỗi vĩnh viễn, không thử lại — thẻ của tab \"Lỗi hệ thống\".")
    Kpi permanent;

    @Schema(description = "Người dùng riêng biệt bị ảnh hưởng, phạm vi theo tab giống `total`.")
    Kpi affectedUsers;

    @Schema(description = "Start of the previous adjacent period — drives the label \"so với 06/07 - 12/07\".")
    LocalDate comparisonFrom;

    @Schema(description = "End of the previous adjacent period (inclusive).")
    LocalDate comparisonTo;
}
