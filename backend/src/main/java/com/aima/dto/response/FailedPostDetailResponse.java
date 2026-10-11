package com.aima.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;

import java.util.List;

/** Chi tiết một bài lỗi: dòng danh sách + timeline mọi lần thử (cũ → mới). */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@Schema(name = "FailedPostDetailResponse", description = "A failed post with its attempt timeline.")
public class FailedPostDetailResponse {

    FailedPostResponse post;

    @Schema(description = "Every publishing attempt of the post, oldest first.")
    List<FailedPostAttemptResponse> attempts;
}
