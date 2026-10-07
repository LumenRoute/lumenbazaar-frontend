import react from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src")
    }
  },
  test: {
    environment: "jsdom",
    exclude: [
      "**/node_modules/**",
      "**/.next/**",
      "tests/e2e/**",
      "tests/live-e2e/**",
      "tests/release-e2e/**"
    ],
    globals: true,
    setupFiles: ["./vitest.setup.ts"]
  }
});
