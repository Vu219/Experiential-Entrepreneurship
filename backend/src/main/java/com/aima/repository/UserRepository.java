package com.aima.repository;

import com.aima.entity.User;
import com.aima.enums.UserStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;


import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface UserRepository extends JpaRepository<User, UUID> {
    Optional<User> findByUsername(String username);
    Optional<User> findByEmail(String email);
    boolean existsByUsername(String username);
    boolean existsByEmail(String email);
    List<User> findAllByStatusAndDeletionDateLessThanEqual(UserStatus status, LocalDateTime now);

    // FR-80: admin tìm user theo tên/email + lọc trạng thái (q rỗng / status null = bỏ qua —
    // native query + CAST cùng mẫu ContentItemRepository.search).
    @Query(value = """
            select u.* from users u
            where u.deleted_at is null
              and (CAST(:q as varchar) = '' or lower(u.full_name) like lower(concat('%', CAST(:q as varchar), '%'))
                   or lower(u.email) like lower(concat('%', CAST(:q as varchar), '%')))
              and (CAST(:status as varchar) is null or u.status = CAST(:status as varchar))
            order by u.created_at desc
            """, nativeQuery = true)
    Page<User> search(@Param("q") String q, @Param("status") String status, Pageable pageable);
}
