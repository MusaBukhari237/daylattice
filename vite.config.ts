import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

// @tauri-apps/cli sets TAURI_DEV_HOST when running on a device/emulator.
const host = process.env.TAURI_DEV_HOST;

// https://vite.dev/config/
export default defineConfig(async () => ({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },

  // Tauri expects a fixed port and fails if it is not available.
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // Tell Vite to ignore watching `src-tauri`.
      ignored: ["**/src-tauri/**"],
    },
  },

  // Produce assets that work well inside the Tauri webview.
  build: {
    target: "es2021",
    minify: "esbuild",
    sourcemap: false,
  },
}));
