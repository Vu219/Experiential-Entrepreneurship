package com.aima.service;

import com.aima.entity.ContentItem;
import com.aima.enums.ContentItemStatus;

import java.util.Collection;
import java.util.UUID;

/**
 * Writer DUY NHẤT của trạng thái tổng {@link ContentItem#getStatus()} — suy ra từ trạng thái sản
 * xuất của các bản nền tảng còn hiệu lực và lịch đăng của chúng.
 *
 * <p>Thứ tự khóa thống nhất: item → version → schedule → job. Luồng nào sắp đổi version/lịch/job
 * của bài phải {@link #lock} bài TRƯỚC, rồi {@link #refresh} sau khi đổi — hai worker chạy song song
 * trên cùng bài vì vậy tuần tự hoá, worker sau luôn tính trên dữ liệu đã commit của worker trước.
 */
public interface ContentItemStatusResolver {

    /** Khóa bài (SELECT ... FOR UPDATE) tới hết transaction hiện tại. */
    ContentItem lock(UUID itemId);

    /** Khóa nhiều bài theo thứ tự id cố định (tránh deadlock giữa các luồng khóa hàng loạt). */
    void lockAll(Collection<UUID> itemIds);

    /** Khóa bài, đọc trạng thái version/lịch hiện tại từ DB rồi ghi trạng thái tổng. */
    ContentItemStatus refresh(UUID itemId);

    /** {@link #refresh} cho nhiều bài, cùng thứ tự khóa với {@link #lockAll}. */
    void refreshAll(Collection<UUID> itemIds);

    /** Bài mới chưa lưu: tính từ đồ thị entity trong bộ nhớ (chưa có gì để khóa/đọc từ DB). */
    ContentItemStatus initialize(ContentItem item);

    /** Tính trạng thái tổng từ DB mà KHÔNG khóa, KHÔNG ghi (dry-run của job sửa dữ liệu). */
    ContentItemStatus preview(UUID itemId);
}
