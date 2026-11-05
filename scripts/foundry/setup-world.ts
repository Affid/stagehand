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
import { resetWorldModules } from "./reset-world.ts";
import { ensureUsers, joinAs } from "./session.ts";
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
await api.dispose();
await resetWorldModules(env);

// Users: created once with the world open, then Foundry goes back to Setup.
const api2 = await createAdminClient(env.url);
await loginAsAdmin(api2, env.adminPassword, join(env.dataDir, "Config"));
await launchWorld(api2, TEST_WORLD.id);
const browser = await chromium.launch();
try {
  const gm = await joinAs(browser, env.url, "Gamemaster");
  for (const change of await ensureUsers(gm, TEST_USERS))
    console.log(`Users: ${change}`);
} finally {
  await browser.close();
}
await shutdownWorld(api2, env.adminPassword);
await api2.dispose();
console.log(
  `Test world ready: only ${COMPANION_ID} enabled, Foundry on Setup.`,
);
