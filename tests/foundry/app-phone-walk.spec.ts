// The acceptance walk of phase 3 (Android plan): every page and panel of
// the new Setup page in the app harness, in portrait at 360, 412 and 768 px
// wide, on a phone and a tablet on their side, in Foundry's three Setup
// themes. At each stop: nothing scrolls sideways, the bars' controls are
// big enough for a finger, and axe (WCAG 2.2 AA) finds nothing; a
// screenshot goes to test-results/screens/walk/. The theme is put back.
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import {
  type APIRequestContext,
  expect,
  type Page,
  test,
} from "@playwright/test";
import {
  createAdminClient,
  loginAsAdmin,
  setupPost,
  shutdownWorld,
} from "../../scripts/foundry/admin.ts";
import { loadFoundryEnv } from "../../scripts/foundry/env.ts";
import {
  type AppHarness,
  type Device,
  launchApp,
  openAppSetupAsAdmin,
  PHONE_SIZES,
} from "../app/harness.ts";
import { audit } from "./axe.ts";
import { exitTour, SCREENS } from "./extension.ts";
import { settled } from "./settle.ts";

const env = loadFoundryEnv();
const THEMES = ["dark", "fantasy", "scifi"] as const;
/** A finger's target (Android's 48 dp; the mockup's 44 px for bar icons). */
const TAP = 44;
/** The theme to put back, kept until it is put back. */
const MARK = "test-results/walk-theme.json";
let admin: APIRequestContext;
let before = "";

test.beforeAll(async () => {
  admin = await createAdminClient(env.url);
  await loginAsAdmin(admin, env.adminPassword, join(env.dataDir, "Config"));
  await shutdownWorld(admin, env.adminPassword);
  // The theme to put back: a run killed before it could restore it left
  // its note (test-results is git-ignored); else Foundry's own setting.
  const theme = existsSync(MARK)
    ? (JSON.parse(readFileSync(MARK, "utf8")) as { theme?: unknown }).theme
    : ((
        JSON.parse(
          readFileSync(join(env.dataDir, "Config", "options.json"), "utf8"),
        ) as { cssTheme?: unknown }
      ).cssTheme ?? "dark");
  if (
    typeof theme !== "string" ||
    !(THEMES as readonly string[]).includes(theme)
  )
    throw new Error(`Unknown Setup theme: ${JSON.stringify(theme)}`);
  before = theme;
  mkdirSync(dirname(MARK), { recursive: true });
  writeFileSync(MARK, JSON.stringify({ theme }));
});

test.afterAll(async () => {
  try {
    if (before) {
      await setupPost(admin, {
        action: "adminConfigure",
        config: { cssTheme: before },
      });
      rmSync(MARK, { force: true });
    }
  } finally {
    await admin.dispose();
  }
});

const shell = (page: Page) => page.locator("#st-shell-root .sts-shell");

/**
 * Nothing goes sideways: not the page, not the page's scroller, and no
 * shown element (bars, sheets, dialogs, menus) past the screen's edges,
 * unless it sits in a strip that scrolls on purpose (a row of tabs, the
 * By world grid).
 */
async function noSideways(page: Page, where: string): Promise<void> {
  const found = await page.evaluate(() => {
    const vw = window.innerWidth;
    const main = document.querySelector<HTMLElement>(
      "#st-shell-root .sts-main",
    );
    const scrolls = (el: Element): boolean => {
      for (
        let a = el.parentElement;
        a && a !== main && a.id !== "st-shell-root";
        a = a.parentElement
      )
        if (["auto", "scroll"].includes(getComputedStyle(a).overflowX))
          return true;
      return false;
    };
    const out = [...document.querySelectorAll("#st-shell-root *")]
      .filter((el) => el.checkVisibility())
      .filter((el) => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && (r.right > vw + 1 || r.left < -1);
      })
      .filter((el) => !scrolls(el))
      .slice(0, 5)
      .map((el) => `${el.tagName.toLowerCase()}.${el.className}`);
    const page = document.documentElement.scrollWidth - vw;
    const inMain = main ? main.scrollWidth - main.clientWidth : 0;
    return { page, main: inMain, past: out };
  });
  expect
    .soft(found, `sideways on ${where}`)
    .toEqual({ page: 0, main: 0, past: [] });
}

/** The bars' controls (top bar, dock, tab bar): there, and finger-sized. */
async function bigEnough(page: Page, where: string): Promise<void> {
  const r = await page.evaluate((tap) => {
    const controls = [
      ...document.querySelectorAll(
        "#st-shell-root :is(.stp-top, .stp-dock, .stp-tabs) :is(button, a[href], input, select, [role=button], [role=tab])",
      ),
    ].filter((el) => el.checkVisibility());
    const small = controls
      .map((el) => {
        const b = el.getBoundingClientRect();
        const name = el.getAttribute("aria-label") ?? el.textContent.trim();
        return { name, h: Math.round(b.height), w: Math.round(b.width) };
      })
      // Half a pixel for rounding.
      .filter((b) => b.h < tap - 0.5 || b.w < tap - 0.5);
    return { count: controls.length, small };
  }, TAP);
  expect.soft(r.count, `bar controls found on ${where}`).toBeGreaterThan(0);
  expect.soft(r.small, `small bar controls on ${where}`).toEqual([]);
}

