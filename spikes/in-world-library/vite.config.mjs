// Builds the spike's on-demand Preact chunk into module/ui.js.
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const here = (p) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  root: here("."),
  resolve: {
    alias: { preact: here("../../packages/extension/node_modules/preact") },
  },
  build: {
    outDir: here("module"),
    emptyOutDir: false,
    minify: true,
    lib: { entry: here("ui/ui.js"), formats: ["es"], fileName: () => "ui.js" },
  },
});
