// Builds each extension entry as a classic script (content scripts and
// Firefox's background page can't be ES modules), then copies static files
// and appends the new Setup page's styles (src/ui/shell/*.css) to setup-ui.css.
// `node build.ts --release` builds without the dev build label on Setup.
import {
  appendFileSync,
  cpSync,
  existsSync,
  readFileSync,
  rmSync,
} from "node:fs";
import { execSync } from "node:child_process";
import { join } from "node:path";
import { build } from "vite";

const root = import.meta.dirname;

/** "0.2.0 · a4a2214+ · 2026-11-06 15:40": version, commit (+ if changed), time. */
function buildLabel(): string {
  const { version } = JSON.parse(
    readFileSync(join(root, "static", "manifest.json"), "utf8"),
  ) as { version: string };
  const git = (args: string): string => {
    try {
      return execSync(`git ${args}`, { cwd: root, encoding: "utf8" }).trim();
    } catch {
      return "";
    }
  };
  const commit = git("rev-parse --short HEAD") || "unknown";
  const dirty = git("status --porcelain") ? "+" : "";
  const now = new Date();
  const pad = (n: number): string => String(n).padStart(2, "0");
  const time = `${String(now.getFullYear())}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
  return `${version} · ${commit}${dirty} · ${time}`;
}

/** `--release`: no dev build label on the Setup page. */
const RELEASE = process.argv.includes("--release");
const BUILD = buildLabel();
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
    define: {
      __ML_BUILD__: JSON.stringify(BUILD),
      __ML_DEV__: JSON.stringify(!RELEASE),
    },
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
for (const sheet of [
  "shell.css",
  "world.css",
  "library.css",
  "panel.css",
  "tools.css",
  "about.css",
  "session.css",
  "backups.css",
])
  appendFileSync(
    join(outDir, "setup-ui.css"),
    `\n${readFileSync(join(root, "src", "ui", "shell", sheet), "utf8")}`,
  );
