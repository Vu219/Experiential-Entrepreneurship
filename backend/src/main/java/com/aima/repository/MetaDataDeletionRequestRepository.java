package com.aima.repository;

import com.aima.entity.MetaDataDeletionRequest;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface MetaDataDeletionRequestRepository extends JpaRepository<MetaDataDeletionRequest, UUID> {

    Optional<MetaDataDeletionRequest> findByConfirmationCodeAndDeletedAtIsNull(String confirmationCode);
}
