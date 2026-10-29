package com.aima.repository;

import com.aima.entity.UserFeedback;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.UUID;

public interface UserFeedbackRepository extends JpaRepository<UserFeedback, UUID> {

    @EntityGraph(attributePaths = "user")
    Page<UserFeedback> findByDeletedAtIsNull(Pageable pageable);

    @EntityGraph(attributePaths = "user")
    Page<UserFeedback> findByRatingAndDeletedAtIsNull(Short rating, Pageable pageable);

    /** Mỗi dòng = [rating, số lượt] — service dựng phân bố 1..5 sao và điểm trung bình. */
    @Query("select f.rating, count(f) from UserFeedback f where f.deletedAt is null group by f.rating")
    List<Object[]> countByRating();

    /** DEV-ONLY: xoá dữ liệu mô phỏng do dev-seed sinh (chạy lại seed được). */
    @Modifying(flushAutomatically = true)
    @Query("delete from UserFeedback f where f.sample = true")
    int deleteSamples();

    // Xoá cứng tài khoản: góp ý là lời của CHÍNH user đó — không giữ lại khi user bị xoá theo GDPR.
    @Modifying(flushAutomatically = true)
    @Query("delete from UserFeedback f where f.user.id = :userId")
    int deleteByUserId(@Param("userId") UUID userId);
}
