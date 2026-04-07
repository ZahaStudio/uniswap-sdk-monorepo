import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["./src/index.ts"],
  deps: {
    neverBundle: ["viem"],
  },
  dts: true,
  format: ["esm"],
});
