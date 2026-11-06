// Foundry's own update, as its /update screen runs it (foundry.mjs,
// SetupUpdate#onSubmit): "updateCheck" and "updateDownload" are posted to the
// /update route, and the download's progress arrives through
// game._addProgressListener as action "updateDownload", id "updateCore". We
// pass each tick to ui.setupPackages.onProgress as Foundry's ProgressReceiver
// does, so our page shows it (progress.ts). A snapshot first goes through
// game.createSnapshot; if it fails, nothing is installed.
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
  const body = (await response.json()) as unknown;
  if (typeof body !== "object" || body === null)
    throw new Error("Foundry's update answer was not readable");
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
  return release
    ? { release }
    : { error: "Foundry's release was not readable" };
}

/** Resolves when Foundry's progress for `action` ends: with its error, if any. */
function whenDone(
  page: Page,
  matches: (data: Raw) => boolean,
  forward: boolean,
): { done: Promise<string | undefined>; stop: () => void } {
  const game = gameOf(page);
  const sp = page.ui?.setupPackages as SetupPackagesLike | undefined;
  let listener: Listener = () => undefined;
  const done = new Promise<string | undefined>((resolve) => {
    listener = (data) => {
      if (!matches(data)) return;
      if (forward) sp?.onProgress?.(data);
      if (data.step === "complete") resolve(undefined);
      else if (data.step === "error")
        resolve(str(data.error, MAX_ERROR) || "Foundry's update failed");
    };
    game?._addProgressListener?.(listener);
  });
  const stop = (): void => {
    game?._removeProgressListener?.(listener);
  };
  return { done, stop };
}

/** game.createSnapshot without its dialog; an error stops the update. */
async function snapshotFirst(
  page: Page,
  note: string,
): Promise<string | undefined> {
  const game = gameOf(page);
  if (!game?.createSnapshot) return "Foundry's snapshots are not available";
  let failed: string | undefined;
  const { done, stop } = whenDone(
    page,
    (d) => d.action === "createSnapshot" || d.action === "createBackup",
    false,
  );
  void done.then((e) => {
    failed ??= e;
  });
  try {
    await game.createSnapshot({ note, dialog: false });
  } finally {
    stop();
  }
  return failed;
}

async function download(page: Page, req: UpdateRequest): Promise<UpdateResult> {
  if (req.snapshot) {
    const note = `Before updating to ${req.version ?? req.channel}`;
    const error = await snapshotFirst(page, note);
    if (error) return { error };
  }
  const sp = page.ui?.setupPackages as SetupPackagesLike | undefined;
  const { done, stop } = whenDone(
    page,
    (d) => d.action === "updateDownload" && d.id === "updateCore",
    true,
  );
  sp?.toggleLock?.(true, { message: UPDATING });
  try {
    // A warning only informs, as in Foundry's ProgressReceiver; the ticks decide.
    await postUpdate(page, {
      action: "updateDownload",
      updateChannel: req.channel,
      forceUpdate: req.force,
    });
    const error = await done;
    return error ? { error } : { installed: true };
  } finally {
    stop();
    sp?.toggleLock?.(false);
  }
}

export async function runUpdate(
  page: Page,
  req: UpdateRequest,
): Promise<UpdateResult> {
  try {
    return req.op === "check"
      ? await check(page, req)
      : await download(page, req);
  } catch (e: unknown) {
    return {
      error: (e instanceof Error ? e.message : String(e)).slice(0, MAX_ERROR),
    };
  }
}
