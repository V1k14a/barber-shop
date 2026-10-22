import { defineConfig } from "vitest/config";
import path from "node:path";

// Integration tests run against a real Postgres database (TEST_DATABASE_URL),
// which is reset before the run. Never point this at production data.
export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  test: {
    include: ["tests/integration/**/*.test.ts"],
    environment: "node",
    globalSetup: ["tests/integration/global-setup.ts"],
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
    env: {
      DATABASE_URL: process.env.TEST_DATABASE_URL ?? "postgresql://salon:salon@localhost:5432/salon_test?schema=public",
    },
  },
});
