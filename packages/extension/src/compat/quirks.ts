// Where Foundry versions differ, for the few places our code cares
// (docs/FOUNDRY-13-PLAN.md). Our code is written for Foundry 14 and asks
// here only where 13 behaves differently. Everything 13-only lives in
// compat/v13/, and only this file and the bundled adapter config may import
// it (eslint no-restricted-imports), so dropping 13 means deleting that
// folder, the two imports and the v13 adapter entry.
import type { SettingKey } from "../page-config.ts";
import { closeWorldByJoin } from "./v13/close-world.ts";
import type { QuitDeps } from "./v13/quit.ts";
import { V13_QUIRKS } from "./v13/quirks.ts";

export type QuitAtOnce = (
  deps: QuitDeps,
  stopped: () => void,
) => Promise<string | undefined>;

/** Foundry's backup listing, as `game.listBackups` answers it. */
export interface BackupLister {
  listBackups?: () => Promise<unknown>;
}

export interface Quirks {
  /**
   * After `game.createBackup` (no dialog) answered `result`: did a backup
   * of world `id` started at `since` (ms) finish?
   */
  readonly backupFinished: (
    game: BackupLister,
    result: unknown,
    id: string,
    since: number,
  ) => Promise<boolean>;
  /** Setup's menu has Shut down, with Foundry's confirm and its quit page. */
  readonly menuShutdown: boolean;
  /**
   * Where Foundry's /quit stops at once with no quit page (13): our own
   * quit, telling `stopped` once the server is down. Null: Foundry's
   * deferred quit and its quit page.
   */
  readonly quitAtOnce: QuitAtOnce | null;
  /** Edit Module's item in Foundry's package context menu (its icon). */
  readonly editModuleIcon: string;
  /** The window Create World opens inside Setup; null when it leaves Setup. */
  readonly createWorldWindow: string | null;
  /** Server settings this Foundry doesn't have: not shown, never sent. */
  readonly missingSettings: readonly SettingKey[];
}

/** Foundry 14, which our code is written for. */
const V14: Quirks = {
  backupFinished: (_game, result) => Promise.resolve(result === true),
  menuShutdown: true,
  quitAtOnce: null,
  editModuleIcon: ".fa-edit",
  createWorldWindow: null,
  missingSettings: [],
};

/** The differences for a core generation (14's behaviour by default). */
export function quirksFor(generation: number | undefined): Quirks {
  return generation === 13 ? { ...V14, ...V13_QUIRKS } : V14;
}

/**
 * Closing a running world when Foundry refuses `worldShutdown` (13's join
 * page; the app can't tell the version while a world runs). Null when no
 * supported Foundry needs it.
 */
export const closeRefusedWorld: typeof closeWorldByJoin | null =
  closeWorldByJoin;
