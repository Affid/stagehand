// The local Foundry from the on-device suite (Android plan, phase 5): the
// admin login inside the app's server WebView (so the cookie is the app's),
// the companion's talk recorded on the game page, worlds closed, Setup
// themes set and put back.
import { expect, type Page } from "@playwright/test";
import {
  createAdminClient,
  loginAsAdmin,
  setupPost,
  shutdownWorld,
} from "../../scripts/foundry/admin.ts";
import { loadFoundryEnv } from "../../scripts/foundry/env.ts";
import { TEST_WORLD } from "../../scripts/foundry/world.ts";
import { adb, sleep, tapNative, typeNative, waitNative } from "./native-ui.ts";

export const env = loadFoundryEnv();
export const THEMES = ["dark", "fantasy", "scifi"] as const;
export type Theme = (typeof THEMES)[number];

/** Admin login in the app's server WebView, then our Setup page on it. */
/** Clears the focused native field and types `text` one key at a time. */
async function typeSlowly(text: string): Promise<void> {
  adb("shell", "input", "keyevent", "KEYCODE_MOVE_END");
  for (let i = 0; i < text.length + 5; i++)
    adb("shell", "input", "keyevent", "KEYCODE_DEL");
  for (const ch of text) {
    typeNative(ch);
    await sleep(120);
  }
}

/**
 * Types the password and logs in, judged by Foundry's answer: adb's typing
 * while the keyboard is up can change a key (seen on the emulator), so a
 * refusal is typed again, up to three times.
 */
async function typeAndLogIn(password: string): Promise<void> {
  for (let attempt = 0; attempt < 3; attempt++) {
    await sleep(1_500);
    await typeSlowly(password);
    await tapNative(/^Log in$/);
    const refused = await waitNative(
      /isn't this server's administrator password/,
      8_000,
    )
      .then(() => true)
      .catch(() => false);
    if (!refused) return;
  }
  throw new Error("Foundry refused the typed password three times");
}

/** Our login on screen within a while, or none (Setup opened as logged in). */
async function needsLogin(): Promise<boolean> {
  return waitNative(/Log in to Setup/, 20_000)
    .then(() => true)
    .catch(() => false);
}

/**
 * Our native login (phase 7): Foundry's /auth never shows in the app; the
 * password goes into our field, as the user types it. Then Setup.
 */
export async function adminLogin(
  app: { pageAt(start: string, timeoutMs?: number): Promise<Page> },
  server: string,
): Promise<Page> {
  // Still logged in (the WebView keeps Foundry's session): Setup, no login.
  if (await needsLogin()) {
    await waitNative(/^Log in$/, 30_000);
    await typeAndLogIn(env.adminPassword);
  }
  const page = await app.pageAt(`${server}/setup`, 60_000);
  // A slow emulator can take over a minute to bring our page up.
  await page.locator("#ml-shell-root .mlp-top").waitFor({ timeout: 120_000 });
  // Foundry's first-run tour covers the page in a fresh WebView.
  await page.evaluate(async () => {
    const g = globalThis as unknown as {
      foundry?: {
        nue?: { Tour?: { activeTour?: { exit(): unknown } | null } };
      };
    };
    await g.foundry?.nue?.Tour?.activeTour?.exit();
  });
  return page;
}

/** Until Foundry reports no world running (a shutdown takes a moment). */
export async function waitClosed(): Promise<void> {
  const end = Date.now() + 60_000;
  while (Date.now() < end) {
    const r = await fetch(`${env.url}/api/status`).catch(() => undefined);
    const s = (await r?.json().catch(() => undefined)) as
      { active?: boolean } | undefined;
    if (s?.active === false) return;
    await sleep(1_000);
  }
  throw new Error("The world didn't close");
}

/** The Foundry version the server runs ("14.370"). */
export async function installedVersion(): Promise<string> {
  const r = await fetch(`${env.url}/api/status`);
  const s = (await r.json()) as { version?: unknown };
  if (typeof s.version !== "string") throw new Error("No Foundry version");
  return s.version;
}

/** Closes the running world (the admin password works while one runs). */
export async function closeWorld(): Promise<void> {
  const api = await createAdminClient(env.url);
  try {
    await shutdownWorld(api, env.adminPassword);
  } finally {
    await api.dispose();
  }
  await waitClosed();
}

/** Records the companion's talk with our bridge on the pages that follow. */
export async function recordCompanion(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const seen: string[] = [];
    (window as unknown as { __mlSeen: string[] }).__mlSeen = seen;
    window.addEventListener("message", (e: MessageEvent) => {
      const d = e.data as { ns?: string; type?: string } | null;
      if (d?.ns === "stagehand" && d.type) seen.push(d.type);
    });
  });
}

/** The page's document start, to tell a reloaded page from the old one. */
export const documentStart = (page: Page): Promise<number> =>
  page.evaluate(() => performance.timeOrigin);

/** Until the page has been loaded again since `before`. */
export async function reloadedSince(page: Page, before: number): Promise<void> {
  await expect
    .poll(() => documentStart(page).catch(() => before), { timeout: 90_000 })
    .not.toBe(before);
}

/** Until the companion's session on this page has pulled its commands. */
export async function companionDone(page: Page): Promise<string[]> {
  await page.waitForFunction(
    () =>
      (window as unknown as { __mlSeen?: string[] }).__mlSeen?.includes(
        "COMMANDS",
      ) === true,
    null,
    { timeout: 90_000 },
  );
  return page.evaluate(
    () => (window as unknown as { __mlSeen: string[] }).__mlSeen,
  );
}

export const activeModules = (page: Page): Promise<string[]> =>
  page.evaluate(() => {
    const g = globalThis as unknown as {
      game: { modules: Map<string, { id: string; active: boolean }> };
    };
    return [...g.game.modules.values()]
      .filter((m) => m.active)
      .map((m) => m.id)
      .sort();
  });

/** The Setup theme Foundry renders now. */
export async function currentTheme(): Promise<string> {
  const api = await createAdminClient(env.url);
  try {
    await loginAsAdmin(api, env.adminPassword, `${env.dataDir}/Config`);
    const html = await (await api.get("/setup")).text();
    const body = /<body[^>]*class="([^"]*)"/.exec(html)?.[1] ?? "";
    return /\btheme-(dark|fantasy|scifi)\b/.exec(body)?.[1] ?? "dark";
  } finally {
    await api.dispose();
  }
}

export async function setTheme(theme: string): Promise<void> {
  const api = await createAdminClient(env.url);
  try {
    await loginAsAdmin(api, env.adminPassword, `${env.dataDir}/Config`);
    await setupPost(api, {
      action: "adminConfigure",
      config: { cssTheme: theme },
    });
  } finally {
    await api.dispose();
  }
}

export { TEST_WORLD };
