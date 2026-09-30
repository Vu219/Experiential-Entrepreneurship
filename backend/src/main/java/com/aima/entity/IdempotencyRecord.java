package com.aima.entity;

import com.aima.enums.IdempotencyOperation;
import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.FieldDefaults;
import org.hibernate.annotations.UuidGenerator;

import java.time.Instant;
import java.util.UUID;

/** Kết quả một thao tác lịch đã THÀNH CÔNG theo key idempotency của client (dòng lỗi không được lưu). */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "idempotency_records", uniqueConstraints = @UniqueConstraint(
        name = "uk_idempotency_records_owner_operation_key", columnNames = {"owner_id", "operation", "idempotency_key"}))
@FieldDefaults(level = AccessLevel.PRIVATE)
public class IdempotencyRecord {

    @Id
    @UuidGenerator
    @Column(name = "id", nullable = false, updatable = false)
    UUID id;

    @Column(name = "owner_id", nullable = false)
    UUID ownerId;

    @Enumerated(EnumType.STRING)
    @Column(name = "operation", nullable = false, length = 30)
    IdempotencyOperation operation;

    @Column(name = "idempotency_key", nullable = false, length = 64)
    String idempotencyKey;

    /** SHA-256 hex của payload chuẩn hoá — cùng key mà khác payload là lỗi của client. */
    @Column(name = "request_hash", nullable = false, length = 64)
    String requestHash;

    @Column(name = "schedule_id")
    UUID scheduleId;

    @Column(name = "job_id")
    UUID jobId;

    @Column(name = "created_at", nullable = false)
    Instant createdAt;
}
