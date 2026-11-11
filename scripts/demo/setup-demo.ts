// A demo Foundry for screenshots (store listing, README): real free modules
// from Foundry's package list, the Simple Worldbuilding system (no
// third-party art), three worlds with plain generated backgrounds, each
// launched once with its modules and the companion on so the companion
// reports, and a library with folders, tags, notes and presets placed where
// Stagehand syncs it from. Safe to run again. Run against a server of its
// own, never the test servers (their suites expect only the fixtures):
//   FOUNDRY_PORT=30015 FOUNDRY_DATA_DIR=~/foundry/data-demo node scripts/demo/setup-demo.ts
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium, type Page } from "@playwright/test";
import {
  createAdminClient,
  createWorld,
  findPackage,
  installPackage,
  launchWorld,
  loginAsAdmin,
  setupPost,
  shutdownWorld,
  waitFor,
} from "../foundry/admin.ts";
import { loadFoundryEnv } from "../foundry/env.ts";
import { joinAs, reloadWorld } from "../foundry/session.ts";
import { DEMO_LIBRARY } from "./demo-library.ts";
import { DEMO_MODULES } from "./demo-modules.ts";
import { DEMO_SYSTEM, DEMO_WORLDS, type DemoWorld } from "./demo-worlds.ts";

const env = loadFoundryEnv();
const DATA = join(env.dataDir, "Data");
const COMPANION_MANIFEST =
  "https://raw.githubusercontent.com/Affid/stagehand/manifests/stagehand/module.json";

type Api = Awaited<ReturnType<typeof createAdminClient>>;

async function install(api: Api): Promise<void> {
  const system = join(DATA, "systems", DEMO_SYSTEM, "system.json");
  if (!existsSync(system))
    await installPackage(
      api,
      await findPackage(api, "system", DEMO_SYSTEM),
      "system",
      system,
    );
  for (const id of DEMO_MODULES) {
    const file = join(DATA, "modules", id, "module.json");
    if (existsSync(file)) continue;
    console.log(`Installing ${id}`);
    await installPackage(
      api,
      await findPackage(api, "module", id),
      "module",
      file,
    );
  }
  const companion = join(DATA, "modules", "stagehand", "module.json");
  if (!existsSync(companion)) {
    console.log("Installing the companion from its published manifest");
    const listing = { id: "stagehand", manifest: COMPANION_MANIFEST };
    await installPackage(api, listing, "module", companion);
  }
}

/** A soft two-colour gradient: our own art, nobody else's. */
const background = (from: string, to: string): string =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
<stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/>
</linearGradient></defs><rect width="1920" height="1080" fill="url(#g)"/>
<circle cx="1500" cy="260" r="420" fill="${to}" opacity="0.35"/>
<circle cx="380" cy="900" r="520" fill="${from}" opacity="0.30"/></svg>`;

async function createWorlds(api: Api): Promise<void> {
  for (const w of DEMO_WORLDS) {
    const dir = join(DATA, "worlds", w.id);
    const file = join(dir, "world.json");
    if (!existsSync(file)) {
      console.log(`Creating ${w.title}`);
      await createWorld(
        api,
        { id: w.id, title: w.title, system: DEMO_SYSTEM },
        file,
      );
    }
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, "background.svg"),
      background(w.colors[0], w.colors[1]),
    );
    await setupPost(api, {
      action: "editWorld",
      id: w.id,
      background: `worlds/${w.id}/background.svg`,
      description: `<p>${w.description}</p>`,
    });
  }
}

/** The world's modules as its companion last reported them. */
function reportedIds(w: DemoWorld): string[] | undefined {
  const json = JSON.parse(
    readFileSync(join(DATA, "worlds", w.id, "world.json"), "utf8"),
  ) as { flags?: { stagehand?: { report?: { active?: unknown } } } };
  const active = json.flags?.stagehand?.report?.active;
  if (!Array.isArray(active)) return undefined;
  // Each entry is "id" or "id@version" (shared world-flags, encodeActive).
  return active.map((a) => String(a).split("@")[0] ?? "");
}

/** The companion reported exactly the world's modules and itself. */
function reported(w: DemoWorld): boolean {
  const ids = reportedIds(w);
  const want = new Set([...w.modules, "stagehand"]);
  return ids?.length === want.size && ids.every((id) => want.has(id));
}

/** Exactly these modules on in the world, every other one off. */
async function exactModules(gm: Page, ids: readonly string[]): Promise<void> {
  await gm.evaluate(async (wanted) => {
    const g = globalThis as unknown as {
      game: {
        modules: Map<string, unknown>;
        settings: {
          set(ns: string, key: string, value: object): Promise<unknown>;
        };
      };
    };
    const on = new Set(wanted);
    const config = Object.fromEntries(
      [...g.game.modules.keys()].map((id) => [id, on.has(id)]),
    );
    await g.game.settings.set("core", "moduleConfiguration", config);
  }, ids);
}

/** Launch, turn exactly the world's modules and the companion on, let it report. */
async function launchOnce(api: Api, w: DemoWorld): Promise<void> {
  console.log(`Launching ${w.title}`);
  await launchWorld(api, w.id);
  const browser = await chromium.launch();
  try {
    const gm = await joinAs(browser, env.url, "Gamemaster");
    await exactModules(gm, [...w.modules, "stagehand"]);
    await reloadWorld(gm);
    await waitFor(`${w.title}'s report`, 60_000, () =>
      Promise.resolve(reported(w)),
    );
  } finally {
    await browser.close();
  }
  await shutdownWorld(api, env.adminPassword);
}

async function main(): Promise<void> {
  const api = await createAdminClient(env.url);
  await shutdownWorld(api, env.adminPassword);
  await loginAsAdmin(api, env.adminPassword, join(env.dataDir, "Config"));
  await install(api);
  await createWorlds(api);
  for (const w of DEMO_WORLDS) if (!reported(w)) await launchOnce(api, w);
  mkdirSync(join(DATA, "stagehand"), { recursive: true });
  writeFileSync(join(DATA, "stagehand", "library.json"), DEMO_LIBRARY());
  await api.dispose();
  console.log("Demo ready: open Setup with Stagehand on this server.");
}

await main();
