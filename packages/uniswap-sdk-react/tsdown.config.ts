import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["./src/index.ts"],
  deps: {
    alwaysBundle: [/^@uniswap\//],
    neverBundle: ["react", "@tanstack/react-query", "viem", "wagmi", "@zahastudio/uniswap-sdk"],
  },
  dts: true,
  format: ["esm"],
});
