import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["./src/index.tsx"],
  external: ["react"],
  dts: true,
  format: ["esm"],
});