async function stop(page: Page, tag: string, where: string): Promise<void> {
  await settled(page);
  await noSideways(page, `${tag} ${where}`);
  await bigEnough(page, `${tag} ${where}`);
  await audit(page, `${tag} ${where}`);
  await page.screenshot({ path: `${SCREENS}/walk/${tag}-${where}.png` });
}

async function tab(page: Page, name: string): Promise<void> {
  await shell(page)
    .locator(".stp-tabs")
    .getByRole("button", { name: new RegExp(`^${name}`) })
    .click();
}

async function inPage(page: Page, name: RegExp): Promise<void> {
  await shell(page).locator(".sts-main").getByRole("tab", { name }).click();
}

async function sheet(page: Page, tag: string, where: string): Promise<void> {
  await expect(shell(page).getByRole("dialog")).toBeVisible();
  await stop(page, tag, where);
  await page.keyboard.press("Escape");
  await expect(shell(page).getByRole("dialog")).toHaveCount(0);
}

/** A menu that opened (bottom menus share these classes; phone/popups.ts). */
async function menu(page: Page, tag: string, where: string): Promise<void> {
  await expect(
    shell(page).locator(".st-pop, .sth-menu, .stw-addmenu").first(),
  ).toBeVisible();
  await stop(page, tag, where);
}

async function walkWorld(page: Page, tag: string): Promise<void> {
  await tab(page, "Worlds");
  await stop(page, tag, "worlds");
  await shell(page).locator(".sts-world").first().click();
  await stop(page, tag, "world-modules");
  await inPage(page, /^About/);
  await stop(page, tag, "world-about");
  await inPage(page, /^Backups/);
  await stop(page, tag, "world-backups");
}

async function walkLibrary(
  page: Page,
  tag: string,
  device: Device,
): Promise<void> {
  await tab(page, "Library");
  await stop(page, tag, "library");
  // The local library has packages (the walk needs one to open).
  await expect(shell(page).locator(".sts-main button.t").first()).toBeVisible();
  await shell(page).locator(".sts-main button.t").first().click();
  await sheet(page, tag, "details");
  await shell(page)
    .getByRole("button", { name: /^Select, install/ })
    .click();
  await menu(page, tag, "library-menu");
  await shell(page).getByRole("button", { name: "Tags…" }).click();
  await sheet(page, tag, "tags");
  await shell(page)
    .getByRole("button", { name: /^Select, install/ })
    .click();
  await shell(page).getByRole("button", { name: "Presets…" }).click();
  await sheet(page, tag, "presets");
  await inPage(page, /^Systems/);
  await stop(page, tag, "systems");
  if (device === "tablet-side") {
    await inPage(page, /^By world/);
    await stop(page, tag, "by-world");
  }
}

async function walkServer(page: Page, tag: string): Promise<void> {
  await tab(page, "Backups");
  await shell(page).locator(".stp-dock .stp-bkbar").waitFor();
  await stop(page, tag, "backups");
  for (const name of ["Worlds", "Modules", "Systems"]) {
    await inPage(page, new RegExp(`^${name}`));
    await stop(page, tag, `backups-${name.toLowerCase()}`);
  }
  await tab(page, "Configuration");
  await shell(page).locator(".stc-cols").waitFor();
  await stop(page, tag, "configuration");
  await tab(page, "Worlds");
  await shell(page).locator(".sth-ver").click();
  await menu(page, tag, "version-menu");
  await shell(page)
    .getByRole("button", { name: /Update page|What's new/ })
    .click();
  await shell(page)
    .locator(".sts-main .stb-head, .sts-main .stu-cols")
    .first()
    .waitFor();
  await stop(page, tag, "whats-new");
}

async function useTheme(theme: string): Promise<void> {
  await setupPost(admin, {
    action: "adminConfigure",
    config: { cssTheme: theme },
  });
}

for (const theme of THEMES) {
  for (const device of PHONE_SIZES) {
    test(`${theme}, ${device}: every page and panel`, async () => {
      await useTheme(theme);
      let app: AppHarness | undefined;
      try {
        app = await launchApp({ device });
        const page = await app.context.newPage();
        await openAppSetupAsAdmin(app, page, env.url, env.adminPassword);
        await expect(page.locator("body")).toHaveClass(
          new RegExp(`theme-${theme}`),
        );
        await exitTour(page);
        const tag = `${theme}-${device}`;
        await walkWorld(page, tag);
        await walkLibrary(page, tag, device);
        await walkServer(page, tag);
      } finally {
        await app?.close();
      }
    });
  }
}
