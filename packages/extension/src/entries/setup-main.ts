// Runs in the Setup page's own JavaScript world. Posts package data to the
// isolated UI (V-1), and lends it Foundry's own pieces: windows, the
// right-click menu on world cards, and notifications. Every message from the
// UI is checked; anything unexpected is ignored.
import { logError } from "@module-library/shared/log";
import { isEnvelope, makeEnvelope } from "@module-library/shared/protocol";
import {
  type PageToUi,
  parseUiToPage,
  type UiToPage,
} from "../page-protocol.ts";
import { runFoundryAction } from "../page/actions.ts";
import type { BackupsRequest } from "../page-backups.ts";
import type { SaveWorld } from "../page-save.ts";
import { runBackups } from "../page/backups.ts";
import { runServerBackups } from "../page/server-backups.ts";
import { runConfig } from "../page/config.ts";
import type { ConfigRequest } from "../page-config.ts";
import type { ServerBackupsRequest } from "../page-server-backups.ts";
import { saveWorld } from "../page/save-world.ts";
import { collect } from "../page/collect.ts";
import { pageGlobals } from "../page/globals.ts";
import { installWorldMenu, type MenuConfig } from "../page/menu.ts";
import { setShell } from "../page/shell.ts";
import { createWindowHost, type WindowHost } from "../page/windows.ts";

const page = pageGlobals();
const POLL_MS = 100;
/** SAVE_DONE's limit for an error message. */
const MAX_ERROR = 2000;
const MAX_POLLS = 300;

function post(type: string, payload: unknown): void {
  window.postMessage(
    makeEnvelope("setup-main", type, payload),
    location.origin,
  );
}

const postToUi = (m: PageToUi): void => {
  post(m.type, m.payload);
};

function postSetupData(): void {
  if (page.game) post("SETUP_DATA", collect(page.game));
}

/** Foundry's toast; it renders HTML, so our text is escaped first. */
function notify(kind: "info" | "warning" | "error", text: string): void {
  const safe = page.foundry?.utils?.escapeHTML?.(text);
  const n = page.ui?.notifications;
  const level = kind === "warning" ? "warn" : kind;
  if (safe !== undefined && n?.[level]) n[level](safe, { console: false });
  else logError("notice", new Error(text));
}

interface Bridge {
  readonly windows: WindowHost | undefined;
  readonly setMenu: ((config: MenuConfig | null) => void) | undefined;
}

/** Runs a backups request and answers with its id. */
function answerBackups(req: BackupsRequest): void {
  void runBackups(page, req).then((r) => {
    postToUi({
      type: "BACKUPS_DONE",
      payload: {
        requestId: req.requestId,
        ...(r.backups ? { backups: r.backups } : {}),
        ...(r.error ? { error: r.error.slice(0, MAX_ERROR) } : {}),
      },
    });
  });
}

/** Runs a server backups request and answers with its id. */
function answerServerBackups(req: ServerBackupsRequest): void {
  void runServerBackups(page, req).then((r) => {
    postToUi({
      type: "SERVER_BACKUPS_DONE",
      payload: {
        requestId: req.requestId,
        ...(r.listing ? { listing: r.listing } : {}),
        ...(r.error ? { error: r.error.slice(0, MAX_ERROR) } : {}),
      },
    });
  });
}

/** Reads or saves Foundry's configuration and answers with its id. */
function answerConfig(req: ConfigRequest): void {
  void runConfig(page, req).then((r) => {
    postToUi({
      type: "CONFIG_DONE",
      payload: {
        requestId: req.requestId,
        ...(r.settings && r.choices
          ? { settings: r.settings, choices: r.choices }
          : {}),
        ...(r.restart === undefined ? {} : { restart: r.restart }),
        ...(r.error ? { error: r.error.slice(0, MAX_ERROR) } : {}),
      },
    });
  });
}

/** Saves a world's details and answers with its id. */
function answerSave(req: SaveWorld): void {
  const { requestId, worldId, changes } = req;
  void saveWorld(page, worldId, changes).then((error) => {
    postToUi({
      type: "SAVE_DONE",
      payload: error
        ? { requestId, error: error.slice(0, MAX_ERROR) }
        : { requestId },
    });
  });
}

function handle(bridge: Bridge, m: UiToPage): void {
  switch (m.type) {
    case "WINDOW_OPEN":
      void bridge.windows?.open(m.payload);
      break;
    case "WINDOW_CLOSE":
      void bridge.windows?.close(m.payload.id);
      break;
    case "NOTIFY":
      notify(m.payload.kind, m.payload.text);
      break;
    case "MENU":
      bridge.setMenu?.(
        m.payload.labels
          ? { labels: m.payload.labels, worldCard: m.payload.worldCard }
          : null,
      );
      break;
    case "SHELL":
      postToUi({
        type: "SHELL_STATE",
        payload: setShell(document, m.payload.on),
      });
      break;
    case "FOUNDRY_ACTION":
      void runFoundryAction(document, page, m.payload).then((error) => {
        if (error) notify("error", error);
      });
      break;
    case "BACKUPS":
      answerBackups(m.payload);
      break;
    case "SERVER_BACKUPS":
      answerServerBackups(m.payload);
      break;
    case "CONFIG":
      answerConfig(m.payload);
      break;
    case "SAVE_WORLD":
      answerSave(m.payload);
  }
}

function connect(): void {
  const api = page.foundry?.applications;
  const base = api?.api?.ApplicationV2;
  const menu = api?.ux?.ContextMenu?.prototype;
  const bridge: Bridge = {
    windows: base ? createWindowHost(base, postToUi) : undefined,
    setMenu: menu ? installWorldMenu(menu, postToUi) : undefined,
  };
  window.addEventListener("message", (event: MessageEvent<unknown>) => {
    if (event.source !== window || event.origin !== location.origin) return;
    if (!isEnvelope(event.data, "setup-ui")) return;
    const m = parseUiToPage(event.data.type, event.data.payload);
    if (m) handle(bridge, m);
  });
}

function start(polls = 0): void {
  if (page.game?.view === "setup" && page.ui?.setupPackages) {
    connect();
    postSetupData();
    page.Hooks?.on("renderSetupPackages", postSetupData);
    return;
  }
  if (polls < MAX_POLLS)
    setTimeout(() => {
      start(polls + 1);
    }, POLL_MS);
}

start();
