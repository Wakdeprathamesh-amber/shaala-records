import { defineConfig } from "vitest/config";
import { resolve } from "node:path";
import { config as loadEnv } from "dotenv";

// Integration tests talk to the real database.
loadEnv({ path: ".env.local" });

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts", "tests/integration/**/*.test.ts"],
    // Integration tests share one database; running files in parallel would
    // let one file's teardown delete another's fixtures.
    fileParallelism: false,
    testTimeout: 90_000,
  },
  resolve: {
    alias: {
      "@": resolve(import.meta.dirname, "./src"),
      // `server-only` throws by design outside a server runtime. Repositories
      // import it, and they are exactly what the integration tests exercise.
      "server-only": resolve(import.meta.dirname, "./tests/stubs/server-only.ts"),
    },
  },
});
