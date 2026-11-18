import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    env: {
      NODE_ENV: "test",
      DATABASE_URL: process.env.TEST_DATABASE_URL ?? "postgres://preppilot:preppilot@localhost:5432/preppilot_test",
      JWT_SECRET: "test-secret-at-least-16-chars",
    },
    fileParallelism: false,
  },
});
