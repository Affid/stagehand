// The server's backups, listed when the page opens and after each change.
import { useEffect, useState } from "preact/hooks";
import type { BackupOp } from "../../../../page-backups.ts";
import type {
  PackageBackups,
  ServerBackupOp,
  ServerListing,
} from "../../../../page-server-backups.ts";
import { useUi } from "../../../context.ts";

export interface View {
  readonly listing?: ServerListing;
  readonly error?: string;
}

export function useServerBackups() {
  const { page, state } = useUi();
  const a = state.adapter;
  // Free space comes from an internal Foundry request: behind its flag.
  const disk = a.status !== "safe-mode" && a.adapter.flags.diskFree === true;
  const [view, setView] = useState<View>({});
  const [running, setRunning] = useState(0);
  const settle = (r: View): void => {
    setView((v) => {
      // Only a list asks for free space: keep the last one known.
      const free = r.listing?.free ?? v.listing?.free;
      const next = r.listing ?? v.listing;
      const listing = next && free !== undefined ? { ...next, free } : next;
      return {
        ...(listing ? { listing } : {}),
        ...(r.error ? { error: r.error } : {}),
      };
    });
  };
  const list = () => page.serverBackups("list", [], disk);
  const busy = async (work: () => Promise<View>): Promise<void> => {
    setRunning((n) => n + 1);
    settle(
      await work().finally(() => {
        setRunning((n) => n - 1);
      }),
    );
  };
  const run = (op: ServerBackupOp, ids: readonly string[] = []) =>
    busy(() => (op === "list" ? list() : page.serverBackups(op, ids)));
  /** Our dialog's snapshot: its note, without Foundry's dialog. */
  const createSnapshot = (note: string) =>
    busy(() => page.serverBackups("createSnapshot", [], false, note));
  /** The space a snapshot needs and has, behind the same flag as free space. */
  const askSpace = async () =>
    disk ? (await page.serverBackups("space", [], false)).space : undefined;
  /** A package's backup, then the whole listing again. */
  const runPackage = (
    p: PackageBackups,
    op: BackupOp,
    ids: readonly string[],
  ) =>
    busy(async () => {
      const r = await page.backups(p.id, op, ids, p.type);
      // The operation's error stays visible after the list comes back.
      return { ...(await list()), ...(r.error ? { error: r.error } : {}) };
    });
  useEffect(() => {
    void run("list");
  }, []);
  return {
    view,
    busy: running > 0,
    run,
    runPackage,
    createSnapshot,
    askSpace,
  };
}

export type ServerBackups = ReturnType<typeof useServerBackups>;
