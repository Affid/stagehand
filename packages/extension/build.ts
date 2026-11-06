// Builds each extension entry as a classic script (content scripts and
// Firefox's background page can't be ES modules), then copies static files
// and appends the new Setup page's styles to setup-ui.css.
import {
  appendFileSync,
  cpSync,
  existsSync,
  readFileSync,
  rmSync,
} from "node:fs";
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

const entryFile = (name: string): string => {
  const tsx = join(root, "src", "entries", `${name}.tsx`);
  return existsSync(tsx) ? tsx : join(root, "src", "entries", `${name}.ts`);
};

rmSync(outDir, { recursive: true, force: true });
for (const name of entries) {
  await build({
    configFile: false,
    root,
    publicDir: false,
    logLevel: "warn",
    oxc: { jsx: { runtime: "automatic", importSource: "preact" } },
    build: {
      outDir,
      emptyOutDir: false,
      target: "es2022",
      minify: false,
      sourcemap: true,
      lib: {
        entry: entryFile(name),
        formats: ["iife"],
        name: `moduleLibrary_${name.replace(/-/g, "_")}`,
        fileName: () => `${name}.js`,
      },
    },
  });
}
cpSync(join(root, "static"), outDir, { recursive: true });
appendFileSync(
  join(outDir, "setup-ui.css"),
  `\n${readFileSync(join(root, "src", "ui", "shell", "shell.css"), "utf8")}`,
);
