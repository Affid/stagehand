// Runs in the Setup page's own JavaScript world: reads package data from
// `game` (V-1) and posts it to the isolated content script. Reads package
// data and the UI language only: never game.data.options, licence or
// certificate (8.6).
import { toPackageInfo } from "@module-library/shared/package";
import { makeEnvelope } from "@module-library/shared/protocol";
import type { SetupData, WorldInfo } from "@module-library/shared/world";

interface Collection {
  values(): Iterable<unknown>;
}

interface SetupGame {
  readonly view?: string;
  readonly release?: { readonly generation: number; readonly build: number };
  readonly data?: { readonly isAdmin?: boolean };
  readonly i18n?: { readonly lang?: string };
  readonly modules?: Collection;
  readonly worlds?: Collection;
  readonly systems?: Collection;
}

interface PageGlobals {
  readonly game?: SetupGame;
  readonly Hooks?: { on(name: string, fn: () => void): number };
  readonly ui?: { readonly setupPackages?: unknown };
}

const page = globalThis as unknown as PageGlobals;
const POLL_MS = 100;
const MAX_POLLS = 300;

type Loose = Record<string, unknown>;
const str = (v: unknown): string => (typeof v === "string" ? v : "");
const all = (c?: Collection): Loose[] => [...(c?.values() ?? [])] as Loose[];

const toWorld = (w: Loose): WorldInfo => {
  const lastPlayed = str(w.lastPlayed);
  return {
    id: str(w.id),
    title: str(w.title),
    system: str(w.system),
    systemVersion: str(w.systemVersion),
    coreVersion: str(w.coreVersion),
    ...(lastPlayed ? { lastPlayed } : {}),
  };
};

function collect(game: SetupGame): SetupData {
  const release = game.release ?? { generation: 0, build: 0 };
  return {
    core: {
      version: `${String(release.generation)}.${String(release.build)}`,
      generation: release.generation,
      build: release.build,
    },
    isAdmin: game.data?.isAdmin === true,
    lang: game.i18n?.lang ?? "",
    modules: all(game.modules).map(toPackageInfo),
    systems: all(game.systems).map((s) => ({
      id: str(s.id),
      title: str(s.title),
      version: str(s.version),
    })),
    worlds: all(game.worlds).map(toWorld),
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
