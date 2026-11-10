// The UI's link to the Setup page's own world: Foundry's actions, dialogs,
// editor and notifications, over the page channel (page-channel.ts).
import { newRequestId } from "@stagehand/shared/protocol";
import type { PageChannel } from "../page-channel.ts";
import {
  type FoundryAction,
  type NoticeKind,
  type PageToUi,
  parsePageToUi,
  type UiToPage,
} from "../page-protocol.ts";
import type { BackupInfo, BackupOp, PackageType } from "../page-backups.ts";
import type {
  Choices,
  ConfigOp,
  ConfigReply,
  ReadOnly,
  SettingChanges,
  Settings,
} from "../page-config.ts";
import type { WorldChanges } from "../page-save.ts";
import type { LaunchAsk, QueueDone, QueueSaved } from "../page-queue.ts";
import type { QueueEntry } from "@stagehand/shared/world-flags";
import type {
  ServerBackupOp,
  ServerListing,
  SnapshotSpace,
} from "../page-server-backups.ts";
import type { Preview } from "../page-compat.ts";
import type { Release, UpdateOp, UpdateReply } from "../page-update.ts";

export interface BackupsResult {
  readonly backups?: readonly BackupInfo[];
  readonly error?: string;
}

export interface ConfigResult {
  readonly settings?: Settings & ReadOnly;
  readonly choices?: Choices;
  readonly restart?: boolean;
  readonly passwordOk?: boolean;
  readonly method?: string;
  readonly reason?: string;
  readonly error?: string;
}

export interface ServerBackupsResult {
  readonly listing?: ServerListing;
  /** The space a snapshot needs and the space free (op "space"). */
  readonly space?: SnapshotSpace;
  readonly error?: string;
}

export interface UpdateResult {
  readonly release?: Release;
  readonly info?: string;
  readonly installed?: boolean;
  readonly preview?: Preview;
  readonly error?: string;
}

export interface UpdateAsk {
  readonly op: UpdateOp;
  readonly channel: string;
  readonly force: boolean;
  readonly snapshot?: boolean;
  /** download: the version it installs; preview: the release checked. */
  readonly version?: string;
}

export interface PageBridge {
  notify(kind: NoticeKind, text: string): void;
  /** Take over Foundry's Setup layout, or give it back; the answer arrives as SHELL_STATE. */
  setShell(on: boolean): void;
  /** The phone or tablet layout is on: Foundry's window-size notice goes. */
  setCompact(on: boolean): void;
  foundryAction(action: FoundryAction): void;
  /** Ask for the updates Foundry would install; they arrive as UPDATES. */
  checkUpdates(): void;
  /** Saves a world's details through Foundry; resolves with an error, or undefined. */
  saveWorld(
    worldId: string,
    changes: WorldChanges,
  ): Promise<string | undefined>;
  /**
   * Writes a world's queue and launch's intent into its flags (undefined
   * leaves either as it is; a null launch removes it): the server's time of
   * the write, or an error.
   */
  saveQueue(
    worldId: string,
    queue: readonly QueueEntry[] | undefined,
    launch?: LaunchAsk | null,
  ): Promise<QueueSaved>;
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
    /** createSnapshot: the note from our dialog. */
    note?: string,
  ): Promise<ServerBackupsResult>;
  /** Foundry's configuration: read it, or save some settings. */
  config(
    op: ConfigOp,
    changes?: SettingChanges,
    /** save: a new admin password; checkPassword: the current one. */
    password?: string,
  ): Promise<ConfigResult>;
  /** Foundry's own update: check a channel, or download and install. */
  update(ask: UpdateAsk): Promise<UpdateResult>;
  subscribe(fn: (event: PageToUi) => void): () => void;
}

/** UPDATE_DONE as the page uses it. */
function updateResult(p: UpdateReply): UpdateResult {
  const { release, info, installed, preview, error } = p;
  return {
    ...(release ? { release } : {}),
    ...(info === undefined ? {} : { info }),
    ...(installed ? { installed } : {}),
    ...(preview ? { preview } : {}),
    ...(error === undefined ? {} : { error }),
  };
}

/** CONFIG_DONE as the page uses it. */
function configResult(p: ConfigReply): ConfigResult {
  const { settings, choices, restart, passwordOk, method, reason, error } = p;
  return {
    ...(settings && choices ? { settings, choices } : {}),
    ...(restart === undefined ? {} : { restart }),
    ...(passwordOk === undefined ? {} : { passwordOk }),
    ...(method === undefined ? {} : { method }),
    ...(reason === undefined ? {} : { reason }),
    ...(error === undefined ? {} : { error }),
  };
}

