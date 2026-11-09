import { join } from "node:path";
import { defineConfig } from "vite";

const root = import.meta.dirname;

export default defineConfig({
  root,
  publicDir: join(root, "static"),
  build: {
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: true,
    target: "es2023",
    minify: false,
    lib: {
      entry: join(root, "src/index.ts"),
      formats: ["es"],
      fileName: () => "stagehand.js",
    },
  },
});
