// The app's files, confirm and links (Android plan, phase 2, package 5),
// in the app harness on the local Foundry: export saves through native's
// file picker, import reads the file the user picks and asks first, a
// delete waits for native's dialog, and a link to another site goes to
// native (a Custom Tab on Android) instead of a new window. It runs its
// own app harness, so it runs the same in the extension's and the app's
// run of the suite.
import { expect, type Page, test } from "@playwright/test";
import {
  createAdminClient,
  shutdownWorld,
} from "../../scripts/foundry/admin.ts";
import { loadFoundryEnv } from "../../scripts/foundry/env.ts";
import {
  type AppHarness,
  launchApp,
  openAppSetupAsAdmin,
} from "../app/harness.ts";
import { exitTour, SCREENS, toasts } from "./extension.ts";

const env = loadFoundryEnv();
let app: AppHarness;
let page: Page;

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  const admin = await createAdminClient(env.url);
  await shutdownWorld(admin, env.adminPassword);
  await admin.dispose();
  app = await launchApp();
  page = await app.context.newPage();
  await openAppSetupAsAdmin(app, page, env.url, env.adminPassword);
  await exitTour(page);
  await shell()
    .getByRole("button", { name: /^Library/ })
    .click();
});

test.afterAll(async () => {
  await app.close();
});

const shell = () => page.locator("#ml-shell-root");
const lib = () => shell().locator(".mll-page");

async function transfer(item: string): Promise<void> {
  await lib().getByRole("button", { name: "Import and export" }).click();
  await shell()
    .getByRole("region", { name: "Import and export" })
    .getByRole("button", { name: item })
    .click();
}

test("Export saves the library through native's file picker", async () => {
  await transfer("Export the library");
  await expect.poll(() => app.native.saved.length).toBe(1);
  const [file] = app.native.saved;
  expect(file?.fileName).toMatch(/^module-library-\d{4}-\d{2}-\d{2}\.json$/);
  expect(JSON.parse(file?.text ?? "")).toHaveProperty("library");
});

test("Import asks native first; a no changes nothing, a yes imports", async () => {
  const exported = app.native.saved[0]?.text ?? "";
  app.native.confirmAnswer = false;
  app.native.toOpen.push(exported);
  await transfer("Import a library…");
  await expect.poll(() => app.native.confirms.length).toBe(1);
  expect(app.native.confirms[0]).toContain("Replace the whole library");
  app.native.confirmAnswer = true;
  app.native.toOpen.push(exported);
  await transfer("Import a library…");
  await expect.poll(() => app.native.confirms.length).toBe(2);
  // One import only: the "no" before it imported nothing (a second notice).
  const imported = toasts(page).filter({ hasText: "Library imported" });
  await expect(imported).toHaveCount(1);
  await page.waitForTimeout(500);
  await expect(imported).toHaveCount(1);
});

test("Delete tag waits for native's dialog", async () => {
  await lib().getByRole("button", { name: "Tags", exact: true }).click();
  const panel = shell().getByRole("complementary", { name: "Tags" });
  await panel.getByRole("button", { name: "New tag" }).click();
  const name = panel.getByRole("textbox", { name: "Name" });
  await name.fill("app check");
  await name.press("Enter");
  const listed = panel.locator(".mls-list li", { hasText: "app check" });
  await expect(listed).toBeVisible();
  app.native.confirmAnswer = false;
  await panel.getByRole("button", { name: "Delete tag" }).click();
  await expect
    .poll(() => app.native.confirms.at(-1))
    .toContain('Delete the tag "app check"');
  await expect(listed).toBeVisible();
  app.native.confirmAnswer = true;
  await panel.getByRole("button", { name: "Delete tag" }).click();
  await expect(listed).toHaveCount(0);
  await panel.getByRole("button", { name: "Close" }).click();
});

test("a link to another site goes to native, not to a new window", async () => {
  const pages = app.context.pages().length;
  await shell().locator(".mlh-ver").click();
  await shell().getByRole("link", { name: "Knowledge base" }).click();
  await expect
    .poll(() => app.native.external)
    .toContain("https://foundryvtt.com/kb/");
  await page.waitForTimeout(500);
  expect(app.context.pages()).toHaveLength(pages);
  await page.screenshot({ path: `${SCREENS}/app-link.png` });
});
