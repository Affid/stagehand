// The companion module on plain http at a network address (Android spike,
// finding 4): there the page is not a secure context and browsers leave out
// crypto.randomUUID, which the companion used for its request ids, so it
// never said HELLO and queued changes never applied at launch. The rest of
// the suite runs on localhost, a secure context, where this can't show.
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

test("the companion says HELLO on http at a network address", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const seen: string[] = [];
    (window as unknown as { __mlHello: string[] }).__mlHello = seen;
    addEventListener("message", (e: MessageEvent<unknown>) => {
      const d = e.data as { ns?: string; from?: string; type?: string } | null;
      if (d?.ns === "stagehand" && d.from === "module") seen.push(d.type ?? "");
    });
  });
  const url = `http://${String(address)}:${server.port || "80"}`;
  await joinWorld(page, url, "Gamemaster");
  expect(await page.evaluate(() => isSecureContext)).toBe(false);
  await expect
    .poll(
      () =>
        page.evaluate(
          () => (window as unknown as { __mlHello: string[] }).__mlHello,
        ),
      { timeout: 20_000 },
    )
    .toContain("HELLO");
});
