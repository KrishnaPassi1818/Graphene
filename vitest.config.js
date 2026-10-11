import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["packages/**/test/**/*.test.js", "apps/**/test/**/*.test.js"],
    testTimeout: 30000,
    hookTimeout: 30000,
  },
});
