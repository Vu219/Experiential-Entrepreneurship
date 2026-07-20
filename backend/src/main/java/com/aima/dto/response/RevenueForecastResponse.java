package com.aima.dto.response;

import com.fasterxml.jackson.annotation.JsonInclude;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.*;
import lombok.experimental.FieldDefaults;

import java.util.List;

/**
 * Card "Doanh thu dự kiến tháng này". Phép ngoại suy TUYẾN TÍNH đơn giản
 * ({@code thực tế / số ngày đã qua × số ngày trong tháng}) — cố ý không dùng mô hình phức tạp
 * vì dữ liệu doanh thu còn mỏng; FE phải ghi rõ đây là ước tính.
 */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@JsonInclude(JsonInclude.Include.NON_NULL)
@Schema(name = "RevenueForecastResponse", description = "Ước tính doanh thu tháng hiện tại.")
public class RevenueForecastResponse {

    @Schema(description = "Tháng đang ước tính, định dạng yyyy-MM.", example = "2026-07")
    String month;

    @Schema(description = "Doanh thu NET thực tế đã ghi nhận từ đầu tháng tới giờ (VND).")
    Long actualSoFar;

    @Schema(description = "Doanh thu dự kiến cả tháng theo ngoại suy tuyến tính (VND).")
    Long projected;

    @Schema(description = "Doanh thu NET cả tháng trước (VND) — mẫu số của deltaPct.")
    Long previousMonth;

    @Schema(description = "% chênh của số DỰ KIẾN so tháng trước. null khi tháng trước bằng 0.")
    Double deltaPct;

    @Schema(description = "Số ngày đã trôi qua trong tháng (kể cả hôm nay).")
    Integer daysElapsed;

    @Schema(description = "Tổng số ngày của tháng.")
    Integer daysInMonth;

    @Schema(description = "Doanh thu net từng ngày trong tháng tới hiện tại — vẽ sparkline trên card.")
    List<Long> sparkline;
}
