import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["./src/index.ts"],
  deps: {
    alwaysBundle: [/^@uniswap\//],
    neverBundle: ["viem"],
  },
  format: ["esm"],
  dts: true,
});
