// Screenshots for the Chrome Web Store and the README (1280 x 800), from the
// demo server (scripts/demo/setup-demo.ts), never the test servers. Runs
// only when asked:
//   ST_STORE_SHOTS=1 FOUNDRY_PORT=30015 FOUNDRY_DATA_DIR=~/foundry/data-demo \
//     pnpm test:foundry store-screenshots
// Foundry's own notices and the rail's Featured Content (an advert Foundry
// chooses) are hidden; everything else is the page as it is. A queued change
// is made and discarded again, and nothing is launched.
import { expect, type Locator, type Page, test } from "@playwright/test";
import { loadFoundryEnv } from "../../scripts/foundry/env.ts";
import { loadTarget, openSetupAsAdmin, type Target } from "./target.ts";

const env = loadFoundryEnv();
const OUT = "docs/store/screenshots";
let ext: Target;
let page: Page;

test.describe.configure({ mode: "serial" });
test.skip(
  process.env.ST_STORE_SHOTS !== "1",
  "demo server only: ST_STORE_SHOTS=1",
);

const shell = (): Locator => page.locator("#st-shell-root");
const main = (): Locator => shell().locator(".sts-main");
const lib = (): Locator => shell().locator(".stl-page");

async function shot(name: string): Promise<void> {
  // After any reload too: Foundry's notices and its advert stay out.
  await page.addStyleTag({
    content: "#notifications, .str-feat { display: none !important; }",
  });
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/${name}.png` });
}

test.beforeAll(async () => {
  ext = await loadTarget();
  page = await ext.context.newPage();
  await openSetupAsAdmin(ext, page, env.url, env.adminPassword);
  await page.setViewportSize({ width: 1280, height: 800 });
});

test.afterAll(async () => {
  await ext.close();
});

test("the library: folders, tags and notes", async () => {
  await shell()
    .getByRole("button", { name: /^Library/ })
    .click();
  await expect(lib().locator(".stl-sync.synced")).toBeVisible();
  await page.reload();
  await shell()
    .getByRole("button", { name: /^Library/ })
    .click();
  await expect(lib().locator(".stl-card").first()).toBeVisible();
  await shot("1-library");
});

test("presets beside the library", async () => {
  await lib().getByRole("button", { name: "Presets", exact: true }).click();
  await shot("2-presets");
  await shell()
    .getByRole("complementary", { name: "Presets" })
    .getByRole("button", { name: "Close" })
    .click();
});

test("every module in every world", async () => {
  await lib()
    .getByRole("tab", { name: /By world/ })
    .click();
  await shot("3-by-world");
});

test("a world's modules, a change queued, and the launch review", async () => {
  await shell()
    .locator('.sts-world[data-world="lighthouse-greywater"]')
    .click();
  await expect(main().locator(".stw-card").first()).toBeVisible();
  await shot("4-world");
  await main().locator('.stw-card input[role="switch"]').nth(2).click();
  await main()
    .getByRole("button", { name: /^Launch/ })
    .click();
  const review = page.getByRole("dialog");
  await expect(review).toBeVisible();
  await shot("5-launch-review");
  await review.getByRole("button", { name: "Cancel" }).click();
  await main()
    .locator(".sts-banner")
    .getByRole("button", { name: "Discard" })
    .click();
});
