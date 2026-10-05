# Bảng màu thương hiệu — 2026-10-05

## Bản hiện tại — pastel

Theo phản hồi sau lần đổi đầu, dùng **Tím sương (Lilac Mist)** và **Hồng sương (Rose Mist)**.
Đại dương và key localStorage `aurora`/`sunset` giữ nguyên.

| Palette | Gradient | Chữ/icon trên gradient |
|---|---|---|
| Tím sương | `#B7A6DA → #C6B6E6 → #D5C6EF` | `#35274D` |
| Hồng sương | `#DFA9C0 → #D6AFD5 → #C9B8E3` | `#35274D` |

`C.onBrand` / `--c-on-brand` đồng bộ chữ/icon của nút, badge, avatar và mục đang chọn.
Đại dương dùng trắng như trước; hai palette mới đạt **6,12–8,49:1** với chữ tím đậm.
Chữ gradient trên nền sáng dùng tông đậm, trên nền tối dùng pastel.
Catalog `:root`/`:root.dark` ghi giá trị foreground mặc định; override theo palette nằm trong `tokens.css`.

Chrome/API fixture: 12 tổ hợp Settings gồm tên vi/en, đổi palette và reload đạt;
64 trường hợp trên 8 route với 2 palette × 2 mode × desktop/mobile đạt, không lỗi JavaScript.
Kiểm tra foreground trên các nền brand thực tế; không phải audit mọi trạng thái của 42 route.
22/22 test, build và 377 token references đạt. Không commit.

- [Kết quả Settings và tương phản](pastel/results.json)
- [Kết quả 8 route đại diện](pastel/surface-results.json)
- [Tím sương — desktop tối](pastel/aurora-1440-dark.png)
- [Hồng sương — desktop tối](pastel/sunset-1440-dark.png)
- [Login pastel — mobile tối](pastel/surface-_login-390.png)

QA frontend port 3100:
`node frontend/scripts/dark-mode/verify-brand-palettes.mjs` và
`node frontend/scripts/dark-mode/verify-pastel-surfaces.mjs`.
API đều dùng fixture, không thay dữ liệu thật.

## Lịch sử — bản đậm được thay thế trong cùng ngày

Thay Aurora bằng Tử tinh (Amethyst), Hoàng hôn bằng Phong lan (Orchid), giữ nguyên Đại dương.
Key `aurora`/`sunset` tiếp tục dùng để tương thích lựa chọn trong localStorage.

| Palette | Gradient cho nút/điểm nhấn |
|---|---|
| Tử tinh | `#6D28D9 → #7C3AED → #9333EA` |
| Phong lan | `#DB2777 → #C026D3 → #9333EA` |

Nền ambient dùng tint riêng nhẹ hơn. Tên và mẫu màu Settings đã đồng bộ;
token nền/chữ sáng/tối và Đại dương không đổi.

Chrome/API fixture kiểm tra 12 tổ hợp palette/mode/viewport (1440/390px), tên Việt/Anh,
đổi lựa chọn, tương thích key cũ và lưu/reload: đạt, không lỗi JavaScript.
6 màu mới có tương phản với chữ trắng ≥4,5:1. Kết quả: [results.json](results.json).
`npm test` 22/22, `npm run build` đạt. Không commit.

- [Tử tinh — desktop tối](aurora-1440-dark.png)
- [Phong lan — mobile sáng](sunset-390-light.png)
- [Phong lan — desktop tối](sunset-1440-dark.png)

Các ảnh/results trong thư mục gốc là bản đậm trước phản hồi; runner hiện kiểm tra bản pastel.
