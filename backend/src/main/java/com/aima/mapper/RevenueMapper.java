package com.aima.mapper;

import com.aima.dto.response.PlanRevenueResponse;
import com.aima.dto.response.RevenueTransactionResponse;
import com.aima.entity.Payment;
import com.aima.entity.Plan;
import com.aima.entity.User;
import com.aima.enums.PaymentGateway;
import com.aima.enums.PaymentStatus;
import com.aima.repository.PaymentRepository;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Chuyển đổi cho slice "Quản lý doanh thu". Một mapper cho cả concern doanh thu
 * (không tách một mapper mỗi DTO — rule #18).
 */
@Mapper(componentModel = "spring")
public interface RevenueMapper {

    /**
     * Dòng bảng giao dịch. Ba trường phải suy ra chứ không map thẳng:
     * mã hiển thị (rơi về id rút gọn khi chưa có số hoá đơn), tên khách (rơi về email),
     * và cột Ngày (đơn chưa thu tiền thì lấy ngày tạo).
     */
    @Mapping(target = "code", expression = "java(RevenueMapper.displayCode(row.getInvoiceNo(), row.getId()))")
    @Mapping(target = "userName", expression = "java(RevenueMapper.displayName(row.getUserFullName(), row.getUserEmail()))")
    @Mapping(target = "date", expression = "java(row.getPaidAt() != null ? row.getPaidAt() : row.getOrderedAt())")
    RevenueTransactionResponse toTransactionResponse(PaymentRepository.TransactionRow row);

    List<RevenueTransactionResponse> toTransactionResponseList(List<PaymentRepository.TransactionRow> rows);

    /** {@code sharePct} do service tính (cần tổng toàn kỳ) nên mapper bỏ qua. */
    @Mapping(target = "revenue", source = "agg.gross")
    @Mapping(target = "transactions", source = "agg.txnCount")
    @Mapping(target = "sharePct", ignore = true)
    PlanRevenueResponse toPlanRevenueResponse(PaymentRepository.PlanRevenue agg);

    List<PlanRevenueResponse> toPlanRevenueResponseList(List<PaymentRepository.PlanRevenue> aggs);

    /**
     * Dựng bản ghi thanh toán (dùng bởi dev seeder; luồng payOS thật sau này dùng lại đúng
     * method này). {@code id} + audit fields KHÔNG xuất hiện ở đây vì Lombok {@code @Builder}
     * trên {@code Payment} không sinh setter cho field kế thừa từ {@code BaseEntity} — JPA tự
     * sinh chúng. {@code rawPayload}/{@code failedReason} là chỗ webhook payOS ghi sau, không
     * phải lúc tạo đơn.
     */
    // Ba target dưới PHẢI chỉ rõ nguồn — MapStruct ưu tiên property của bean param hơn chính
    // param cùng tên, nên nếu để nó tự suy thì:
    //   - `status` nhập nhằng giữa tham số PaymentStatus và User.status (UserStatus);
    //   - `plan` bị lấy từ User.plan (enum UserPlan) rồi tự dựng một Plan RỖNG → khi save ném
    //     TransientPropertyValueException "references an unsaved transient instance of Plan";
    //   - `user` KHÔNG được set gì cả (bị bỏ qua im lặng).
    @Mapping(target = "status", source = "status")
    @Mapping(target = "user", source = "user")
    @Mapping(target = "plan", source = "plan")
    @Mapping(target = "rawPayload", ignore = true)
    @Mapping(target = "failedReason", ignore = true)
    Payment toPayment(User user, Plan plan, Long amount, String currency, PaymentStatus status,
                      LocalDateTime orderedAt, LocalDateTime paidAt,
                      Long refundedAmount, LocalDateTime refundedAt,
                      LocalDateTime periodStart, LocalDateTime periodEnd,
                      PaymentGateway gateway, String gatewayTxnId, String invoiceNo, String note);

    /** Mã giao dịch hiển thị: số hoá đơn nếu có, ngược lại 8 ký tự đầu của UUID viết hoa. */
    static String displayCode(String invoiceNo, java.util.UUID id) {
        if (invoiceNo != null && !invoiceNo.isBlank()) {
            return invoiceNo;
        }
        return id == null ? "—" : id.toString().substring(0, 8).toUpperCase();
    }

    /** Tên khách hiển thị: họ tên nếu có, ngược lại email (user Google có thể chưa đặt tên). */
    static String displayName(String fullName, String email) {
        return fullName != null && !fullName.isBlank() ? fullName : email;
    }
}
