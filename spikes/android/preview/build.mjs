// Builds the phase 3 preview into the spike app's assets (dev only).
// Needs `pnpm build` first (it takes the Setup styles from dist/).
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";

const root = join(import.meta.dirname, "..", "..", "..");
const ext = join(root, "packages", "extension");
const { build } = await import(
  createRequire(join(ext, "package.json")).resolve("vite")
);
const css = (path) => JSON.stringify(readFileSync(join(ext, path), "utf8"));
await build({
  configFile: false,
  root: ext,
  publicDir: false,
  logLevel: "warn",
  // The preview lives outside the workspace packages: point it at them.
  resolve: {
    alias: [
      {
        find: /^@stagehand\/shared\/(.*)$/,
        replacement: join(root, "packages", "shared", "src", "$1.ts"),
      },
      {
        find: /^(preact|zod)(\/.*)?$/,
        replacement: "$1$2",
        customResolver: (id) =>
          createRequire(join(ext, "package.json")).resolve(id),
      },
    ],
  },
  oxc: { jsx: { runtime: "automatic", importSource: "preact" } },
  define: {
    __ST_SETUP_CSS__: css("dist/setup-ui.css"),
    __ST_RUNNING_CSS__: css("src/app/running/running.css"),
    __ST_VERSION__: JSON.stringify("preview"),
    __ST_BUILD__: JSON.stringify("preview"),
    __ST_DEV__: "true",
  },
  build: {
    outDir: join(import.meta.dirname, "..", "app", "src", "main", "assets"),
    emptyOutDir: false,
    target: "es2022",
    minify: false,
    lib: {
      entry: join(import.meta.dirname, "preview.ts"),
      formats: ["iife"],
      name: "stagehandPreview",
      fileName: () => "preview.js",
    },
  },
});
console.log("preview.js built");
