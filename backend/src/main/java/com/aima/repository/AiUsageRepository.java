package com.aima.repository;

import com.aima.entity.AiUsage;
import com.aima.enums.AiProviderCode;
import com.aima.enums.AiTaskCode;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

public interface AiUsageRepository extends JpaRepository<AiUsage, UUID> {

    Page<AiUsage> findByDeletedAtIsNullOrderByCreatedAtDesc(Pageable pageable);

    /** Tổng hợp theo nghiệp vụ trong một khoảng thời gian (trang "Sử dụng & chi phí"). */
    @Query("""
            select u.taskCode as taskCode, sum(u.totalTokens) as totalTokens, sum(u.estimatedCost) as estimatedCost
            from AiUsage u
            where u.createdAt >= :from and u.createdAt < :to and u.deletedAt is null
            group by u.taskCode
            order by sum(u.totalTokens) desc
            """)
    List<TaskUsageAgg> aggregateByTask(@Param("from") LocalDateTime from, @Param("to") LocalDateTime to);

    /** Tổng hợp theo model trong một khoảng thời gian. */
    @Query("""
            select u.providerCode as providerCode, u.modelCode as modelCode,
                   sum(u.totalTokens) as totalTokens, sum(u.estimatedCost) as estimatedCost
            from AiUsage u
            where u.createdAt >= :from and u.createdAt < :to and u.deletedAt is null
            group by u.providerCode, u.modelCode
            order by sum(u.totalTokens) desc
            """)
    List<ModelUsageAgg> aggregateByModel(@Param("from") LocalDateTime from, @Param("to") LocalDateTime to);

    interface TaskUsageAgg {
        AiTaskCode getTaskCode();

        Long getTotalTokens();

        BigDecimal getEstimatedCost();
    }

    interface ModelUsageAgg {
        AiProviderCode getProviderCode();

        String getModelCode();

        Long getTotalTokens();

        BigDecimal getEstimatedCost();
    }
}
