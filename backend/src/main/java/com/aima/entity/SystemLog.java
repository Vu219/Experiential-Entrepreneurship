package com.aima.entity;

import com.aima.enums.LogLevel;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.experimental.FieldDefaults;

/**
 * Một dòng log lỗi hệ thống lưu DB (FR-74) — nguồn dữ liệu cho trang Logs của admin (FR-84).
 * Thời điểm = createdAt (BaseEntity). Not in DATA_MODEL.md's entity list — added for section 13.
 */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "system_logs")
@FieldDefaults(level = AccessLevel.PRIVATE)
public class SystemLog extends BaseEntity {

    @Enumerated(EnumType.STRING)
    @Column(name = "level", nullable = false, length = 10)
    LogLevel level;

    // Thành phần phát sinh log, vd "api", "posting.worker", "ai.client".
    @Column(name = "module", nullable = false, length = 100)
    String module;

    @Column(name = "message", nullable = false, columnDefinition = "text")
    String message;

    // Chi tiết kỹ thuật (stack trace rút gọn) — chỉ xem ở màn chi tiết.
    @Column(name = "detail", columnDefinition = "text")
    String detail;
}
