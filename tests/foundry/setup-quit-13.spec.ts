// Shut down on Foundry 13 for real (docs/FOUNDRY-13-PLAN.md): our confirm,
// Foundry 13 stops, and our page says "Foundry has stopped". It stops the
// server, so it runs only when asked: ST_QUIT_13=1, against a private 13
// server you start again afterwards.
import { expect, type Page, test } from "@playwright/test";
import { loadFoundryEnv } from "../../scripts/foundry/env.ts";
import { ON_13 } from "./core.ts";
import { SCREENS } from "./extension.ts";
import { loadTarget, openSetupAsAdmin, type Target } from "./target.ts";

const env = loadFoundryEnv();
let ext: Target;
let page: Page;

test.skip(
  !ON_13 || process.env.ST_QUIT_13 !== "1",
  "stops the server: Foundry 13 with ST_QUIT_13=1 only",
);

test.beforeAll(async () => {
  ext = await loadTarget();
  page = await ext.context.newPage();
  await openSetupAsAdmin(ext, page, env.url, env.adminPassword);
});

test.afterAll(async () => {
  await ext.close();
});

test("Shut down: our confirm, then Foundry has stopped", async () => {
  const shell = page.locator("#st-shell-root");
  await shell.getByRole("button", { name: "Log out or shut down" }).click();
  await shell.getByRole("button", { name: "Shut down the server" }).click();
  const confirm = shell.getByRole("dialog", { name: "Shut down Foundry" });
  await confirm.getByRole("button", { name: "Shut down Foundry" }).click();
  const stopped = shell.getByRole("alertdialog", {
    name: "Foundry has stopped",
  });
  await expect(stopped).toBeVisible({ timeout: 20_000 });
  await expect(confirm).toHaveCount(0);
  await expect
    .poll(async () =>
      fetch(`${env.url}/api/status`).then(
        () => "up",
        () => "down",
      ),
    )
    .toBe("down");
  // Our page asks nothing more of the stopped Foundry: no error notices.
  await page.waitForTimeout(3000);
  await expect(
    page.locator("#notifications li", { hasText: "Failed to fetch" }),
  ).toHaveCount(0);
  await page.screenshot({ path: `${SCREENS}/shell-stopped-13.png` });
});
