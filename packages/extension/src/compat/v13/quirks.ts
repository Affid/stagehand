// Foundry 13's differences from 14 (docs/FOUNDRY-13-PLAN.md), checked in
// 13.351's code. Imported only by compat/quirks.ts.
import type { BackupLister, Quirks } from "../quirks.ts";
import { quitAtOnce } from "./quit.ts";

interface BackupEntry {
  readonly id?: unknown;
}

/**
 * Backup ids end in their start time, `world.<id>.<date>.<ms>`, taken from
 * the browser's clock (13's createBackup builds the id in the page, as our
 * `since` is), so the two compare.
 */
const startedAt = (backupId: string): number =>
  Number(backupId.slice(backupId.lastIndexOf(".") + 1));

/**
 * 13's createBackup answers nothing, done or failed (foundry.mjs
 * 13:177344), so the backup counts as done when Foundry lists one of this
 * world started since we asked.
 */
async function backupFinished(
  game: BackupLister,
  _result: unknown,
  id: string,
  since: number,
): Promise<boolean> {
  const listing = (await game.listBackups?.()) as
    { world?: Record<string, readonly BackupEntry[]> } | null | undefined;
  return (listing?.world?.[id] ?? []).some(
    (b) => typeof b.id === "string" && startedAt(b.id) >= since,
  );
}

export const V13_QUIRKS: Partial<Quirks> = {
  backupFinished,
  // 13's Setup menu has no Shut down; /quit stops at once, answers
  // "failed" whatever happens and has no quit page (13 quit.mjs).
  menuShutdown: false,
  quitAtOnce,
  editModuleIcon: ".fa-pen-to-square",
  // 13 opens its WorldConfig inside Setup (13 #createWorld).
  createWorldWindow: "world-config",
  // 13's settings model has neither (14 common/config.mjs 38, 55).
  missingSettings: ["adminUsername", "unixSocket"],
};
