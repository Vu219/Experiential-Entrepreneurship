package com.aima.controller;

import com.aima.dto.response.ApiResponse;
import com.aima.dto.response.DataDeletionStatusResponse;
import com.aima.dto.response.MetaDataDeletionCallbackResponse;
import com.aima.service.MetaDataDeletionService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirements;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/meta")
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Tag(name = "Meta Callbacks", description = "Data Deletion + Deauthorize Callback cho Meta App Review. Public — xác thực bằng signed_request (HMAC-SHA256 với app secret).")
public class MetaDataDeletionController {

    MetaDataDeletionService metaDataDeletionService;

    // Ngoại lệ rule #3 (c): Meta đọc {"url","confirmation_code"} ở CẤP CAO NHẤT của body —
    // bọc ApiResponse thì Meta không thấy hai trường này và coi callback là lỗi.
    @PostMapping(value = "/data-deletion", consumes = MediaType.APPLICATION_FORM_URLENCODED_VALUE)
    @SecurityRequirements({})
    @Operation(summary = "Data Deletion Callback",
            description = "Meta gọi khi user gửi yêu cầu xoá dữ liệu. Xoá kết nối + token, tạm giữ lịch đăng, trả url tra cứu + confirmation_code.")
    public MetaDataDeletionCallbackResponse requestDeletion(@RequestParam("signed_request") String signedRequest) {
        return metaDataDeletionService.requestDeletion(signedRequest);
    }

    @GetMapping("/data-deletion/{confirmationCode}")
    @SecurityRequirements({})
    @Operation(summary = "Trạng thái yêu cầu xoá dữ liệu", description = "Trang công khai /data-deletion?code= gọi để hiển thị kết quả.")
    public ApiResponse<DataDeletionStatusResponse> getStatus(@PathVariable String confirmationCode) {
        return metaDataDeletionService.getStatus(confirmationCode);
    }

    @PostMapping(value = "/deauthorize", consumes = MediaType.APPLICATION_FORM_URLENCODED_VALUE)
    @SecurityRequirements({})
    @Operation(summary = "Deauthorize Callback", description = "Meta gọi khi user gỡ app: kết nối → REVOKED, lịch chờ → ON_HOLD.")
    public ApiResponse<Void> deauthorize(@RequestParam("signed_request") String signedRequest) {
        return metaDataDeletionService.deauthorize(signedRequest);
    }
}
