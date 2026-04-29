import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["./src/index.ts"],
  deps: {
    neverBundle: ["viem"],
  },
  format: ["esm"],
  dts: true,
});
