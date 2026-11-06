// Foundry's own update, as its /update screen runs it (foundry.mjs,
// SetupUpdate#onSubmit): "updateCheck" and "updateDownload" are posted to the
// /update route, and the download's progress arrives through
// game._addProgressListener as action "updateDownload", id "updateCore". We
// pass each tick to ui.setupPackages.onProgress as Foundry's ProgressReceiver
// does, so our page shows it (progress.ts). A snapshot first goes through
// game.createSnapshot; if it fails, nothing is installed.
import { type Preview, readPreview } from "../page-compat.ts";
import type { Release, UpdateRequest } from "../page-update.ts";
import type { PageGlobals } from "./globals.ts";

type Raw = Record<string, unknown>;
type Listener = (data: Raw) => void;

interface UpdateGame {
  readonly data?: { readonly options?: Raw };
  readonly i18n?: {
    readonly localize?: (key: string) => string;
    readonly format?: (key: string, data: Raw) => string;
  };
  readonly createSnapshot?: (o: {
    note?: string;
    dialog?: boolean;
  }) => Promise<unknown>;
  readonly _addProgressListener?: (fn: Listener) => void;
  readonly _removeProgressListener?: (fn: Listener) => void;
}

interface SetupPackagesLike {
  onProgress?: (data: Raw) => unknown;
  toggleLock?: (locked: boolean, options?: { message?: string }) => unknown;
}

export interface UpdateResult {
  readonly release?: Release;
  readonly info?: string;
  readonly installed?: boolean;
  readonly preview?: Preview;
  readonly error?: string;
}

type Page = Pick<PageGlobals, "game" | "ui" | "foundry">;

const MAX_NOTES = 400_000;
const MAX_TEXT = 200;
const MAX_ERROR = 2000;
/** Foundry's lock message while it updates (tasks.ts words it). */
export const UPDATING = "SETUP.UpdateDownloading";

const gameOf = (page: Page): UpdateGame | undefined => page.game;

const text = (page: Page, key: string): string =>
  gameOf(page)?.i18n?.localize?.(key) ?? key;

const str = (v: unknown, max: number): string =>
  typeof v === "string" ? v.slice(0, max) : "";

const count = (v: unknown): number =>
  typeof v === "number" && Number.isInteger(v) && v >= 0 ? v : 0;

/** POST to Foundry's /update route, as game.post does for its own view. */
async function postUpdate(page: Page, data: Raw): Promise<Raw> {
  const url = page.foundry?.utils?.getRoute?.("update") ?? "/update";
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  // Foundry sends a signed-out admin to its sign-in page.
  if (response.redirected) throw new Error("Foundry asked to sign in again.");
  // A proxy's error page is not JSON: say so, not "Unexpected token <" (review).
  const body = (await response.json().catch(() => null)) as unknown;
  if (typeof body !== "object" || body === null)
    throw new Error(
      `Foundry's update answer was not readable (HTTP ${String(response.status)})`,
    );
  const answer = body as Raw;
  if (typeof answer.error === "string")
    throw new Error(text(page, answer.error).slice(0, MAX_ERROR));
  return answer;
}

/** Foundry's flags for a release that must be installed by hand. */
const REINSTALL = [
  "requires_generation_reinstall",
  "requires_electron_reinstall",
  "requires_full_reinstall",
];

/** The parts of Foundry's ReleaseData the page shows; never its download link. */
export function releaseOf(raw: Raw): Release | undefined {
  const generation = count(raw.generation);
  const build = count(raw.build);
  if (!generation || !build) return undefined;
  const flags = (raw.flags ?? {}) as Raw;
  return {
    version: `${String(generation)}.${String(build)}`,
    generation,
    build,
    channel: str(raw.channel, MAX_TEXT),
    suffix: str(raw.suffix, MAX_TEXT),
    time: count(raw.time),
    notes: str(raw.notes, MAX_NOTES),
    // As ReleaseData#requiresManualInstall.
    manual: REINSTALL.some((k) => Boolean(flags[k])),
  };
}

const I18N_KEY = /^[A-Za-z0-9_.]{1,200}$/;

/**
 * The release Foundry's last check found, as Foundry sent it: its
 * compatibility preview takes the whole release back. Never sent to the UI.
 */
let checked: Raw | undefined;
/** Foundry's preview takes seconds; one per release is enough. */
const previews = new Map<string, Preview>();

async function check(page: Page, req: UpdateRequest): Promise<UpdateResult> {
  const answer = await postUpdate(page, {
    action: "updateCheck",
    updateChannel: req.channel,
    forceUpdate: req.force,
  });
  const info = answer.info ?? answer.warn;
  if (typeof info === "string")
    return { info: I18N_KEY.test(info) ? info : "SETUP.UpdateNotAvailable" };
  const release = releaseOf(answer);
  if (!release) return { error: "Foundry's release was not readable" };
  checked = answer;
  return { release };
}

