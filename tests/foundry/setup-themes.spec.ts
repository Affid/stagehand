// The new Setup page in each of Foundry's Setup themes (polish pass). The
// theme is set as Foundry's Configuration does and put back at the end.
// Fantasy and Sci-Fi give inputs and selects their own field colours but
// not text boxes; ours match the theme's other fields. Every text link on
// a world's About and on Configuration reaches 4.5:1. The theme is put
// back in afterAll, so only a killed runner leaves the server in another.
import {
  type APIRequestContext,
  expect,
  type Locator,
  type Page,
  test,
} from "@playwright/test";
import { join } from "node:path";
import {
  createAdminClient,
  loginAsAdmin,
  setupPost,
} from "../../scripts/foundry/admin.ts";
import { loadFoundryEnv } from "../../scripts/foundry/env.ts";
import { contrasts } from "./contrast.ts";
import { SCREENS } from "./extension.ts";
import { loadTarget, openSetupAsAdmin, type Target } from "./target.ts";

const env = loadFoundryEnv();
const THEMES = ["dark", "fantasy", "scifi"] as const;
let ext: Target | undefined;
let admin: APIRequestContext | undefined;
let page: Page;
let before = "";

const shell = (): Locator => page.locator("#st-shell-root");

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  admin = await createAdminClient(env.url);
  await loginAsAdmin(admin, env.adminPassword, join(env.dataDir, "Config"));
  ext = await loadTarget();
  page = await ext.context.newPage();
  await page.setViewportSize({ width: 1920, height: 1080 });
  await openSetupAsAdmin(ext, page, env.url, env.adminPassword);
  const theme = await page.evaluate(
    () =>
      (
        window as unknown as {
          game?: { data?: { options?: { cssTheme?: unknown } } };
        }
      ).game?.data?.options?.cssTheme,
  );
  // Never change a theme that can't be put back.
  if (
    typeof theme !== "string" ||
    !(THEMES as readonly string[]).includes(theme)
  )
    throw new Error(`Unknown Setup theme: ${String(theme)}`);
  before = theme;
});

test.afterAll(async () => {
  try {
    if (before && admin)
      await setupPost(admin, {
        action: "adminConfigure",
        config: { cssTheme: before },
      });
  } finally {
    await Promise.allSettled([ext?.close(), admin?.dispose()]);
  }
});

async function useTheme(theme: string): Promise<void> {
  if (!admin) throw new Error("no admin client");
  await setupPost(admin, {
    action: "adminConfigure",
    config: { cssTheme: theme },
  });
  await page.goto(`${env.url}/setup`);
  await expect(page.locator("body")).toHaveClass(new RegExp(`theme-${theme}`));
  await shell().locator(".sts-rail").waitFor();
}

const background = (l: Locator): Promise<string> =>
  l.evaluate((e) => getComputedStyle(e).backgroundColor);

for (const theme of THEMES) {
  test(`${theme}: the Note box looks like the other fields`, async () => {
    await useTheme(theme);
    await shell().locator(".sts-lib").click();
    await shell().locator(".sts-main button.t").first().click();
    const panel = shell().locator(".sts-panel");
    const note = panel.locator("textarea").first();
    await expect(note).toBeVisible();
    const bg = await background(note);
    expect(bg).not.toBe("rgba(0, 0, 0, 0)");
    expect(bg).toBe(await background(panel.locator("select").first()));
    await page.screenshot({ path: `${SCREENS}/themes-${theme}-note.png` });
  });

  test(`${theme}: text links on About and Configuration reach 4.5:1`, async () => {
    await useTheme(theme);
    await shell().locator(".sts-world").first().click();
    await shell()
      .locator(".sts-main")
      .getByRole("tab", { name: /About/ })
      .click();
    const about = await contrasts(shell().locator(".sts-main .st-link"));
    await shell()
      .locator(".sts-top")
      .getByRole("button", { name: "Configuration" })
      .click();
    const backups = shell()
      .locator(".sts-main")
      .getByRole("button", { name: "Backups", exact: true });
    await expect(backups).toBeVisible();
    const config = await contrasts(shell().locator(".sts-main .st-link"));
    await page.screenshot({ path: `${SCREENS}/themes-${theme}-config.png` });
    expect(about.length).toBeGreaterThan(0);
    expect(config.map((c) => c.text)).toContain("Backups");
    for (const c of [...about, ...config])
      expect(c.ratio, `${c.text} (${c.color})`).toBeGreaterThanOrEqual(4.5);
  });
}
