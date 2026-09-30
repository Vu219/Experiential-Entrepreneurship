package com.aima.repository;

import com.aima.entity.IdempotencyRecord;
import com.aima.enums.IdempotencyOperation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface IdempotencyRecordRepository extends JpaRepository<IdempotencyRecord, UUID> {

    Optional<IdempotencyRecord> findByOwnerIdAndOperationAndIdempotencyKey(UUID ownerId, IdempotencyOperation operation,
                                                                         String idempotencyKey);
}
