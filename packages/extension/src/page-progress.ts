// Foundry's own progress and busy lock, forwarded from the page world: it
// draws them inside its hidden layout (SETUP-SPIKE.md), so our page draws
// its own from ui.setupPackages.onProgress and toggleLock. Checked both ways.
type Loose = Readonly<Record<string, unknown>>;

/** Foundry's SETUP_PACKAGE_PROGRESS.ACTIONS we show. */
export const PROGRESS_ACTIONS = [
  "createBackup",
  "restoreBackup",
  "deleteBackup",
  "createSnapshot",
  "restoreSnapshot",
  "deleteSnapshot",
  "updateCore",
  "updateDownload",
  "installPackage",
  // A world's launch: our launching screen (ui/launching.ts), not a task.
  "launchWorld",
] as const;

export type ProgressAction = (typeof PROGRESS_ACTIONS)[number];

export interface Progress {
  readonly action: ProgressAction;
  /** Foundry's operation id: a backup's or snapshot's id, or the action. */
  readonly id: string;
  /** The package it is about, when there is one. */
  readonly packageId?: string;
  /** "world", "module", "system" or "snapshot". */
  readonly type?: string;
  readonly title?: string;
  /** 0 to 100, when Foundry gives one. */
  readonly pct?: number;
  /** Foundry's step: "complete", "vend" and "error" end it. */
  readonly step?: string;
  /** Foundry's reason, on its "error" step. */
  readonly error?: string;
}

export interface Lock {
  readonly locked: boolean;
  readonly message?: string;
}

const isText = (v: unknown, max: number): v is string =>
  typeof v === "string" && v.length > 0 && v.length <= max;

const ID = /^[A-Za-z0-9_.-]{1,300}$/;
const TYPES: ReadonlySet<unknown> = new Set([
  "world",
  "module",
  "system",
  "snapshot",
]);

/**
 * The package a tick is about. Foundry's last tick of a restore names only the
 * backup, whose id is `<type>.<packageId>.<date>.<ms>`.
 */
function packageOf(
  p: Loose,
  id: string,
): { packageId?: string; type?: string } {
  const [head, pkg] = id.split(".");
  const type = TYPES.has(p.type) ? p.type : TYPES.has(head) ? head : undefined;
  const packageId =
    typeof p.packageId === "string" && ID.test(p.packageId)
      ? p.packageId
      : type && type !== "snapshot" && pkg && ID.test(pkg)
        ? pkg
        : undefined;
  return {
    ...(typeof type === "string" ? { type } : {}),
    ...(packageId ? { packageId } : {}),
  };
}

export function parseProgress(p: Loose): Progress | undefined {
  const { action, id, title, pct, step, error } = p;
  if (!(PROGRESS_ACTIONS as readonly unknown[]).includes(action))
    return undefined;
  if (!isText(id, 300)) return undefined;
  const sound =
    typeof pct === "number" && Number.isFinite(pct) && pct >= 0 && pct <= 100;
  return {
    action: action as ProgressAction,
    id,
    ...packageOf(p, id),
    ...(isText(title, 300) ? { title } : {}),
    ...(sound ? { pct: Math.round(pct) } : {}),
    ...(isText(step, 40) ? { step } : {}),
    ...(step === "error" && isText(error, 500) ? { error } : {}),
  };
}

export function parseLock(p: Loose): Lock | undefined {
  if (typeof p.locked !== "boolean") return undefined;
  return isText(p.message, 500)
    ? { locked: p.locked, message: p.message }
    : { locked: p.locked };
}

/** Foundry's steps that end a task. */
export const ENDS: ReadonlySet<string> = new Set(["complete", "vend", "error"]);
