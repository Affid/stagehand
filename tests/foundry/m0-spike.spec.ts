// M0 spike, end to end on the local Foundry: dynamic registration, Setup
// injection in both worlds, admin verification, queueing from Setup, the
// game page bridge, and the companion's apply-and-reload with two-phase ack.
import {
  type APIRequestContext,
  expect,
  type Page,
  test,
} from "@playwright/test";
import {
  createAdminClient,
  launchWorld,
  loginAsAdmin,
  shutdownWorld,
} from "../../scripts/foundry/admin.ts";
import { loadFoundryEnv } from "../../scripts/foundry/env.ts";
import { COMPANION_ID, TEST_WORLD } from "../../scripts/foundry/world.ts";
import {
  exitTour,
  joinWorld,
  type LoadedExtension,
  loadExtension,
  storage,
  waitReady,
} from "./extension.ts";

const env = loadFoundryEnv();
const SERVER = env.url;

interface StoredCommand {
  readonly id: string;
  readonly status: string;
  readonly payload: { readonly modules: readonly string[] };
}

let ext: LoadedExtension;
let admin: APIRequestContext;
let page: Page;

const commands = async (): Promise<readonly StoredCommand[]> =>
  ((await storage(ext.worker))[`commands:${SERVER}`] ?? []) as StoredCommand[];

const activeModules = (p: Page): Promise<string[]> =>
  p.evaluate(() => {
    const g = globalThis as unknown as {
      game: { modules: Map<string, { id: string; active: boolean }> };
    };
    return [...g.game.modules.values()]
      .filter((m) => m.active)
      .map((m) => m.id);
  });

async function resetWorldModules(p: Page): Promise<void> {
  await p.evaluate(async (companion) => {
    const g = globalThis as unknown as {
      game: {
        settings: { set(ns: string, k: string, v: object): Promise<unknown> };
      };
    };
    await g.game.settings.set("core", "moduleConfiguration", {
      [companion]: true,
    });
  }, COMPANION_ID);
}

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  admin = await createAdminClient(SERVER);
  await shutdownWorld(admin, env.adminPassword);
  await loginAsAdmin(admin, env.adminPassword, `${env.dataDir}/Config`);
  ext = await loadExtension();
  page = await ext.context.newPage();
});

test.afterAll(async () => {
  await ext.context.close();
  await shutdownWorld(admin, env.adminPassword);
  await admin.dispose();
});

test("registers the server and its content scripts from the options page", async () => {
  await page.goto(`chrome-extension://${ext.id}/options.html`);
  await page.locator("#server-url").fill(`${SERVER}/`);
  await page.locator("#add-server button").click();
  await expect(page.locator("#status")).toHaveText(`Registered ${SERVER}`);
  const ids = await ext.worker.evaluate(async () =>
    (await chrome.scripting.getRegisteredContentScripts()).map((s) => s.id),
  );
  expect(ids).toHaveLength(3);
});

test("reads package data on Setup and verifies the admin", async () => {
  await ext.context.request.post(`${SERVER}/auth`, {
    form: { action: "adminAuth", adminPassword: env.adminPassword },
    headers: { Origin: SERVER },
    maxRedirects: 0,
  });
  await page.goto(`${SERVER}/setup`);
  const panel = page.locator("#module-library-panel");
  await expect(panel.locator(".summary")).toContainText("admin verified");
  const coreCount = await page.evaluate(
    () =>
      (globalThis as unknown as { game: { modules: { size: number } } }).game
        .modules.size,
  );
  await expect(panel.locator(".summary")).toContainText(`${coreCount} modules`);
  const servers = (await storage(ext.worker)).servers as Record<
    string,
    { adminVerifiedAt?: string }
  >;
  expect(servers[SERVER]?.adminVerifiedAt).toBeTruthy();
  await page.screenshot({ path: "test-results/spike/setup-with-panel.png" });
});

test("survives Setup re-rendering (renderSetupPackages)", async () => {
  await page.evaluate(() =>
    (
      globalThis as unknown as {
        ui: { setupPackages: { render(): Promise<unknown> } };
      }
    ).ui.setupPackages.render(),
  );
  await expect(page.locator("#module-library-panel")).toHaveCount(1);
});

test("queues an Add command for the test world from Setup", async () => {
  await exitTour(page);
  const form = page.locator("#module-library-panel form");
  await form.locator('select[name="world"]').selectOption(TEST_WORLD.id);
  await form.locator('select[name="mode"]').selectOption("add");
  await form.locator('input[name="modules"]').fill("ml-fixture-a ml-ghost");
  await form.locator('button[type="submit"]').click();
  await expect(form.locator("output")).toContainText("Queued");
  expect((await commands()).map((c) => c.status)).toEqual(["pending"]);
});

test("the companion applies it in-world after GM confirmation", async () => {
  await launchWorld(admin, TEST_WORLD.id);
  await joinWorld(page, SERVER, "Gamemaster");
  const dialog = page.locator("dialog.application", {
    hasText: "Module Library",
  });
  await expect(dialog).toContainText("ml-fixture-a");
  await expect(dialog).toContainText("ml-fixture-lib");
  await expect(dialog).toContainText("ml-ghost");
  await page.screenshot({ path: "test-results/spike/apply-dialog.png" });
  expect((await commands())[0]?.status).toBe("pending");

  await dialog.locator('button[data-action="yes"]').click();
  await page.waitForEvent("load");
  await waitReady(page);
  expect((await activeModules(page)).sort()).toEqual(
    ["ml-fixture-a", "ml-fixture-lib", COMPANION_ID].sort(),
  );
  await expect.poll(async () => (await commands())[0]?.status).toBe("applied");
  const snapshots = (await storage(ext.worker))[
    `snapshots:${SERVER}`
  ] as Record<string, { active: { id: string }[] }>;
  expect(snapshots[TEST_WORLD.id]?.active.map((m) => m.id).sort()).toEqual(
    ["ml-fixture-a", "ml-fixture-lib", COMPANION_ID].sort(),
  );
});

test("an Assistant GM gets no apply dialog (PR-4)", async () => {
  await ext.worker.evaluate(async (key) => {
    const items = await chrome.storage.local.get(key);
    const list = (items[key] ?? []) as object[];
    await chrome.storage.local.set({
      [key]: [
        ...list,
        {
          id: "assistant-check",
          worldId: "module-library-test",
          type: "preset.apply",
          payload: { mode: "add", modules: ["ml-fixture-b"] },
          createdAt: new Date().toISOString(),
          status: "pending",
        },
      ],
    });
  }, `commands:${SERVER}`);
  // One user at a time: pages of this context share Foundry's session cookie,
  // and a user still connected can't be chosen on the join page.
  await page.goto("about:blank");
  await joinWorld(page, SERVER, "Assistant");
  await page.waitForTimeout(5000);
  await expect(
    page.locator("dialog.application", { hasText: "Module Library" }),
  ).toHaveCount(0);
  expect(
    (await commands()).find((c) => c.id === "assistant-check")?.status,
  ).toBe("pending");
  await page.screenshot({ path: "test-results/spike/assistant-no-dialog.png" });

  // The full GM gets it and declines.
  await page.goto("about:blank");
  await joinWorld(page, SERVER, "Gamemaster");
  const dialog = page.locator("dialog.application", {
    hasText: "Module Library",
  });
  await expect(dialog).toContainText("ml-fixture-b");
  await dialog.locator('button[data-action="no"]').click();
  await expect
    .poll(
      async () =>
        (await commands()).find((c) => c.id === "assistant-check")?.status,
    )
    .toBe("declined");
  await resetWorldModules(page);
});
