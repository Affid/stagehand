// Dev aid: runs another dev script with Foundry's Setup theme set, then puts
// the theme that was set back (as themes.ts does), also on Ctrl-C or a
// failing script. Foundry must be running on Setup.
// Usage: node scripts/dev/with-theme.ts <dark|fantasy|scifi> <script> [args]
import { spawn } from "node:child_process";
import { join } from "node:path";
import type { APIRequestContext } from "@playwright/test";
import {
  createAdminClient,
  loginAsAdmin,
  setupPost,
} from "../foundry/admin.ts";
import { loadFoundryEnv } from "../foundry/env.ts";

const THEMES = ["dark", "fantasy", "scifi"];
const [theme, script, ...rest] = process.argv.slice(2);
if (!theme || !THEMES.includes(theme) || !script) {
  console.error(
    "Usage: node scripts/dev/with-theme.ts <dark|fantasy|scifi> <script> [args]",
  );
  process.exit(2);
}

/** The theme on Setup's body tag (Foundry renders it on the server). */
async function currentTheme(api: APIRequestContext): Promise<string> {
  const html = await (await api.get("/setup")).text();
  const body = /<body[^>]*class="([^"]*)"/.exec(html)?.[1] ?? "";
  return /\btheme-(dark|fantasy|scifi)\b/.exec(body)?.[1] ?? "";
}

const setTheme = (api: APIRequestContext, cssTheme: string) =>
  setupPost(api, { action: "adminConfigure", config: { cssTheme } });

/** The script's exit code; Ctrl-C reaches it, and we wait for it to end. */
function run(file: string, args: readonly string[]): Promise<number> {
  const child = spawn(process.execPath, [file, ...args], { stdio: "inherit" });
  const ignore = (): void => {
    // The child gets the signal too; we restore the theme once it has ended.
  };
  process.on("SIGINT", ignore);
  process.on("SIGTERM", ignore);
  return new Promise((resolve) => {
    child.on("error", () => {
      resolve(1);
    });
    child.on("exit", (code) => {
      process.off("SIGINT", ignore);
      process.off("SIGTERM", ignore);
      resolve(code ?? 1);
    });
  });
}

const env = loadFoundryEnv();
const api = await createAdminClient(env.url);
await loginAsAdmin(api, env.adminPassword, join(env.dataDir, "Config"));
const before = await currentTheme(api);
if (!before) {
  console.error("Could not read the current Setup theme; nothing changed.");
  await api.dispose();
  process.exit(1);
}
/** Runs the script with the theme set; the theme goes back whatever happens. */
async function runThemed(api: APIRequestContext, was: string): Promise<number> {
  try {
    await setTheme(api, theme ?? "");
    console.log(`theme ${String(theme)} (was ${was})`);
    return await run(script ?? "", rest);
  } finally {
    await setTheme(api, was);
    await api.dispose();
    console.log(`theme restored: ${was}`);
  }
}

process.exit(await runThemed(api, before));
