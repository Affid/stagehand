// Foundry's half of the Setup page, in the page's own JavaScript world.
// Sends package data to our UI (V-1) and lends it Foundry's own pieces: its
// actions, dialogs, editor, progress and notifications. Every message from
// the UI is checked; anything unexpected is ignored. Started by the
// extension's setup-main script and by the app's app-setup script, each
// with its own channel (page-channel.ts).
import { logError } from "@module-library/shared/log";
import type { PageChannel } from "../page-channel.ts";
import {
  type PageToUi,
  parseUiToPage,
  type UiToPage,
} from "../page-protocol.ts";
import type { BackupsRequest } from "../page-backups.ts";
import type { SaveWorld } from "../page-save.ts";
import type { ConfigRequest } from "../page-config.ts";
import type { UpdateRequest } from "../page-update.ts";
import type { ServerBackupsRequest } from "../page-server-backups.ts";
import type { Updates } from "../page-updates.ts";
import { runFoundryAction } from "./actions.ts";
import { runBackups } from "./backups.ts";
import { runServerBackups } from "./server-backups.ts";
import { runConfig } from "./config.ts";
import { runUpdate } from "./update.ts";
import { closeEditor, openEditor, saveFromEditor } from "./editor.ts";
import { saveWorld } from "./save-world.ts";
import { collect } from "./collect.ts";
import { watchProgress } from "./progress.ts";
import { checkUpdates } from "./updates.ts";
import type { PageGlobals } from "./globals.ts";
import { setShell } from "./shell.ts";

export interface SetupMainDeps {
  readonly channel: PageChannel;
  readonly page: PageGlobals;
  readonly doc: Document;
}

const POLL_MS = 100;
const MAX_POLLS = 300;
/** SAVE_DONE's limit for an error message. */
const MAX_ERROR = 2000;

/** The started page world. */
interface Ctx extends SetupMainDeps {
  readonly postToUi: (m: PageToUi) => void;
  readonly notify: (kind: "info" | "warning" | "error", text: string) => void;
  /** Foundry's package list, asked once per Setup load however often (review). */
  updates?: Promise<Updates | undefined>;
}

const clipError = (error: string): string => error.slice(0, MAX_ERROR);

/** Runs inside Foundry's render hook: never throws into Foundry. */
function postSetupData(ctx: Ctx): void {
  try {
    if (ctx.page.game) ctx.channel.send("SETUP_DATA", collect(ctx.page.game));
  } catch (error: unknown) {
    logError("setup data", error);
  }
}

/** Foundry's toast; it renders HTML, so our text is escaped first. */
function notifier(page: PageGlobals): Ctx["notify"] {
  return (kind, text) => {
    const safe = page.foundry?.utils?.escapeHTML?.(text);
    const n = page.ui?.notifications;
    const level = kind === "warning" ? "warn" : kind;
    if (safe !== undefined && n?.[level]) n[level](safe, { console: false });
    else logError("notice", new Error(text));
  };
}

/** Runs a backups request and answers with its id. */
function answerBackups(ctx: Ctx, req: BackupsRequest): void {
  void runBackups(ctx.page, req).then((r) => {
    ctx.postToUi({
      type: "BACKUPS_DONE",
      payload: {
        requestId: req.requestId,
        ...(r.backups ? { backups: r.backups } : {}),
        ...(r.error ? { error: clipError(r.error) } : {}),
      },
    });
  });
}

/** Runs a server backups request and answers with its id. */
function answerServerBackups(ctx: Ctx, req: ServerBackupsRequest): void {
  void runServerBackups(ctx.page, req).then((r) => {
    ctx.postToUi({
      type: "SERVER_BACKUPS_DONE",
      payload: {
        requestId: req.requestId,
        ...(r.listing ? { listing: r.listing } : {}),
        ...(r.space ? { space: r.space } : {}),
        ...(r.error ? { error: clipError(r.error) } : {}),
      },
    });
  });
}

/** Reads or saves Foundry's configuration and answers with its id. */
function answerConfig(ctx: Ctx, req: ConfigRequest): void {
  void runConfig(ctx.page, req).then((r) => {
    ctx.postToUi({
      type: "CONFIG_DONE",
      payload: {
        requestId: req.requestId,
        ...(r.settings && r.choices
          ? { settings: r.settings, choices: r.choices }
          : {}),
        ...(r.restart === undefined ? {} : { restart: r.restart }),
        ...(r.passwordOk === undefined ? {} : { passwordOk: r.passwordOk }),
        ...(r.method === undefined ? {} : { method: r.method }),
        ...(r.reason === undefined ? {} : { reason: r.reason }),
        ...(r.error ? { error: clipError(r.error) } : {}),
      },
    });
  });
}

