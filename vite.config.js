import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

export default defineConfig({
  plugins: [vue()],
  build: {
    sourcemap: false,
    chunkSizeWarningLimit: 900,
  },
  server: {
    proxy: {
      "/api": {
        target: process.env.VITE_API_BASE_URL,
        changeOrigin: true,
        secure: false,
        // Remove /api prefix when forwarding to backend
        // Frontend uses /api/auth/me -> backend receives /auth/me
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
    },
  },
});
