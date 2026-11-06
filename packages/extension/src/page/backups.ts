// A world's backups through Foundry's public calls (docs/SETUP-SPIKE.md):
// listBackups, createBackup, restoreBackup and deleteBackups, each with
// Foundry's own dialog (a confirm code for restore and delete) and its own
// lock and progress messages. Answers with the world's current backups.
import type { BackupInfo, BackupsRequest } from "../page-backups.ts";
import type { PageGlobals } from "./globals.ts";

type Raw = Readonly<Record<string, unknown>>;

interface BackupGame {
  listBackups?: () => Promise<unknown>;
  createBackup?: (pkg: unknown, o: { dialog: boolean }) => Promise<unknown>;
  restoreBackup?: (data: unknown, o: { dialog: boolean }) => Promise<unknown>;
  deleteBackups?: (
    pkg: unknown,
    ids: readonly string[],
    o: { dialog: boolean },
  ) => Promise<unknown>;
}

export type BackupGlobals = Pick<PageGlobals, "game">;

export interface BackupsResult {
  readonly backups?: readonly BackupInfo[];
  readonly error?: string;
}

const message = (e: unknown): string =>
  e instanceof Error ? e.message : String(e);

function time(v: unknown): number {
  if (typeof v === "number") return v;
  const t = Date.parse(typeof v === "string" ? v : "");
  return Number.isFinite(t) ? t : 0;
}

const toInfo = (b: Raw): BackupInfo => ({
  id: String(b.id),
  createdAt: time(b.createdAt),
  size: typeof b.size === "number" && b.size >= 0 ? b.size : 0,
  snapshot: typeof b.snapshotId === "string" && b.snapshotId !== "",
  ...(typeof b.note === "string" && b.note
    ? { note: b.note.slice(0, 1000) }
    : {}),
});

async function listRaw(game: BackupGame, worldId: string): Promise<Raw[]> {
  const listing = (await game.listBackups?.()) as
    { world?: Record<string, Raw[]> } | null | undefined;
  return listing?.world?.[worldId] ?? [];
}

async function apply(
  game: BackupGame,
  world: unknown,
  req: BackupsRequest,
): Promise<void> {
  if (req.op === "create") await game.createBackup?.(world, { dialog: true });
  if (req.op === "restore") {
    const data = (await listRaw(game, req.worldId)).find(
      (b) => b.id === req.ids[0],
    );
    if (!data) throw new Error(`No backup ${req.ids[0] ?? ""}`);
    await game.restoreBackup?.(data, { dialog: true });
  }
  if (req.op === "delete") {
    // Foundry deletes from its own cached listing: list first.
    await listRaw(game, req.worldId);
    await game.deleteBackups?.(world, req.ids, { dialog: true });
  }
}

export async function runBackups(
  page: BackupGlobals,
  req: BackupsRequest,
): Promise<BackupsResult> {
  const game = page.game as (BackupGlobals["game"] & BackupGame) | undefined;
  const world = game?.worlds?.get?.(req.worldId);
  if (!game || !world) return { error: `No world ${req.worldId}` };
  try {
    await apply(game, world, req);
    const backups = (await listRaw(game, req.worldId)).map(toInfo);
    return { backups: [...backups].sort((a, b) => b.createdAt - a.createdAt) };
  } catch (e: unknown) {
    return { error: message(e) };
  }
}
