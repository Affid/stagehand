// The app starts on a device (Android plan, phase 5, package 1): installed
// with no data, it opens on its home screen in its own words, the hidden
// background answers it, and the WebViews are where the suite finds them.
import { expect, test } from "@playwright/test";
import { App, HOME, installFresh, PKG } from "./app.ts";
import { focused } from "./native-ui.ts";

const app = new App();

test.afterAll(async () => {
  await app.close();
});

test("a fresh install opens on home, answered by the background", async () => {
  installFresh();
  const home = await app.pageAt(HOME);
  expect(focused()).toBe(PKG);
  // The list comes from the background: the empty card means it answered.
  await expect(home.getByText("Your Foundry servers")).toBeVisible();
  await expect(
    home.getByRole("switch", { name: "Release history" }),
  ).toHaveAttribute("aria-checked", "false");
  const background = await app.pageAt(
    "https://appassets.androidplatform.net/background.html",
  );
  expect(await background.evaluate(() => "mlApp" in window)).toBe(false);
  await app.shot("home-empty");
});
