package com.aima.repository.projection;

import java.util.UUID;

/**
 * Số đếm gộp theo user — dùng để lấy số nội dung của ĐÚNG những user đang hiển thị trong bảng
 * "Người dùng gần đây" bằng một truy vấn GROUP BY, thay vì đếm từng dòng (N+1).
 */
public interface UserCountProjection {

    UUID getUserId();

    long getTotal();
}
