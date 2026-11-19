// Builds the extension into dist/ and the Android app's web part into
// dist-app/ (Android plan, phase 2). Each entry is a classic script
// (content scripts, Firefox's background page and WebView's document-start
// scripts can't be ES modules). The Setup page's styles (SETUP_SHEETS:
// static/setup-ui.css, src/ui/shell/*.css and packages/ui's shared sheets)
// become the extension's setup-ui.css and go into the app's app-setup.js,
// which adds them at document start.
// `node build.ts --release` builds without the dev build label on Setup;
// `--extension` or `--app` builds one target only.
import {
  cpSync,
  existsSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
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

const shell = (sheet: string): string =>
  join(root, "src", "ui", "shell", sheet);
const shared = (sheet: string): string =>
  join(root, "..", "ui", "src", "css", sheet);

/**
 * The Setup page's styles, in cascade order: the modules view's shared
 * sheets (packages/ui) where they always stood among Setup's own.
 */
const SETUP_SHEETS = [
  shared("base.css"),
  join(root, "static", "setup-ui.css"),
  shell("shell.css"),
  shared("menu.css"),
  shared("world.css"),
  shared("library.css"),
  shared("panel.css"),
  shared("tools.css"),
  shell("about.css"),
  shell("session.css"),
  shell("backups.css"),
  shared("libpanels.css"),
  shell("grid.css"),
  shell("config.css"),
  shell("update.css"),
  shell("news.css"),
  shell("themes.css"),
  shell("layout.css"),
  shell("phone.css"),
  shell("phone-sheets.css"),
  shell("phone-world.css"),
  shell("phone-library.css"),
  shell("phone-server.css"),
  shell("launching.css"),
  shell("veil.css"),
];

const setupCss = (): string =>
  SETUP_SHEETS.map((sheet) => readFileSync(sheet, "utf8")).join("\n");

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
      __ST_BUILD__: JSON.stringify(BUILD),
      __ST_DEV__: JSON.stringify(!RELEASE),
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
        name: `stagehand_${name.replace(/-/g, "_")}`,
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
    "popup",
  ])
    await buildEntry(name, outDir, {});
  cpSync(join(root, "static"), outDir, { recursive: true });
  writeFileSync(join(outDir, "setup-ui.css"), setupCss());
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
    __ST_VERSION__: JSON.stringify(VERSION),
    __ST_SETUP_CSS__: JSON.stringify(setupCss()),
    __ST_RUNNING_CSS__: JSON.stringify(
      readFileSync(join(root, "src", "app", "running", "running.css"), "utf8"),
    ),
  };
  for (const name of ["app-setup", "app-game", "app-background", "app-home"])
    await buildEntry(name, outDir, define);
  cpSync(join(root, "static-app"), outDir, { recursive: true });
  cpSync(
    join(root, "src", "ui", "app-home", "home.css"),
    join(outDir, "home.css"),
  );
  checkAppBundle(outDir);
}

if (!ONLY_APP) await buildExtension();
if (!ONLY_EXTENSION) await buildApp();