/** No tick from Foundry's download for this long: it has stopped (review). */
export const STALL_MS = 5 * 60 * 1000;

/**
 * Foundry's ticks for the download, passed on to our progress; resolves on
 * its complete or error tick, or when no tick came for STALL_MS, so a
 * stalled download can't hold Setup's lock for good.
 */
function watchDownload(page: Page): {
  ended: Promise<string | undefined>;
  stop: () => void;
} {
  const game = gameOf(page);
  const sp = page.ui?.setupPackages as SetupPackagesLike | undefined;
  let listener: Listener = () => undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const ended = new Promise<string | undefined>((resolve) => {
    const stall = (): void => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        resolve(
          "Foundry's update stopped answering. Check Foundry before trying again.",
        );
      }, STALL_MS);
    };
    listener = (data) => {
      if (data.action !== "updateDownload" || data.id !== "updateCore") return;
      sp?.onProgress?.(data);
      stall();
      if (data.step === "complete") resolve(undefined);
      else if (data.step === "error")
        resolve(str(data.error, MAX_ERROR) || "Foundry's update failed");
    };
    stall();
    game?._addProgressListener?.(listener);
  });
  const stop = (): void => {
    clearTimeout(timer);
    game?._removeProgressListener?.(listener);
  };
  return { ended, stop };
}

/**
 * game.createSnapshot without its dialog. Only Foundry's own complete tick
 * for the snapshot counts as taken; any error, of the snapshot or of one
 * package's backup, or no answer at all, stops the update (review).
 */
async function snapshotFirst(
  page: Page,
  note: string,
): Promise<string | undefined> {
  const game = gameOf(page);
  if (!game?.createSnapshot) return "Foundry's snapshots are not available";
  // What Foundry's ticks said; the listener fills it in.
  const seen: { error?: string; taken?: boolean } = {};
  const listener: Listener = (d) => {
    if (d.action !== "createSnapshot" && d.action !== "createBackup") return;
    if (d.step === "error")
      seen.error ??= str(d.error, MAX_ERROR) || "Foundry's snapshot failed";
    else if (d.step === "complete" && d.action === "createSnapshot")
      seen.taken = true;
  };
  game._addProgressListener?.(listener);
  try {
    await game.createSnapshot({ note, dialog: false });
  } finally {
    game._removeProgressListener?.(listener);
  }
  if (seen.error) return seen.error;
  return seen.taken ? undefined : "Foundry didn't confirm the snapshot.";
}

async function install(page: Page, req: UpdateRequest): Promise<UpdateResult> {
  const sp = page.ui?.setupPackages as SetupPackagesLike | undefined;
  const { ended, stop } = watchDownload(page);
  sp?.toggleLock?.(true, { message: UPDATING });
  try {
    // A warning only informs, as in Foundry's ProgressReceiver; the ticks decide.
    await postUpdate(page, {
      action: "updateDownload",
      updateChannel: req.channel,
      forceUpdate: req.force,
    });
    const error = await ended;
    return error ? { error } : { installed: true };
  } finally {
    stop();
    sp?.toggleLock?.(false);
  }
}

/** One update at a time, whatever the UI asks (review). */
let downloading = false;

async function download(page: Page, req: UpdateRequest): Promise<UpdateResult> {
  if (downloading) return { error: "Foundry is already updating." };
  // Only the release the page showed: a newer one found since needs a new look.
  if (!checked || releaseOf(checked)?.version !== req.version)
    return { error: "Check for the update again first." };
  downloading = true;
  try {
    if (req.snapshot) {
      const error = await snapshotFirst(
        page,
        `Before updating to ${req.version}`,
      );
      if (error) return { error: `${error} Nothing was installed.` };
    }
    return await install(page, req);
  } finally {
    downloading = false;
  }
}

/** As Foundry's Compatibility Checker: "previewCompatibility" for the checked release. */
async function preview(page: Page, req: UpdateRequest): Promise<UpdateResult> {
  const version = req.version ?? "";
  const known = previews.get(version);
  if (known) return { preview: known };
  if (!checked || releaseOf(checked)?.version !== version)
    return { error: "Check for the update again first." };
  const answer = await postUpdate(page, {
    action: "previewCompatibility",
    release: checked,
  });
  const read = readPreview(answer);
  if (!read)
    return { error: "Foundry's compatibility preview was not readable" };
  previews.set(version, read);
  return { preview: read };
}

const OPS = { check, download, preview } as const;

export async function runUpdate(
  page: Page,
  req: UpdateRequest,
): Promise<UpdateResult> {
  try {
    return await OPS[req.op](page, req);
  } catch (e: unknown) {
    return {
      error: (e instanceof Error ? e.message : String(e)).slice(0, MAX_ERROR),
    };
  }
}
