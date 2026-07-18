package com.aima.repository;

import com.aima.entity.TokenCredit;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

public interface TokenCreditRepository extends JpaRepository<TokenCredit, UUID> {

    /** Tổng credit còn lại (ACTIVE, chưa hết hạn) của một user. */
    @Query("""
            select coalesce(sum(c.tokensGranted - c.tokensConsumed), 0)
            from TokenCredit c
            where c.user.id = :userId and c.deletedAt is null and c.status = com.aima.enums.TokenCreditStatus.ACTIVE
              and (c.expiresAt is null or c.expiresAt > :now)
            """)
    long sumRemainingForUser(@Param("userId") UUID userId, @Param("now") LocalDateTime now);

    /** Các dòng còn tiêu được, thứ tự FIFO: sắp hết hạn trước (null cuối), cùng hạn thì dòng cũ trước. */
    @Query("""
            select c from TokenCredit c
            where c.user.id = :userId and c.deletedAt is null and c.status = com.aima.enums.TokenCreditStatus.ACTIVE
              and c.tokensConsumed < c.tokensGranted
              and (c.expiresAt is null or c.expiresAt > :now)
            order by case when c.expiresAt is null then 1 else 0 end, c.expiresAt, c.createdAt
            """)
    List<TokenCredit> findConsumableFifo(@Param("userId") UUID userId, @Param("now") LocalDateTime now);

    /**
     * Trừ NGUYÊN TỬ một lượng vào MỘT dòng: mọi điều kiện (ACTIVE, CHƯA HẾT HẠN, đủ số dư)
     * nằm ngay trong UPDATE — 0 row = dòng vừa bị hết hạn/revoke/tiêu bởi request song song,
     * caller chuyển sang dòng FIFO kế tiếp.
     */
    @Modifying
    @Query("""
            update TokenCredit c set c.tokensConsumed = c.tokensConsumed + :amount
            where c.id = :id and c.deletedAt is null and c.status = com.aima.enums.TokenCreditStatus.ACTIVE
              and (c.expiresAt is null or c.expiresAt > :now)
              and c.tokensConsumed + :amount <= c.tokensGranted
            """)
    int consumeAtomically(@Param("id") UUID id, @Param("amount") long amount, @Param("now") LocalDateTime now);
}
