import path from "node:path";

import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    testTimeout: 60_000,
    fileParallelism: true,
    include: ["test/**/*.test.ts", "test/**/*.test.tsx"],
  },
  resolve: {
    alias: [
      { find: "@zahastudio/uniswap-sdk", replacement: path.resolve(__dirname, "../uniswap-sdk/dist/index.mjs") },
      { find: "@/test", replacement: path.resolve(__dirname, "test") },
      { find: "@", replacement: path.resolve(__dirname, "src") },
    ],
  },
});
