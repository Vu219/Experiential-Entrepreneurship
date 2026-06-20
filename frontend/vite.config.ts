import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    strictPort: true,
    proxy: {
      // Backend chạy ở cổng 8082 với context-path /api/aima (xem backend/.env).
      // FE gọi /api/... → proxy đổi thành /api/aima/... rồi forward sang backend.
      "/api": {
        target: "http://localhost:8082",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, "/api/aima"),
      },
      // Luồng đăng nhập Google là điều hướng toàn trang, không nằm dưới /api.
      // Cần thêm tiền tố context-path /api/aima khi forward.
      "/oauth2": {
        target: "http://localhost:8082",
        changeOrigin: true,
        rewrite: (path) => "/api/aima" + path,
      },
      "/login/oauth2": {
        target: "http://localhost:8082",
        changeOrigin: true,
        rewrite: (path) => "/api/aima" + path,
      },
    },
  },
});
