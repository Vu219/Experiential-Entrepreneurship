package com.aima.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;

import java.util.List;

/** GET /connections/platforms — các nền tảng + quyền của user + số kênh còn được kết nối thêm. */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@Schema(name = "PlatformAccessListResponse", description = "Nền tảng và quyền dùng của user hiện tại.")
public class PlatformAccessListResponse {
    List<PlatformAccessResponse> platforms;

    @Schema(description = "Số kênh còn được kết nối thêm theo gói; null = không giới hạn.", example = "2")
    Long remainingChannels;

    @Schema(description = "Hạn mức kênh của gói; null = không giới hạn.", example = "3")
    Long channelLimit;

    @Schema(description = "Số kênh đang kết nối (không tính kết nối USER gốc).", example = "1")
    long connectedChannels;
}
