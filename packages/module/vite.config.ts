import { readFileSync } from "node:fs";
import { join } from "node:path";
import { defineConfig, type Plugin } from "vite";

const root = import.meta.dirname;
const shared = (sheet: string): string =>
  join(root, "..", "ui", "src", "css", sheet);

/**
 * The library view's styles (loaded with the view, for Gamemasters only):
 * the shared sheets in Setup's order, then the view's own.
 */
const VIEW_SHEETS = [
  shared("base.css"),
  shared("menu.css"),
  shared("world.css"),
  shared("library.css"),
  shared("panel.css"),
  shared("tools.css"),
  shared("libpanels.css"),
  join(root, "src", "view", "view.css"),
];

function viewCss(): Plugin {
  return {
    name: "stagehand-view-css",
    generateBundle() {
      this.emitFile({
        type: "asset",
        fileName: "stagehand-view.css",
        source: VIEW_SHEETS.map((f) => readFileSync(f, "utf8")).join("\n"),
      });
    },
  };
}

export default defineConfig({
  root,
  publicDir: join(root, "static"),
  oxc: { jsx: { runtime: "automatic", importSource: "preact" } },
  plugins: [viewCss()],
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
    // The view's chunk and the code it shares with the entry.
    rolldownOptions: {
      output: { chunkFileNames: "stagehand-[name]-[hash].js" },
    },
  },
});
