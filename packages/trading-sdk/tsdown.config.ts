import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["./src/index.ts"],
  external: ["viem"],
  dts: true,
  format: ["esm"],
});
