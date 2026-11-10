// Fills the local Foundry with test worlds and stub modules, to see the new
// Setup page with many of both (build plan, Phase 6), and takes them away.
//   node scripts/foundry/many.ts add [worlds=30] [modules=120]
//   node scripts/foundry/many.ts remove
// Only ids starting with st-many- (worlds) and st-stub- (modules) are
// touched. Foundry must be running on Setup; no world may be running.
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import {
  createAdminClient,
  createWorld,
  hasActiveWorld,
  loginAsAdmin,
  setupPost,
} from "./admin.ts";
import { loadFoundryEnv } from "./env.ts";

const WORLD = "st-many-";
const STUB = "st-stub-";
const DAY = 24 * 60 * 60 * 1000;
const NAMES = [
  "Curse of the Sunken Crown",
  "Tomb of Annihilation",
  "One-shot",
  "The Long Road to Westmarch and the Seven Bells of Hollow Fen",
  "Sandbox",
  "Waterdeep: Dragon Heist",
];
const AREAS = ["Audio", "Maps", "Combat", "UI", "Lighting", "Dice"];

const env = loadFoundryEnv();
const data = join(env.dataDir, "Data");
const pad = (n: number): string => String(n).padStart(3, "0");

async function addWorlds(api: Parameters<typeof setupPost>[0], n: number) {
  for (let i = 1; i <= n; i++) {
    const id = `${WORLD}${pad(i)}`;
    const file = join(data, "worlds", id, "world.json");
    const title = `${NAMES[i % NAMES.length] ?? "World"} ${String(i)}`;
    await createWorld(api, { id, title, system: "dnd5e" }, file);
    // Played at spread-out times, a few never, for Foundry's order and the
    // grid's "played in the last 3 months".
    const world = JSON.parse(readFileSync(file, "utf8")) as Record<
      string,
      unknown
    >;
    const played =
      i % 5 === 0 ? null : new Date(Date.now() - i * 9 * DAY).toISOString();
    writeFileSync(
      file,
      JSON.stringify({ ...world, lastPlayed: played }, null, 2),
    );
  }
}

function addModules(n: number): void {
  for (let i = 1; i <= n; i++) {
    const id = `${STUB}${pad(i)}`;
    const dir = join(data, "modules", id);
    mkdirSync(dir, { recursive: true });
    const area = AREAS[i % AREAS.length] ?? "Misc";
    writeFileSync(
      join(dir, "module.json"),
      JSON.stringify(
        {
          id,
          title: `${area} stub ${String(i)}`,
          description: `A stub module for testing a busy Library (${area.toLowerCase()}).`,
          version: "1.0.0",
          authors: [{ name: `Author ${String(i % 7)}` }],
          compatibility: { minimum: "13", verified: i % 9 === 0 ? "12" : "14" },
        },
        null,
        2,
      ),
    );
  }
}

function ours(kind: "worlds" | "modules", prefix: string): string[] {
  const dir = join(data, kind);
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((d) => d.startsWith(prefix));
}

/** Logged in, on Setup with no world running; else it says why (review). */
async function adminOnSetup(api: Parameters<typeof setupPost>[0]) {
  const login = await loginAsAdmin(
    api,
    env.adminPassword,
    join(env.dataDir, "Config"),
  );
  if (login !== "logged-in")
    throw new Error("Foundry needs a restart to take its new admin password.");
  if (await hasActiveWorld(api))
    throw new Error("A world is running: shut it down first.");
}

function count(text: string, label: string): number {
  const n = Number(text);
  if (!Number.isInteger(n) || n < 0 || n > 500)
    throw new Error(`${label} must be a whole number from 0 to 500`);
  return n;
}

/** Adds the test worlds and stub modules; Foundry rereads its packages. */
export async function addMany(worlds = 30, modules = 120): Promise<void> {
  const api = await createAdminClient(env.url);
  try {
    await adminOnSetup(api);
    addModules(modules);
    await addWorlds(api, worlds);
    await setupPost(api, { action: "resetPackages" });
  } finally {
    await api.dispose();
  }
}

/**
 * Takes every test world and stub module away again. The folders go first,
 * so they go even when Foundry can't be told (review); a running world is
 * left alone.
 */
export async function removeMany(): Promise<void> {
  const api = await createAdminClient(env.url);
  try {
    if (await hasActiveWorld(api).catch(() => false))
      throw new Error("A world is running: shut it down first.");
    for (const id of ours("worlds", WORLD))
      rmSync(join(data, "worlds", id), { recursive: true, force: true });
    for (const id of ours("modules", STUB))
      rmSync(join(data, "modules", id), { recursive: true, force: true });
    await adminOnSetup(api);
    await setupPost(api, { action: "resetPackages" });
  } finally {
    await api.dispose();
  }
}

export const countMany = (): { worlds: number; modules: number } => ({
  worlds: ours("worlds", WORLD).length,
  modules: ours("modules", STUB).length,
});

if (import.meta.main) {
  const [cmd = "add", worlds = "30", modules = "120"] = process.argv.slice(2);
  if (cmd === "add")
    await addMany(count(worlds, "worlds"), count(modules, "modules"));
  else if (cmd === "remove") await removeMany();
  else throw new Error(`Unknown command ${cmd}: add or remove`);
  const n = countMany();
  console.log(
    `${cmd}: ${String(n.worlds)} test worlds, ${String(n.modules)} stub modules now`,
  );
}
