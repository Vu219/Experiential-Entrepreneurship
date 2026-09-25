package com.aima.mapper;

import com.aima.dto.payos.CancelPaymentLinkPayload;
import com.aima.dto.payos.CreatePaymentLinkPayload;
import org.mapstruct.Mapper;

/**
 * Dựng payload gửi payOS (rule #18 — service không tự {@code .builder()} DTO).
 *
 * <p>Mapper nhận các giá trị đã tính sẵn thay vì nhận thẳng {@code Payment}: {@code expiredAt}
 * (epoch giây) và {@code signature} phải được tính ở service theo đúng thứ tự và đúng nguồn
 * ({@code payment.expiresAt} là mốc DUY NHẤT, chữ ký phải khớp từng ký tự với các trường gửi
 * đi). Nhét phép tính đó vào biểu thức MapStruct sẽ làm chỗ dễ sai nhất của luồng thanh toán
 * trở nên khó đọc và khó test.</p>
 */
@Mapper(componentModel = "spring")
public interface PayOSMapper {

    CreatePaymentLinkPayload toCreatePayload(Long orderCode, Long amount, String description,
                                             String returnUrl, String cancelUrl,
                                             Long expiredAt, String signature);

    CancelPaymentLinkPayload toCancelPayload(String cancellationReason);
}
