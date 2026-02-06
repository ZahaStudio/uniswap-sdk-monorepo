import path from "node:path";

import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    testTimeout: 60_000,
    include: ["test/**/*.test.ts"],
  },
  resolve: {
    alias: [
      { find: "@/test", replacement: path.resolve(__dirname, "test") },
      { find: "@", replacement: path.resolve(__dirname, "src") },
    ],
  },
});
