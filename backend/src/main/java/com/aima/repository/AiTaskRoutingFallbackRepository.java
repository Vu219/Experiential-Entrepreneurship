package com.aima.repository;

import com.aima.entity.AiModel;
import com.aima.entity.AiTaskRouting;
import com.aima.entity.AiTaskRoutingFallback;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface AiTaskRoutingFallbackRepository extends JpaRepository<AiTaskRoutingFallback, UUID> {

    /** Model đang nằm trong chuỗi dự phòng của một routing còn sống (chặn xoá model). */
    boolean existsByModelAndRouting_DeletedAtIsNull(AiModel model);

    boolean existsByRouting(AiTaskRouting routing);
}
