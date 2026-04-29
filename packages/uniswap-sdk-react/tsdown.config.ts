import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["./src/index.ts"],
  deps: {
    neverBundle: ["react", "@tanstack/react-query", "viem", "wagmi", "@zahastudio/uniswap-sdk"],
  },
  dts: true,
  format: ["esm"],
});
