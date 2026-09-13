/**
 * Config for the sample-certificate generator. Standalone rather than merged
 * with vitest.config.mts, because mergeConfig concatenates `include` and the
 * generator would drag the whole suite along with it every time.
 */
import { defineConfig } from "vitest/config";
import { resolve } from "node:path";
import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.local" });

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/samples/**/*.test.ts"],
    fileParallelism: false,
    testTimeout: 240_000,
  },
  resolve: {
    alias: {
      "@": resolve(import.meta.dirname, "./src"),
      "server-only": resolve(import.meta.dirname, "./tests/stubs/server-only.ts"),
    },
  },
});
