// Prepares the Module Library test world, safe to run again: creates it,
// its users, enables only the companion module, then returns to Setup.
// Run `pnpm build && pnpm foundry:link` first.
import { existsSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "@playwright/test";
import {
  createAdminClient,
  createWorld,
  hasActiveWorld,
  launchWorld,
  loginAsAdmin,
  shutdownWorld,
} from "./admin.ts";
import { loadFoundryEnv } from "./env.ts";
import { ensureUsers, joinAs, reloadWorld } from "./session.ts";
import { COMPANION_ID, TEST_USERS, TEST_WORLD } from "./world.ts";

const env = loadFoundryEnv();
const api = await createAdminClient(env.url);
if (await hasActiveWorld(api)) {
  console.log("A world is running: shutting it down first.");
  await shutdownWorld(api, env.adminPassword);
}
const login = await loginAsAdmin(
  api,
  env.adminPassword,
  join(env.dataDir, "Config"),
);
if (login !== "logged-in") throw new Error("Administrator password not set up");
const worldFile = join(
  env.dataDir,
  "Data",
  "worlds",
  TEST_WORLD.id,
  "world.json",
);
if (!existsSync(worldFile)) {
  console.log(`World ${TEST_WORLD.id}: creating`);
  await createWorld(api, TEST_WORLD, worldFile);
}
console.log(`World ${TEST_WORLD.id}: launching`);
await launchWorld(api, TEST_WORLD.id);

const browser = await chromium.launch();
try {
  const gm = await joinAs(browser, env.url, "Gamemaster");
  for (const change of await ensureUsers(gm, TEST_USERS))
    console.log(`Users: ${change}`);
  await gm.evaluate(async (companion) => {
    const g = globalThis as unknown as {
      game: {
        settings: { set(ns: string, key: string, v: object): Promise<unknown> };
      };
    };
    await g.game.settings.set("core", "moduleConfiguration", {
      [companion]: true,
    });
  }, COMPANION_ID);
  await reloadWorld(gm);
  console.log(`Modules: only ${COMPANION_ID} enabled`);
} finally {
  await browser.close();
}
await shutdownWorld(api, env.adminPassword);
await api.dispose();
console.log("Test world ready; Foundry is back on Setup.");
