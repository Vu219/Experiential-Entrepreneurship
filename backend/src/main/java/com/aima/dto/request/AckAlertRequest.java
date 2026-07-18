package com.aima.dto.request;

import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;

/** ACK một alert; {@code falsePositive} = true khi admin xác định là báo nhầm (nuôi báo cáo FP). */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class AckAlertRequest {

    Boolean falsePositive;
}
