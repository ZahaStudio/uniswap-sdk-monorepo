import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["./src/index.ts"],
  external: ["viem"],
  format: ["esm"],
  dts: true,
});