/** A save goes to Foundry's server; longer than this is a failure. */
const SAVE_TIMEOUT_MS = 20_000;
/** Taking or restoring a backup waits on Foundry's dialog and the copy. */
const BACKUP_OP_TIMEOUT_MS = 30 * 60 * 1000;
/** An update check asks foundryvtt.com through Foundry's server. */
const CHECK_TIMEOUT_MS = 60_000;
/** Foundry's compatibility preview asks about every installed package. */
const PREVIEW_TIMEOUT_MS = 180_000;
const UPDATE_TIMEOUTS = {
  check: CHECK_TIMEOUT_MS,
  preview: PREVIEW_TIMEOUT_MS,
  download: BACKUP_OP_TIMEOUT_MS,
} as const;

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
    serverBackups: (op, ids, disk, note) =>
      request<ServerBackupsResult>(
        send,
        listeners,
        (requestId) => ({
          type: "SERVER_BACKUPS",
          payload: {
            requestId,
            op,
            ids: [...ids],
            ...(disk ? { disk } : {}),
            ...(note === undefined ? {} : { note }),
          },
        }),
        (e, id) =>
          e.type === "SERVER_BACKUPS_DONE" && e.payload.requestId === id
            ? {
                ...(e.payload.listing ? { listing: e.payload.listing } : {}),
                ...(e.payload.space ? { space: e.payload.space } : {}),
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

/** Foundry's own update: a check is quick, a download takes minutes. */
function updateRequest(
  send: (m: UiToPage) => void,
  listeners: Set<(event: PageToUi) => void>,
  ask: UpdateAsk,
): Promise<UpdateResult> {
  return request<UpdateResult>(
    send,
    listeners,
    (requestId) => ({
      type: "UPDATE",
      payload: { requestId, snapshot: false, ...ask },
    }),
    (e, id) =>
      e.type === "UPDATE_DONE" && e.payload.requestId === id
        ? updateResult(e.payload)
        : undefined,
    UPDATE_TIMEOUTS[ask.op],
    { error: "Foundry did not answer in time." },
  );
}

/** A queue save's answer, without the request id. */
const queueSaved = (p: QueueDone): QueueSaved => ({
  ...(p.error === undefined ? {} : { error: p.error }),
  ...(p.written === undefined ? {} : { written: p.written }),
});

/** The saves: a world's details and description (SAVE_DONE), its queue. */
function saves(
  send: (m: UiToPage) => void,
  listeners: Set<(event: PageToUi) => void>,
): Pick<PageBridge, "saveWorld" | "saveQueue" | "editorSave"> {
  const saved = (message: (requestId: string) => UiToPage) =>
    savedRequest(send, listeners, message);
  return {
    saveWorld: (worldId, changes) =>
      saved((requestId) => ({
        type: "SAVE_WORLD",
        payload: { requestId, worldId, changes },
      })),
    saveQueue: (worldId, queue, launch) =>
      request<QueueSaved>(
        send,
        listeners,
        (requestId) => ({
          type: "SAVE_QUEUE",
          payload: {
            requestId,
            worldId,
            ...(queue ? { queue: [...queue] } : {}),
            ...(launch === undefined ? {} : { launch }),
          },
        }),
        (e, id) =>
          e.type === "QUEUE_DONE" && e.payload.requestId === id
            ? queueSaved(e.payload)
            : undefined,
        SAVE_TIMEOUT_MS,
        { error: "Foundry did not answer in time." },
      ),
    editorSave: (worldId, hostId) =>
      saved((requestId) => ({
        type: "EDITOR_SAVE",
        payload: { requestId, worldId, hostId },
      })),
  };
}

/** The bridge's request and answer pairs: saves, backups, config, update. */
function requests(
  send: (m: UiToPage) => void,
  listeners: Set<(event: PageToUi) => void>,
): Pick<
  PageBridge,
  | "saveWorld"
  | "saveQueue"
  | "editorSave"
  | "backups"
  | "serverBackups"
  | "config"
  | "update"
> {
  return {
    ...saves(send, listeners),
    config: (op, changes = {}, password) =>
      request<ConfigResult>(
        send,
        listeners,
        (requestId) => ({
          type: "CONFIG",
          payload: {
            requestId,
            op,
            changes,
            ...(password === undefined ? {} : { password }),
          },
        }),
        (e, id) =>
          e.type === "CONFIG_DONE" && e.payload.requestId === id
            ? configResult(e.payload)
            : undefined,
        // A certificate waits on Let's Encrypt; the rest is quick.
        op === "generateCertificate" ? BACKUP_OP_TIMEOUT_MS : SAVE_TIMEOUT_MS,
        { error: "Foundry did not answer in time." },
      ),
    update: (ask) => updateRequest(send, listeners, ask),
    ...backupRequests(send, listeners),
  };
}

export function createPageBridge(channel: PageChannel): PageBridge {
  const listeners = new Set<(event: PageToUi) => void>();
  const send = (m: UiToPage): void => {
    channel.send(m.type, m.payload);
  };
  channel.listen((type, payload) => {
    const m = parsePageToUi(type, payload);
    if (m)
      listeners.forEach((fn) => {
        fn(m);
      });
  });
  return {
    notify: (kind, text) => {
      if (text) send({ type: "NOTIFY", payload: { kind, text: clip(text) } });
    },
    setShell: (on) => {
      send({ type: "SHELL", payload: { on } });
    },
    setCompact: (on) => {
      send({ type: "COMPACT", payload: { on } });
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
    checkUpdates: () => {
      send({ type: "CHECK_UPDATES", payload: {} });
    },
    ...requests(send, listeners),
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}
