// Puts the test world back to "only the companion enabled", with none of
// our flags (no queue, launch or report left from an earlier run), and
// returns Foundry to Setup. Used by setup-world.ts and the end-to-end suites.
import { type APIRequestContext, chromium } from "@playwright/test";
import {
  createAdminClient,
  launchWorld,
  loginAsAdmin,
  shutdownWorld,
} from "./admin.ts";
import type { FoundryEnv } from "./env.ts";
import { joinAs, reloadWorld } from "./session.ts";
import { COMPANION_ID, TEST_WORLD } from "./world.ts";

/** Removes our flags from the stopped test world (Foundry's world edit). */
export async function clearOurFlags(api: APIRequestContext): Promise<void> {
  const res = await api.post("/setup", {
    data: {
      action: "editWorld",
      id: TEST_WORLD.id,
      flags: { [`-=${COMPANION_ID}`]: null },
    },
    maxRedirects: 0,
  });
  if (!res.ok()) throw new Error(`Clearing our flags: HTTP ${res.status()}`);
}

export async function resetWorldModules(env: FoundryEnv): Promise<void> {
  const api = await createAdminClient(env.url);
  try {
    await shutdownWorld(api, env.adminPassword);
    await loginAsAdmin(api, env.adminPassword, `${env.dataDir}/Config`);
    await clearOurFlags(api);
    await launchWorld(api, TEST_WORLD.id);
    const browser = await chromium.launch();
    try {
      const gm = await joinAs(browser, env.url, "Gamemaster");
      await gm.evaluate(async (companion) => {
        const g = globalThis as unknown as {
          game: {
            settings: {
              set(ns: string, key: string, v: object): Promise<unknown>;
            };
          };
        };
        await g.game.settings.set("core", "moduleConfiguration", {
          [companion]: true,
        });
      }, COMPANION_ID);
      await reloadWorld(gm);
    } finally {
      await browser.close();
    }
    await shutdownWorld(api, env.adminPassword);
  } finally {
    await api.dispose();
  }
}
