import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  define: {
    "import.meta.env.VITE_ENABLE_DARK_MODE": JSON.stringify(loadEnv(mode, process.cwd()).VITE_ENABLE_DARK_MODE ?? "true"),
  },
  server: {
    port: 3000,
    strictPort: true,
  },
}));
