// Runs in the Setup page's own JavaScript world (Setup adapter, V14 spike).
// Reads package data from `game` and posts it to the isolated content script.
// Reads only package data: never game.data.options, licence or certificate.
import { makeEnvelope } from "@module-library/shared/protocol";
import type { SetupData, SetupModule, SetupWorld } from "./messages.ts";

interface Pkg {
  readonly id: string;
  readonly title: string;
  readonly version?: string | null;
  readonly authors?: Iterable<{ readonly name?: string }>;
  readonly library?: boolean;
  readonly compatibility?: { readonly verified?: string };
  readonly relationships?: {
    readonly requires?: Iterable<{
      readonly id: string;
      readonly type: string;
    }>;
    readonly conflicts?: Iterable<{
      readonly id: string;
      readonly type: string;
    }>;
  };
  readonly system?: string;
  readonly coreVersion?: string;
}

interface SetupGame {
  readonly view?: string;
  readonly release?: { readonly generation: number; readonly build: number };
  readonly data?: { readonly isAdmin?: boolean };
  readonly modules?: { values(): Iterable<Pkg> };
  readonly worlds?: { values(): Iterable<Pkg> };
}

interface PageGlobals {
  readonly game?: SetupGame;
  readonly Hooks?: { on(name: string, fn: () => void): number };
  readonly ui?: { readonly setupPackages?: unknown };
}

const page = globalThis as unknown as PageGlobals;
const POLL_MS = 100;
const MAX_POLLS = 300;

const moduleIds = (rels?: Iterable<{ id: string; type: string }>): string[] =>
  [...(rels ?? [])].filter((r) => r.type === "module").map((r) => r.id);

const toModule = (m: Pkg): SetupModule => ({
  id: m.id,
  title: m.title,
  version: m.version ?? "",
  authors: [...(m.authors ?? [])].map((a) => a.name ?? ""),
  library: m.library === true,
  requires: moduleIds(m.relationships?.requires),
  conflicts: moduleIds(m.relationships?.conflicts),
  verified: m.compatibility?.verified ?? "",
});

const toWorld = (w: Pkg): SetupWorld => ({
  id: w.id,
  title: w.title,
  system: w.system ?? "",
  coreVersion: w.coreVersion ?? "",
});

function collect(game: SetupGame): SetupData {
  const release = game.release ?? { generation: 0, build: 0 };
  return {
    coreVersion: `${release.generation}.${release.build}`,
    generation: release.generation,
    isAdmin: game.data?.isAdmin === true,
    modules: [...(game.modules?.values() ?? [])].map(toModule),
    worlds: [...(game.worlds?.values() ?? [])].map(toWorld),
  };
}

function post(): void {
  if (!page.game) return;
  const msg = makeEnvelope("setup-main", "SETUP_DATA", collect(page.game));
  window.postMessage(msg, location.origin);
}

function start(polls = 0): void {
  if (page.game?.view === "setup" && page.ui?.setupPackages) {
    post();
    page.Hooks?.on("renderSetupPackages", post);
    return;
  }
  if (polls < MAX_POLLS)
    setTimeout(() => {
      start(polls + 1);
    }, POLL_MS);
}

start();
