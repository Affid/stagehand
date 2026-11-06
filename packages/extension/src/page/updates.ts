// Which installed modules and systems have an update Foundry would install:
// its package list (one request per type, as its installer makes) against
// what is installed. Newer, and installable on this Foundry (availability 1
// to 6; 7 to 10 need another core).
import { logError } from "@module-library/shared/log";
import type { Updates } from "../page-updates.ts";
import type { PageGlobals } from "./globals.ts";

type Listed = Readonly<Record<string, unknown>>;

interface UpdateGame {
  getPackages?: (o: { type: string }) => Promise<ReadonlyMap<string, Listed>>;
}

const INSTALLABLE_MIN = 1;
const INSTALLABLE_MAX = 6;

type Newer = (a: string, b: string) => boolean;

function installed(page: Pick<PageGlobals, "game">, type: "module" | "system") {
  const c = type === "module" ? page.game?.modules : page.game?.systems;
  return [...(c?.values() ?? [])].map((p) => {
    const x = p as { readonly id?: unknown; readonly version?: unknown };
    return {
      id: typeof x.id === "string" ? x.id : "",
      version: typeof x.version === "string" ? x.version : "",
    };
  });
}

async function newerOf(
  page: Pick<PageGlobals, "game">,
  type: "module" | "system",
  newer: Newer,
): Promise<Record<string, string>> {
  const game = page.game as UpdateGame | undefined;
  const listed = await game?.getPackages?.({ type });
  if (!listed) return {};
  const out: [string, string][] = [];
  for (const p of installed(page, type)) {
    const remote = listed.get(p.id);
    const version = typeof remote?.version === "string" ? remote.version : "";
    const a = Number(remote?.availability);
    if (!version || !newer(version, p.version)) continue;
    if (!Number.isFinite(a) || a < INSTALLABLE_MIN || a > INSTALLABLE_MAX)
      continue;
    out.push([p.id, version]);
  }
  return Object.fromEntries(out);
}

export async function checkUpdates(
  page: Pick<PageGlobals, "game" | "foundry">,
): Promise<Updates | undefined> {
  const newer = page.foundry?.utils?.isNewerVersion;
  if (!newer) return undefined;
  try {
    const [module, system] = await Promise.all([
      newerOf(page, "module", newer),
      newerOf(page, "system", newer),
    ]);
    return { module, system };
  } catch (e: unknown) {
    // Foundry couldn't reach its package list: no update marks this time.
    logError("update check", e);
    return undefined;
  }
}
