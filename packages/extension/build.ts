// Builds each extension entry as a classic script (content scripts and
// Firefox's background page can't be ES modules), then copies static files.
import { cpSync, rmSync } from "node:fs";
import { join } from "node:path";
import { build } from "vite";

const root = import.meta.dirname;
const outDir = join(root, "dist");
const entries = [
  "background",
  "setup-main",
  "setup-ui",
  "game-bridge",
  "options",
];

rmSync(outDir, { recursive: true, force: true });
for (const name of entries) {
  await build({
    configFile: false,
    root,
    publicDir: false,
    logLevel: "warn",
    build: {
      outDir,
      emptyOutDir: false,
      target: "es2022",
      minify: false,
      sourcemap: true,
      lib: {
        entry: join(root, "src", "entries", `${name}.ts`),
        formats: ["iife"],
        name: `moduleLibrary_${name.replace(/-/g, "_")}`,
        fileName: () => `${name}.js`,
      },
    },
  });
}
cpSync(join(root, "static"), outDir, { recursive: true });
