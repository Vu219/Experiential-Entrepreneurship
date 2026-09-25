package com.aima.mapper;

import com.aima.dto.response.AdminPaymentResponse;
import com.aima.dto.response.AdminPaymentSummaryResponse;
import com.aima.entity.Payment;
import org.mapstruct.IterableMapping;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.Named;

import java.util.List;

/**
 * Entity → DTO cho trang quản lý đơn hàng của admin (rule #18).
 *
 * <p>Hai phương thức map cùng một entity có chủ đích: {@link #toRow} <b>bỏ</b>
 * {@code rawPayload}, {@link #toDetail} giữ. Payload thô là công cụ debug khi có sự cố thật,
 * không phải dữ liệu để rải ra mọi dòng của bảng.</p>
 */
@Mapper(componentModel = "spring")
public interface AdminPaymentMapper {

    @Mapping(target = "userId", source = "user.id")
    @Mapping(target = "userEmail", source = "user.email")
    @Mapping(target = "userFullName", source = "user.fullName")
    @Mapping(target = "planId", source = "plan.id")
    @Mapping(target = "planCode", source = "plan.code")
    @Mapping(target = "planNameVi", source = "plan.nameVi")
    @Mapping(target = "planNameEn", source = "plan.nameEn")
    @Mapping(target = "rawPayload", ignore = true)
    @Named("row")
    AdminPaymentResponse toRow(Payment payment);

    // qualifiedByName là BẮT BUỘC: hai phương thức cùng Payment → AdminPaymentResponse nên
    // MapStruct không tự chọn được, và chọn nhầm toDetail sẽ rải rawPayload ra cả trang danh sách.
    @IterableMapping(qualifiedByName = "row")
    List<AdminPaymentResponse> toRowList(List<Payment> payments);

    @Mapping(target = "userId", source = "user.id")
    @Mapping(target = "userEmail", source = "user.email")
    @Mapping(target = "userFullName", source = "user.fullName")
    @Mapping(target = "planId", source = "plan.id")
    @Mapping(target = "planCode", source = "plan.code")
    @Mapping(target = "planNameVi", source = "plan.nameVi")
    @Mapping(target = "planNameEn", source = "plan.nameEn")
    AdminPaymentResponse toDetail(Payment payment);

    /**
     * Dựng tay bằng builder NGAY TRONG mapper — cố ý, không phải bỏ quên rule #18.
     *
     * <p>Đây không phải phép map từ entity mà là gom ba con số vô hướng, và MapStruct sinh code
     * HỎNG cho trường hợp mọi tham số đều là kiểu nguyên thuỷ: nó vẫn cố sinh nhánh
     * {@code if ( ) return null;} với điều kiện rỗng vì không có tham chiếu nào để kiểm null.
     * Giữ phần dựng DTO ở tầng mapper (không đẩy sang service) là đúng tinh thần rule #18.</p>
     */
    default AdminPaymentSummaryResponse toSummary(long reconcileRequired, long pending,
                                                  long webhookRejected24h) {
        return AdminPaymentSummaryResponse.builder()
                .reconcileRequired(reconcileRequired)
                .pending(pending)
                .webhookRejected24h(webhookRejected24h)
                .build();
    }
}
