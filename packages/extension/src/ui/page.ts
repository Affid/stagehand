// The UI's link to the Setup page's own world: Foundry windows, the world
// card menu and notifications. Messages go over window.postMessage.
import { isEnvelope, makeEnvelope } from "@module-library/shared/protocol";
import {
  type FoundryAction,
  type NoticeKind,
  type PageToUi,
  parsePageToUi,
  type UiToPage,
  type WindowSpec,
  windowHostId,
} from "../page-protocol.ts";
import type { BackupInfo, BackupOp, PackageType } from "../page-backups.ts";
import type {
  Choices,
  ReadOnly,
  SettingChanges,
  Settings,
} from "../page-config.ts";
import type { WorldChanges } from "../page-save.ts";
import type { ServerBackupOp, ServerListing } from "../page-server-backups.ts";

export interface BackupsResult {
  readonly backups?: readonly BackupInfo[];
  readonly error?: string;
}

export interface ConfigResult {
  readonly settings?: Settings & ReadOnly;
  readonly choices?: Choices;
  readonly restart?: boolean;
  readonly error?: string;
}

export interface ServerBackupsResult {
  readonly listing?: ServerListing;
  readonly error?: string;
}

export interface PageBridge {
  notify(kind: NoticeKind, text: string): void;
  openWindow(spec: WindowSpec): void;
  closeWindow(id: string): void;
  /** Take over Foundry's Setup layout, or give it back; the answer arrives as SHELL_STATE. */
  setShell(on: boolean): void;
  foundryAction(action: FoundryAction): void;
  /** Saves a world's details through Foundry; resolves with an error, or undefined. */
  saveWorld(
    worldId: string,
    changes: WorldChanges,
  ): Promise<string | undefined>;
  /** Foundry's prose-mirror editor in our host element (a page-world element). */
  editorOpen(hostId: string, value: string): void;
  editorClose(hostId: string): void;
  /** Saves the editor's HTML as the world's description; an error, or undefined. */
  editorSave(worldId: string, hostId: string): Promise<string | undefined>;
  /** A world's backups: list, take, restore or delete, then the current list. */
  backups(
    worldId: string,
    op: BackupOp,
    ids: readonly string[],
    type?: PackageType,
  ): Promise<BackupsResult>;
  /** The server's backups and snapshots: list, or a snapshot operation. */
  serverBackups(
    op: ServerBackupOp,
    ids: readonly string[],
    /** Also ask for the free disk space (adapter flag diskFree). */
    disk?: boolean,
  ): Promise<ServerBackupsResult>;
  /** Foundry's configuration: read it, or save some settings. */
  config(op: "read" | "save", changes?: SettingChanges): Promise<ConfigResult>;
  /** Our host element inside an open Foundry window, if it is there. */
  windowHost(id: string): HTMLElement | null;
  subscribe(fn: (event: PageToUi) => void): () => void;
}

/** A save goes to Foundry's server; longer than this is a failure. */
const SAVE_TIMEOUT_MS = 20_000;
/** Taking or restoring a backup waits on Foundry's dialog and the copy. */
const BACKUP_OP_TIMEOUT_MS = 30 * 60 * 1000;

const newRequestId = (): string =>
  [...crypto.getRandomValues(new Uint8Array(12))]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

/** NOTIFY's limit; longer text is cut rather than dropped. */
const MAX_NOTICE = 2000;

const clip = (text: string): string =>
  text.length > MAX_NOTICE ? `${text.slice(0, MAX_NOTICE - 1)}…` : text;

/**
 * One request to the page world, settled by the answer that carries its id,
 * or by the timeout with `onTimeout`'s value.
 */
function request<T>(
  send: (m: UiToPage) => void,
  listeners: Set<(event: PageToUi) => void>,
  ask: (requestId: string) => UiToPage,
  answer: (e: PageToUi, requestId: string) => T | undefined,
  timeoutMs: number,
  onTimeout: T,
): Promise<T> {
  return new Promise((resolve) => {
    const requestId = newRequestId();
    const finish = (value: T): void => {
      clearTimeout(timer);
      listeners.delete(onReply);
      resolve(value);
    };
    const onReply = (e: PageToUi): void => {
      const value = answer(e, requestId);
      if (value !== undefined) finish(value);
    };
    const timer = setTimeout(() => {
      finish(onTimeout);
    }, timeoutMs);
    listeners.add(onReply);
    send(ask(requestId));
  });
}

