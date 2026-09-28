package com.aima.service;

import com.aima.dto.response.ApiResponse;
import com.aima.dto.response.DataDeletionStatusResponse;
import com.aima.dto.response.MetaDataDeletionCallbackResponse;

/**
 * Hai callback Meta bắt buộc cho App Review (public, xác thực bằng {@code signed_request}):
 * Data Deletion Callback và Deauthorize Callback, kèm tra cứu trạng thái xoá theo mã xác nhận.
 */
public interface MetaDataDeletionService {

    /** Xoá dữ liệu kết nối của user Meta; trả body đúng định dạng Meta ({@code url} + {@code confirmation_code}). */
    MetaDataDeletionCallbackResponse requestDeletion(String signedRequest);

    /** Trạng thái yêu cầu xoá cho trang công khai /data-deletion?code=. */
    ApiResponse<DataDeletionStatusResponse> getStatus(String confirmationCode);

    /** User gỡ app trên Facebook → kết nối REVOKED + lịch chờ ON_HOLD. */
    ApiResponse<Void> deauthorize(String signedRequest);
}
