import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["./src/index.ts"],
  external: ["react", "@tanstack/react-query", "viem", "wagmi", "@zahastudio/trading-sdk"],
  dts: true,
  format: ["esm"],
});
