package com.aima.enums;

/**
 * Loại đơn vị của một dòng hệ số quy đổi hạn mức ({@code billing_rates}). MVP chỉ dùng
 * TOKEN_TOTAL (AI service trả tổng token); các loại khác đặt chỗ cho tính phí theo
 * chiều input/output, theo request (golden hours), ảnh, giây video sau này.
 */
public enum BillingUnitType {
    TOKEN_TOTAL,
    TOKEN_IN,
    TOKEN_OUT,
    REQUEST,
    IMAGE,
    SECOND
}
