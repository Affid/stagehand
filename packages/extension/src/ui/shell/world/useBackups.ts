// A world's backups, listed once when its page opens: the Backups tab, the
// tab's count and the launch review's "latest backup" share this list.
import { useEffect, useState } from "preact/hooks";
import type { BackupInfo, BackupOp } from "../../../page-backups.ts";
import { useUi } from "../../context.ts";

export interface View {
  /** Undefined until the first list arrives. */
  readonly list?: readonly BackupInfo[];
  readonly error?: string;
}

export function useBackups(worldId: string) {
  const { page } = useUi();
  const [view, setView] = useState<View>({});
  const [busy, setBusy] = useState(false);
  const run = async (
    op: BackupOp,
    ids: readonly string[] = [],
  ): Promise<void> => {
    setBusy(true);
    const r = await page.backups(worldId, op, ids);
    setBusy(false);
    // A failure keeps the last list on screen, with the error above it.
    setView((v) => {
      const list = r.backups ?? v.list;
      return {
        ...(list ? { list } : {}),
        ...(r.error ? { error: r.error } : {}),
      };
    });
  };
  useEffect(() => {
    void run("list");
    // A new world gets a fresh list.
  }, [worldId]);
  return { view, busy, run };
}

export type WorldBackups = ReturnType<typeof useBackups>;

/** The newest backup, if any. */
export const latestBackup = (
  list: readonly BackupInfo[] | undefined,
): BackupInfo | undefined =>
  list?.reduce<BackupInfo | undefined>(
    (best, b) => (!best || b.createdAt > best.createdAt ? b : best),
    undefined,
  );
