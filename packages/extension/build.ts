// Builds the extension into dist/ and the Android app's web part into
// dist-app/ (Android plan, phase 2). Each entry is a classic script
// (content scripts, Firefox's background page and WebView's document-start
// scripts can't be ES modules). The new Setup page's styles
// (src/ui/shell/*.css) are appended to the extension's setup-ui.css and put
// into the app's app-setup.js, which adds them at document start.
// `node build.ts --release` builds without the dev build label on Setup;
// `--extension` or `--app` builds one target only.
import {
  appendFileSync,
  cpSync,
  existsSync,
  readdirSync,
  readFileSync,
  rmSync,
} from "node:fs";
import { execSync } from "node:child_process";
import { join } from "node:path";
import { build } from "vite";
import { browserApiCalls } from "./src/app/bundle-check.ts";

const root = import.meta.dirname;

/** The extension's version, which the app shares. */
const VERSION = (
  JSON.parse(readFileSync(join(root, "static", "manifest.json"), "utf8")) as {
    version: string;
  }
).version;

/** "0.2.0 · a4a2214+ · 2026-11-06 15:40": version, commit (+ if changed), time. */
function buildLabel(): string {
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
  return `${VERSION} · ${commit}${dirty} · ${time}`;
}

/** `--release`: no dev build label on the Setup page. */
const RELEASE = process.argv.includes("--release");
const ONLY_EXTENSION = process.argv.includes("--extension");
const ONLY_APP = process.argv.includes("--app");
const BUILD = buildLabel();

const SHELL_SHEETS = [
  "shell.css",
  "world.css",
  "library.css",
  "panel.css",
  "tools.css",
  "about.css",
  "session.css",
  "backups.css",
  "libpanels.css",
  "grid.css",
  "config.css",
  "update.css",
  "news.css",
  "themes.css",
  "layout.css",
  "phone.css",
  "phone-sheets.css",
  "phone-world.css",
  "phone-library.css",
  "veil.css",
];

/** The Setup page's styles: static/setup-ui.css, then the shell's sheets. */
function setupCss(): string {
  return [
    readFileSync(join(root, "static", "setup-ui.css"), "utf8"),
    ...SHELL_SHEETS.map((sheet) =>
      readFileSync(join(root, "src", "ui", "shell", sheet), "utf8"),
    ),
  ].join("\n");
}

const entryFile = (name: string): string => {
  const tsx = join(root, "src", "entries", `${name}.tsx`);
  return existsSync(tsx) ? tsx : join(root, "src", "entries", `${name}.ts`);
};

async function buildEntry(
  name: string,
  outDir: string,
  define: Readonly<Record<string, string>>,
): Promise<void> {
  await build({
    configFile: false,
    root,
    publicDir: false,
    logLevel: "warn",
    oxc: { jsx: { runtime: "automatic", importSource: "preact" } },
    define: {
      __ML_BUILD__: JSON.stringify(BUILD),
      __ML_DEV__: JSON.stringify(!RELEASE),
      ...define,
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

async function buildExtension(): Promise<void> {
  const outDir = join(root, "dist");
  rmSync(outDir, { recursive: true, force: true });
  for (const name of [
    "background",
    "setup-veil",
    "setup-main",
    "setup-ui",
    "game-bridge",
    "popup",
  ])
    await buildEntry(name, outDir, {});
  cpSync(join(root, "static"), outDir, { recursive: true });
  for (const sheet of SHELL_SHEETS)
    appendFileSync(
      join(outDir, "setup-ui.css"),
      `\n${readFileSync(join(root, "src", "ui", "shell", sheet), "utf8")}`,
    );
}

/** No chrome.* or browser.* in the app (the plan's bundle check). */
function checkAppBundle(outDir: string): void {
  const hits = readdirSync(outDir)
    .filter((file) => file.endsWith(".js"))
    .flatMap((file) =>
      browserApiCalls(readFileSync(join(outDir, file), "utf8")).map(
        (hit) => `${file}:${hit}`,
      ),
    );
  if (hits.length > 0)
    throw new Error(`Extension APIs in the app build:\n${hits.join("\n")}`);
}

async function buildApp(): Promise<void> {
  const outDir = join(root, "dist-app");
  rmSync(outDir, { recursive: true, force: true });
  const define = {
    __ML_VERSION__: JSON.stringify(VERSION),
    __ML_SETUP_CSS__: JSON.stringify(setupCss()),
  };
  for (const name of ["app-setup", "app-game", "app-background", "app-home"])
    await buildEntry(name, outDir, define);
  cpSync(join(root, "static-app"), outDir, { recursive: true });
  cpSync(join(root, "static", "popup.css"), join(outDir, "popup.css"));
  checkAppBundle(outDir);
}

if (!ONLY_APP) await buildExtension();
if (!ONLY_EXTENSION) await buildApp();
