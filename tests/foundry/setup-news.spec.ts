// News and Featured Content at the foot of the worlds rail (Phase 6), from
// Foundry's own news (game.data.news, featuredContent; Logs/news.json on the
// server, filled by its update check). Needs news on the local server.
import { expect, type Page, test } from "@playwright/test";
import { loadFoundryEnv } from "../../scripts/foundry/env.ts";
import {
  type LoadedExtension,
  loadExtension,
  openSetupAsAdmin,
  SCREENS,
  storage,
} from "./extension.ts";

const env = loadFoundryEnv();
let ext: LoadedExtension;
let page: Page;

const rail = (p: Page) => p.locator("#ml-shell-root .mls-rail");
const news = (p: Page) => rail(p).locator(".mlr-news");

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  ext = await loadExtension();
  page = await ext.context.newPage();
  await page.setViewportSize({ width: 1366, height: 768 });
  await openSetupAsAdmin(ext, page, env.url, env.adminPassword);
});

test.afterAll(async () => {
  await ext.context.close();
});

/** Foundry's own news, as Setup has it. */
async function foundryNews(p: Page): Promise<{ titles: string[] }> {
  return p.evaluate(() => {
    const g = globalThis as unknown as {
      game: { data: { news?: { title: string }[] } };
    };
    return { titles: (g.game.data.news ?? []).map((n) => n.title) };
  });
}

test("a first visit: nothing is new, News is folded to its latest headline", async () => {
  const { titles } = await foundryNews(page);
  test.skip(titles.length === 0, "This server has no news from Foundry yet.");
  await expect(news(page)).toHaveClass(/folded/);
  await expect(news(page).locator(".latest")).toHaveText(titles[0] ?? "");
  await expect(news(page).getByText("New", { exact: true })).toHaveCount(0);
  const feat = rail(page).getByRole("region", { name: "Featured Content" });
  await expect(feat.locator("a.banner")).toHaveAttribute(
    "rel",
    "noopener noreferrer",
  );
  await expect(feat.locator("img")).toBeVisible();
  await page.screenshot({ path: `${SCREENS}/news-folded-1366.png` });
});

test("an article Foundry adds later is New, and News opens on it", async () => {
  // Forget the latest article, as if Foundry had just published it.
  await ext.worker.evaluate(async () => {
    const all = await chrome.storage.local.get(null);
    const k = Object.keys(all).find((x) => x.startsWith("news-seen:"));
    if (!k) throw new Error("no news read state");
    const seen = all[k] as string[];
    await chrome.storage.local.set({ [k]: seen.slice(1) });
  });
  await page.reload();
  await expect(news(page)).not.toHaveClass(/folded/);
  await expect(news(page).locator("header .new")).toHaveText("New");
  const first = news(page).locator("a.banner").first();
  await expect(first.locator(".k.new")).toHaveText("New");
  // Foundry's banner loaded and is shown whole (2.39:1).
  const box = await first.locator("img").boundingBox();
  expect(box && box.width / box.height).toBeCloseTo(2.39, 1);
  await page.screenshot({ path: `${SCREENS}/news-open-1366.png` });
});

test("the arrows step through the articles; only the one shown is reachable", async () => {
  const count = await news(page).locator("a.banner").count();
  test.skip(count < 2, "Only one article.");
  await news(page).locator(".viewport").hover();
  await news(page).getByRole("button", { name: "Next article" }).click();
  // Shown "2 / 4"; screen readers also hear the article's title.
  await expect(news(page).locator(".navs .c")).toHaveText(
    new RegExp(`^2 / ${String(count)}: .+`),
  );
  const shown = await news(page).locator(".navs .c").boundingBox();
  expect(shown?.width).toBeLessThan(60);
  await expect(news(page).locator("a.banner").nth(0)).toHaveAttribute(
    "inert",
    "",
  );
  // The track slid: the second banner is now where the first was.
  await expect
    .poll(
      async () =>
        (await news(page).locator("a.banner").nth(1).boundingBox())?.x,
    )
    .toBeCloseTo(
      (await news(page).locator(".viewport").boundingBox())?.x ?? 0,
      0,
    );
});

test("opening an article opens Foundry's page in a new tab and marks News read", async () => {
  const banner = news(page).locator("a.banner:not([inert])");
  const href = await banner.getAttribute("href");
  const [tab] = await Promise.all([
    ext.context.waitForEvent("page"),
    banner.click(),
  ]);
  expect(tab.url()).toContain(new URL(href ?? "").host);
  await tab.close();
  // Read now, but left open until the next load, so focus isn't lost.
  await expect(news(page).locator("header .new")).toHaveCount(0);
  await expect(news(page)).not.toHaveClass(/folded/);
  const stored = await storage(ext.worker);
  const k = Object.keys(stored).find((x) => x.startsWith("news-seen:"));
  expect((stored[k ?? ""] as string[]).length).toBeGreaterThan(0);
  // Still read after a reload.
  await page.reload();
  await expect(news(page)).toHaveClass(/folded/);
});

test("the fold works by keyboard", async () => {
  const toggle = news(page).getByRole("button", { name: "News" });
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await toggle.focus();
  await page.keyboard.press("Enter");
  await expect(news(page)).not.toHaveClass(/folded/);
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await expect(toggle).toBeFocused();
});
