// The server's backups through Foundry's public calls (docs/SETUP-SPIKE.md):
// listBackups for everything, and createSnapshot, restoreSnapshot and
// deleteSnapshots with Foundry's own dialogs, locks and progress messages.
import type { PackageType } from "../page-backups.ts";
import type {
  PackageBackups,
  ServerBackupsRequest,
  ServerListing,
  SnapshotInfo,
} from "../page-server-backups.ts";
import { type Raw, toInfo } from "./backups.ts";
import type { PageGlobals } from "./globals.ts";

interface SnapshotGame {
  listBackups?: () => Promise<unknown>;
  createSnapshot?: (o: { dialog: boolean }) => Promise<unknown>;
  restoreSnapshot?: (data: unknown, o: { dialog: boolean }) => Promise<unknown>;
  deleteSnapshots?: (
    ids: readonly string[],
    o: { dialog: boolean },
  ) => Promise<unknown>;
}

type Game = NonNullable<PageGlobals["game"]> & SnapshotGame;
type Listing = Partial<Record<PackageType, Record<string, Raw[]>>> & {
  snapshots?: Record<string, Raw>;
};

export interface ServerBackupsResult {
  readonly listing?: ServerListing;
  readonly error?: string;
}

/** What SERVER_BACKUPS_DONE accepts: the answer must never be dropped. */
const MAX_SNAPSHOTS = 500;
const MAX_PACKAGES = 5000;
const MAX_BACKUPS = 1000;
const TYPES: readonly PackageType[] = ["world", "module", "system"];

const count = (v: unknown): number =>
  typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : 0;
const text = (v: unknown, max: number): string =>
  typeof v === "string" ? v.slice(0, max) : "";

function snapshotInfo(s: Raw): SnapshotInfo {
  const backups = s.backups;
  const n = Array.isArray(backups)
    ? backups.length
    : backups instanceof Set
      ? backups.size
      : 0;
  const note = text(s.note, 1000);
  return {
    id: text(s.id, 300) || "?",
    createdAt: count(s.createdAt),
    size: count(s.size),
    generation: count(s.generation),
    build: count(s.build),
    count: n,
    ...(note ? { note } : {}),
  };
}

function collection(game: Game, type: PackageType) {
  return type === "module"
    ? game.modules
    : type === "system"
      ? game.systems
      : game.worlds;
}

function packagesOf(game: Game, listing: Listing): PackageBackups[] {
  return TYPES.flatMap((type) =>
    Object.entries(listing[type] ?? {}).map(([id, list]) => ({
      type,
      id: id.slice(0, 300),
      title: text(list[0]?.title, 300) || id.slice(0, 300),
      installed: collection(game, type)?.get?.(id) !== undefined,
      backups: list.map(toInfo).slice(0, MAX_BACKUPS),
    })),
  ).slice(0, MAX_PACKAGES);
}

async function apply(game: Game, req: ServerBackupsRequest): Promise<void> {
  if (req.op === "createSnapshot")
    await game.createSnapshot?.({ dialog: true });
  if (req.op === "restoreSnapshot") {
    const listing = ((await game.listBackups?.()) ?? {}) as Listing;
    const id = req.ids[0] ?? "";
    // Own keys only: "__proto__" or "toString" are not snapshots.
    const snaps = listing.snapshots ?? {};
    const data = Object.hasOwn(snaps, id) ? snaps[id] : undefined;
    if (!data) throw new Error(`No snapshot ${req.ids[0] ?? ""}`);
    await game.restoreSnapshot?.(data, { dialog: true });
  }
  if (req.op === "deleteSnapshots") {
    // Foundry deletes from its own cached listing: list first.
    await game.listBackups?.();
    await game.deleteSnapshots?.(req.ids, { dialog: true });
  }
}

export async function runServerBackups(
  page: Pick<PageGlobals, "game">,
  req: ServerBackupsRequest,
): Promise<ServerBackupsResult> {
  const game = page.game as Game | undefined;
  if (!game?.listBackups)
    return { error: "Foundry's backups are not available" };
  try {
    await apply(game, req);
    const listing = ((await game.listBackups()) ?? {}) as Listing;
    return {
      listing: {
        snapshots: Object.values(listing.snapshots ?? {})
          .map(snapshotInfo)
          .sort((a, b) => b.createdAt - a.createdAt)
          .slice(0, MAX_SNAPSHOTS),
        packages: packagesOf(game, listing),
      },
    };
  } catch (e: unknown) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}