/** A world's or package's backups, and the server's snapshots. */
function backupRequests(
  send: (m: UiToPage) => void,
  listeners: Set<(event: PageToUi) => void>,
): Pick<PageBridge, "backups" | "serverBackups"> {
  return {
    backups: (worldId, op, ids, type = "world") =>
      request<BackupsResult>(
        send,
        listeners,
        (requestId) => ({
          type: "BACKUPS",
          payload: { requestId, worldId, type, op, ids: [...ids] },
        }),
        (e, id) =>
          e.type === "BACKUPS_DONE" && e.payload.requestId === id
            ? {
                ...(e.payload.backups ? { backups: e.payload.backups } : {}),
                ...(e.payload.error ? { error: e.payload.error } : {}),
              }
            : undefined,
        // Foundry's dialogs wait for the admin; a list is quick.
        op === "list" ? SAVE_TIMEOUT_MS : BACKUP_OP_TIMEOUT_MS,
        { error: "Foundry did not answer in time." },
      ),
    serverBackups: (op, ids, disk) =>
      request<ServerBackupsResult>(
        send,
        listeners,
        (requestId) => ({
          type: "SERVER_BACKUPS",
          payload: { requestId, op, ids: [...ids], ...(disk ? { disk } : {}) },
        }),
        (e, id) =>
          e.type === "SERVER_BACKUPS_DONE" && e.payload.requestId === id
            ? {
                ...(e.payload.listing ? { listing: e.payload.listing } : {}),
                ...(e.payload.error ? { error: e.payload.error } : {}),
              }
            : undefined,
        op === "list" ? SAVE_TIMEOUT_MS : BACKUP_OP_TIMEOUT_MS,
        { error: "Foundry did not answer in time." },
      ),
  };
}

/** A request answered by SAVE_DONE: an error, or undefined when saved. */
function savedRequest(
  send: (m: UiToPage) => void,
  listeners: Set<(event: PageToUi) => void>,
  message: (requestId: string) => UiToPage,
): Promise<string | undefined> {
  return request<{ error?: string }>(
    send,
    listeners,
    message,
    (e, id) =>
      e.type === "SAVE_DONE" && e.payload.requestId === id
        ? e.payload.error === undefined
          ? {}
          : { error: e.payload.error }
        : undefined,
    SAVE_TIMEOUT_MS,
    { error: "Foundry did not answer in time." },
  ).then((r) => r.error);
}

/** The bridge's request and answer pairs: saving a world, backups. */
function requests(
  send: (m: UiToPage) => void,
  listeners: Set<(event: PageToUi) => void>,
): Pick<
  PageBridge,
  "saveWorld" | "editorSave" | "backups" | "serverBackups" | "config"
> {
  const saved = (message: (requestId: string) => UiToPage) =>
    savedRequest(send, listeners, message);
  return {
    saveWorld: (worldId, changes) =>
      saved((requestId) => ({
        type: "SAVE_WORLD",
        payload: { requestId, worldId, changes },
      })),
    editorSave: (worldId, hostId) =>
      saved((requestId) => ({
        type: "EDITOR_SAVE",
        payload: { requestId, worldId, hostId },
      })),
    config: (op, changes = {}) =>
      request<ConfigResult>(
        send,
        listeners,
        (requestId) => ({
          type: "CONFIG",
          payload: { requestId, op, changes },
        }),
        (e, id) =>
          e.type === "CONFIG_DONE" && e.payload.requestId === id
            ? {
                ...(e.payload.settings && e.payload.choices
                  ? { settings: e.payload.settings, choices: e.payload.choices }
                  : {}),
                ...(e.payload.restart === undefined
                  ? {}
                  : { restart: e.payload.restart }),
                ...(e.payload.error ? { error: e.payload.error } : {}),
              }
            : undefined,
        SAVE_TIMEOUT_MS,
        { error: "Foundry did not answer in time." },
      ),
    ...backupRequests(send, listeners),
  };
}

export function createPageBridge(win: Window): PageBridge {
  const listeners = new Set<(event: PageToUi) => void>();
  const send = (m: UiToPage): void => {
    win.postMessage(
      makeEnvelope("setup-ui", m.type, m.payload),
      win.location.origin,
    );
  };
  win.addEventListener("message", (event: MessageEvent<unknown>) => {
    if (event.source !== win || event.origin !== win.location.origin) return;
    if (!isEnvelope(event.data, "setup-main")) return;
    const m = parsePageToUi(event.data.type, event.data.payload);
    if (m)
      listeners.forEach((fn) => {
        fn(m);
      });
  });
  return {
    notify: (kind, text) => {
      if (text) send({ type: "NOTIFY", payload: { kind, text: clip(text) } });
    },
    openWindow: (spec) => {
      send({ type: "WINDOW_OPEN", payload: spec });
    },
    closeWindow: (id) => {
      send({ type: "WINDOW_CLOSE", payload: { id } });
    },
    setShell: (on) => {
      send({ type: "SHELL", payload: { on } });
    },
    editorOpen: (hostId, value) => {
      send({ type: "EDITOR_OPEN", payload: { hostId, value } });
    },
    editorClose: (hostId) => {
      send({ type: "EDITOR_CLOSE", payload: { hostId } });
    },
    foundryAction: (action) => {
      send({ type: "FOUNDRY_ACTION", payload: action });
    },
    ...requests(send, listeners),
    windowHost: (id) => {
      const host = win.document.getElementById(windowHostId(id));
      // Only ever render into a host inside a Foundry window.
      return host?.closest(".application.ml-window") ? host : null;
    },
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}
