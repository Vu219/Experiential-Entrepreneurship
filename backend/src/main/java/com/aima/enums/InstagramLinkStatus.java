package com.aima.enums;

/**
 * Trang Facebook có liên kết tài khoản Instagram Doanh nghiệp/Nhà sáng tạo hay không (Graph
 * {@code instagram_business_account}). AIMA chỉ đăng/đọc được Instagram qua Trang, nên {@code NOT_LINKED} là
 * dấu hiệu gián tiếp IG đang là tài khoản cá nhân hoặc chưa liên kết với Trang.
 */
public enum InstagramLinkStatus {
    LINKED,
    NOT_LINKED
}
