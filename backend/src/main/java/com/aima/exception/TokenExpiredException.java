package com.aima.exception;

/**
 * JWT hợp lệ chữ ký nhưng đã hết hạn — ném từ {@code JwtService.parseClaims}.
 *
 * <p>Tách riêng để {@code JwtAuthenticationFilter} xử lý access token hết hạn như "chưa đăng nhập" (401,
 * chỉ xoá cookie access) thay vì lỗi token hỏng: cookie refresh phải sống sót để FE gọi
 * {@code POST /auth/refresh}. Vẫn là {@link RuntimeException} như trước nên mọi nơi bắt lỗi parse cũ không đổi.</p>
 */
public class TokenExpiredException extends RuntimeException {

    public TokenExpiredException() {
        super("Token expired");
    }
}
