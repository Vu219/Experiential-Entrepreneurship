package com.aima.dto.response;

import com.fasterxml.jackson.annotation.JsonProperty;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;

/**
 * Body trả cho Meta từ Data Deletion Callback — Meta yêu cầu ĐÚNG hình dạng
 * {@code {"url": "...", "confirmation_code": "..."}} ở cấp cao nhất, nên KHÔNG bọc ApiResponse.
 */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@Schema(name = "MetaDataDeletionCallbackResponse", description = "Phản hồi Data Deletion Callback theo định dạng Meta.")
public class MetaDataDeletionCallbackResponse {
    @Schema(description = "Trang FE để người dùng tra cứu trạng thái xoá (kèm ?code=).")
    String url;

    @JsonProperty("confirmation_code")
    @Schema(description = "Mã xác nhận yêu cầu xoá dữ liệu.")
    String confirmationCode;
}