/** Checks for, or installs, Foundry's update and answers with its id. */
function answerUpdate(ctx: Ctx, req: UpdateRequest): void {
  void runUpdate(ctx.page, req).then((r) => {
    ctx.postToUi({
      type: "UPDATE_DONE",
      payload: { requestId: req.requestId, ...r },
    });
  });
}

/** Answers a save with its id, and an error if it failed. */
function answerSaved(
  ctx: Ctx,
  requestId: string,
  done: Promise<string | undefined>,
): void {
  void done.then((error) => {
    ctx.postToUi({
      type: "SAVE_DONE",
      payload: error ? { requestId, error: clipError(error) } : { requestId },
    });
  });
}

/** Saves a world's details and answers with its id. */
function answerSave(ctx: Ctx, req: SaveWorld): void {
  answerSaved(
    ctx,
    req.requestId,
    saveWorld(ctx.page, req.worldId, req.changes),
  );
}

/** Foundry's description editor in one of our hosts. */
function handleEditor(
  ctx: Ctx,
  m: Extract<
    UiToPage,
    { type: "EDITOR_OPEN" | "EDITOR_CLOSE" | "EDITOR_SAVE" }
  >,
): void {
  const { doc, page } = ctx;
  if (m.type === "EDITOR_OPEN") {
    const error = openEditor(doc, page, m.payload.hostId, m.payload.value);
    if (error) ctx.notify("error", error);
  } else if (m.type === "EDITOR_CLOSE") closeEditor(doc, m.payload.hostId);
  else
    answerSaved(
      ctx,
      m.payload.requestId,
      saveFromEditor(doc, page, m.payload.hostId, m.payload.worldId),
    );
}

function answerUpdates(ctx: Ctx): void {
  ctx.updates ??= checkUpdates(ctx.page);
  void ctx.updates.then((payload) => {
    if (payload) ctx.postToUi({ type: "UPDATES", payload });
  });
}

/** Messages that change Foundry: only on an admin's Setup (defence in depth). */
const WRITES: ReadonlySet<string> = new Set([
  "SAVE_WORLD",
  "EDITOR_SAVE",
  "FOUNDRY_ACTION",
  "BACKUPS",
  "SERVER_BACKUPS",
  "CONFIG",
  "UPDATE",
]);

/** The requests that run Foundry's work and answer by id. */
function handleRequest(ctx: Ctx, m: UiToPage): void {
  switch (m.type) {
    case "BACKUPS":
      answerBackups(ctx, m.payload);
      break;
    case "SERVER_BACKUPS":
      answerServerBackups(ctx, m.payload);
      break;
    case "CONFIG":
      answerConfig(ctx, m.payload);
      break;
    case "UPDATE":
      answerUpdate(ctx, m.payload);
      break;
    case "SAVE_WORLD":
      answerSave(ctx, m.payload);
      break;
    default:
  }
}

function handle(ctx: Ctx, m: UiToPage): void {
  if (WRITES.has(m.type) && ctx.page.game?.data?.isAdmin !== true) {
    ctx.notify(
      "error",
      "Module Library: only the administrator's Setup can change Foundry.",
    );
    return;
  }
  switch (m.type) {
    case "NOTIFY":
      ctx.notify(m.payload.kind, m.payload.text);
      break;
    case "SHELL":
      ctx.postToUi({
        type: "SHELL_STATE",
        payload: setShell(ctx.doc, m.payload.on),
      });
      break;
    case "FOUNDRY_ACTION":
      void runFoundryAction(ctx.doc, ctx.page, m.payload).then((error) => {
        if (error) ctx.notify("error", error);
      });
      break;
    case "EDITOR_OPEN":
    case "EDITOR_CLOSE":
    case "EDITOR_SAVE":
      handleEditor(ctx, m);
      break;
    case "CHECK_UPDATES":
      answerUpdates(ctx);
      break;
    default:
      handleRequest(ctx, m);
  }
}

function begin(ctx: Ctx): void {
  ctx.channel.listen((type, payload) => {
    const m = parseUiToPage(type, payload);
    if (m) handle(ctx, m);
  });
  watchProgress(ctx.page, ctx.postToUi);
  postSetupData(ctx);
  ctx.page.Hooks?.on("renderSetupPackages", () => {
    postSetupData(ctx);
  });
}

/** Waits for Foundry's Setup (polling), then serves our UI over `channel`. */
export function startSetupMain(deps: SetupMainDeps): void {
  const ctx: Ctx = {
    ...deps,
    postToUi: (m) => {
      deps.channel.send(m.type, m.payload);
    },
    notify: notifier(deps.page),
  };
  const poll = (polls: number): void => {
    if (deps.page.game?.view === "setup" && deps.page.ui?.setupPackages) {
      begin(ctx);
      return;
    }
    if (polls < MAX_POLLS)
      setTimeout(() => {
        poll(polls + 1);
      }, POLL_MS);
  };
  poll(0);
}
