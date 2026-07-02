package com.aima.repository;

import com.aima.entity.TrendResearchSession;
import com.aima.enums.ResearchStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface TrendResearchSessionRepository extends JpaRepository<TrendResearchSession, UUID> {

    Optional<TrendResearchSession> findByIdAndBrandProfile_User_IdAndDeletedAtIsNull(UUID id, UUID userId);

    List<TrendResearchSession> findByBrandProfile_User_IdAndDeletedAtIsNullOrderByResearchTimeDesc(UUID userId);

    // FR-19: không cho phép 2 phiên nghiên cứu chạy song song cho cùng một user.
    boolean existsByBrandProfile_User_IdAndStatusInAndDeletedAtIsNull(UUID userId, Collection<ResearchStatus> statuses);
}
