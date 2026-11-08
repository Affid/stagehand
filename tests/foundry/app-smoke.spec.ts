// The app harness (Android plan, phase 2, package 4): today's Setup page
// through the app layer, the native side played in Node. Needs
// `pnpm build` (dist-app) and the local Foundry at Setup.
import { expect, type Page, test } from "@playwright/test";
import {
  createAdminClient,
  shutdownWorld,
} from "../../scripts/foundry/admin.ts";
import { loadFoundryEnv } from "../../scripts/foundry/env.ts";
import {
  type AppHarness,
  type Device,
  launchApp,
  openAppSetupAsAdmin,
} from "../app/harness.ts";
import { exitTour, SCREENS } from "./extension.ts";

const env = loadFoundryEnv();

test.beforeAll(async () => {
  const admin = await createAdminClient(env.url);
  await shutdownWorld(admin, env.adminPassword);
  await admin.dispose();
});

for (const device of ["desktop", "phone"] as const satisfies Device[]) {
  test(`Setup runs through the app layer (${device})`, async () => {
    let app: AppHarness | undefined;
    try {
      app = await launchApp({ device });
      const page = await app.context.newPage();
      await openAppSetupAsAdmin(app, page, env.url, env.adminPassword);
      await exitTour(page);
      // Our page took over: Foundry's layout hidden, our header and rail on.
      await expect(page.locator("#setup")).toBeHidden();
      await expect(page.locator("#ml-shell-root .mlh-ver")).toContainText(
        "Version 14",
      );
      // The background saw this Setup through native: an admin-verified server.
      const servers = app.native.get("servers") as
        Record<string, { adminVerifiedAt?: string }> | undefined;
      expect(servers?.[env.url]?.adminVerifiedAt).toBeTruthy();
      // Page scripts can't reach the bridge object.
      expect(
        await page.evaluate(
          () => typeof (globalThis as { mlApp?: unknown }).mlApp,
        ),
      ).toBe("undefined");
      await page.screenshot({ path: `${SCREENS}/app-setup-${device}.png` });
    } finally {
      await app?.close();
    }
  });
}

test.describe("native's rules, as a page script would try them", () => {
  let app: AppHarness;
  test.beforeAll(async () => {
    app = await launchApp();
    const page = await app.context.newPage();
    await openAppSetupAsAdmin(app, page, env.url, env.adminPassword);
    await page.close();
  });
  test.afterAll(async () => {
    await app.close();
  });

  /** What native answers a message from `page` (played into the relay). */
  async function answerTo(page: Page, message: object): Promise<unknown> {
    await page.evaluate(() => {
      const g = globalThis as {
        __mlHarnessDeliver?: (m: string) => void;
        __mlAnswers?: string[];
      };
      g.__mlAnswers = [];
      g.__mlHarnessDeliver = (m) => g.__mlAnswers?.push(m);
    });
    app.relay.fromPage(page, page.mainFrame(), JSON.stringify(message));
    await expect
      .poll(() =>
        page.evaluate(
          () => (globalThis as { __mlAnswers?: string[] }).__mlAnswers?.length,
        ),
      )
      .toBe(1);
    return JSON.parse(
      await page.evaluate(
        () => (globalThis as { __mlAnswers?: string[] }).__mlAnswers?.[0] ?? "",
      ),
    ) as unknown;
  }

  const save = {
    v: 1,
    id: "x1",
    type: "files.save",
    payload: { fileName: "a.json", text: "{}" },
  };

  test("on /join the bridge is gone and the server's requests are refused", async () => {
    const page = await app.context.newPage();
    await page.goto(`${env.url}/join`);
    expect(
      await page.evaluate(() => [
        typeof (globalThis as { mlApp?: unknown }).mlApp,
        typeof (globalThis as { __mlNativeSend?: unknown }).__mlNativeSend,
      ]),
    ).toEqual(["undefined", "undefined"]);
    expect(await answerTo(page, save)).toMatchObject({
      ok: false,
      error: expect.stringContaining("isn't allowed"),
    });
    // replaceState to /setup changes the live URL, not the committed one.
    await page.evaluate(() => {
      history.replaceState(null, "", "/setup");
    });
    expect(await answerTo(page, { ...save, id: "x2" })).toMatchObject({
      ok: false,
    });
    expect(app.native.saved).toEqual([]);
    await page.close();
  });

  test("a Setup page can't answer native's route in the background's place", async () => {
    const page = await app.context.newPage();
    await page.goto(`${env.url}/setup`);
    await page.locator("#ml-shell-root .mls-top").waitFor();
    // A forged reply for the next route id: dropped (not the background).
    app.relay.fromPage(
      page,
      page.mainFrame(),
      JSON.stringify({ v: 1, re: "native-999", ok: true, result: "forged" }),
    );
    expect(
      await answerTo(page, {
        v: 1,
        id: "x3",
        type: "kv.get",
        payload: { key: "servers" },
      }),
    ).toMatchObject({ ok: false });
    // Another wire version gets no answer at all.
    await page.evaluate(() => {
      (globalThis as { __mlAnswers?: string[] }).__mlAnswers = [];
    });
    app.relay.fromPage(
      page,
      page.mainFrame(),
      JSON.stringify({
        v: 2,
        id: "x4",
        type: "confirm",
        payload: { text: "?" },
      }),
    );
    await page.waitForTimeout(500);
    expect(
      await page.evaluate(
        () => (globalThis as { __mlAnswers?: string[] }).__mlAnswers?.length,
      ),
    ).toBe(0);
    expect(app.native.confirms).toEqual([]);
    await page.close();
  });
});
