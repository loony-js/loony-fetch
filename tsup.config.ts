import { defineConfig } from "tsup";

export default defineConfig({
  outDir: "lib",
  entry: ["./index.ts"],
  format: ["esm", "cjs"],
  target: "es2020",
  dts: true,
  sourcemap: true,
  clean: true,
});
