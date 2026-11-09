// The companion module on plain http at a network address (Android spike,
// finding 4): there the page is not a secure context and browsers leave out
// some APIs (crypto.randomUUID once kept the companion from ever acting).
// The companion must still save its report in the world's flags there. The
// rest of the suite runs on localhost, a secure context, where this can't show.
// Needs Foundry listening on all addresses (its default), so the test world
// is reachable from the local network while it runs; skips when the machine
// has no network address or the server is https.
import { networkInterfaces } from "node:os";
import { type APIRequestContext, expect, test } from "@playwright/test";
import {
  createAdminClient,
  launchWorld,
  loginAsAdmin,
  shutdownWorld,
} from "../../scripts/foundry/admin.ts";
import { loadFoundryEnv } from "../../scripts/foundry/env.ts";
import { resetWorldModules } from "../../scripts/foundry/reset-world.ts";
import { TEST_WORLD } from "../../scripts/foundry/world.ts";
import { joinWorld } from "./extension.ts";
import { ON_APP } from "./target.ts";

// Neither build is involved: run once, with the extension's suite.
test.skip(ON_APP, "same check as the extension's run");

const env = loadFoundryEnv();

/** This machine's first IPv4 network address, if any. */
function networkAddress(): string | undefined {
  return Object.values(networkInterfaces())
    .flat()
    .find((i) => i?.family === "IPv4" && !i.internal)?.address;
}

const address = networkAddress();
const server = new URL(env.url);
let admin: APIRequestContext | undefined;

test.beforeAll(async () => {
  test.skip(!address, "no network address on this machine");
  test.skip(server.protocol !== "http:", "the server is not plain http");
  await resetWorldModules(env);
  const api = await createAdminClient(env.url);
  admin = api;
  await loginAsAdmin(api, env.adminPassword, `${env.dataDir}/Config`);
  await launchWorld(api, TEST_WORLD.id);
});

test.afterAll(async () => {
  if (!admin) return;
  try {
    await shutdownWorld(admin, env.adminPassword);
  } finally {
    await admin.dispose();
  }
});

test("the companion saves its report on http at a network address", async ({
  page,
}) => {
  const url = `http://${String(address)}:${server.port || "80"}`;
  await joinWorld(page, url, "Gamemaster");
  expect(await page.evaluate(() => isSecureContext)).toBe(false);
  // The world was reset without our flags: only this join can have written one.
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const g = globalThis as unknown as {
            game: { world: { flags: Record<string, { report?: unknown }> } };
          };
          return g.game.world.flags.stagehand?.report !== undefined;
        }),
      { timeout: 20_000 },
    )
    .toBe(true);
});
