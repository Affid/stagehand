// Messages between the Setup page's own world (setup-main) and the isolated
// UI (setup-ui). Both sides check every message by hand: the page world stays
// free of Zod to keep it small, and page scripts can post anything.
import {
  type BackupsReply,
  type BackupsRequest,
  parseBackupsReply,
  parseBackupsRequest,
} from "./page-backups.ts";
import {
  type ConfigReply,
  type ConfigRequest,
  parseConfigReply,
  parseConfigRequest,
} from "./page-config.ts";
import {
  parseServerBackupsReply,
  parseServerBackupsRequest,
  type ServerBackupsReply,
  type ServerBackupsRequest,
} from "./page-server-backups.ts";
import {
  parseSaveDone,
  parseSaveWorld,
  type SaveDone,
  type SaveWorld,
} from "./page-save.ts";

export type NoticeKind = "info" | "warning" | "error";

/** A Foundry window the UI asks the page to open; `id` is unique per open. */
export interface WindowSpec {
  readonly id: string;
  readonly title: string;
  readonly icon: string;
  readonly width: number;
  readonly height: number;
  readonly left?: number;
  readonly top?: number;
}

/** Foundry actions the new Setup page may ask for. World actions need a world id. */
export const SERVER_ACTIONS = [
  "warnings",
  "logout",
  "shutdown",
  "createWorld",
] as const;
export const WORLD_ACTIONS = ["launch", "favorite", "backupLaunch"] as const;
export type FoundryAction =
  | { readonly action: (typeof SERVER_ACTIONS)[number] }
  | {
      readonly action: Exclude<(typeof WORLD_ACTIONS)[number], "backupLaunch">;
      readonly worldId: string;
    }
  | {
      /** Foundry's backup of the world, then its launch. */
      readonly action: "backupLaunch";
      readonly worldId: string;
      readonly note?: string;
    };

export type UiToPage =
  | { readonly type: "WINDOW_OPEN"; readonly payload: WindowSpec }
  | { readonly type: "WINDOW_CLOSE"; readonly payload: { readonly id: string } }
  | {
      readonly type: "NOTIFY";
      readonly payload: { readonly kind: NoticeKind; readonly text: string };
    }
  /** Take over Foundry's Setup layout (on) or give it back (off). */
  | { readonly type: "SHELL"; readonly payload: { readonly on: boolean } }
  | { readonly type: "FOUNDRY_ACTION"; readonly payload: FoundryAction }
  /** Save a world's details through Foundry (answered by SAVE_DONE). */
  | { readonly type: "SAVE_WORLD"; readonly payload: SaveWorld }
  /** A world's backups: list, take, restore or delete (answered by BACKUPS_DONE). */
  | { readonly type: "BACKUPS"; readonly payload: BackupsRequest }
  /** The server's backups and snapshots (answered by SERVER_BACKUPS_DONE). */
  | { readonly type: "SERVER_BACKUPS"; readonly payload: ServerBackupsRequest }
  /** Foundry's configuration: read, or save some settings (answered by CONFIG_DONE). */
  | { readonly type: "CONFIG"; readonly payload: ConfigRequest };

export type PageToUi =
  | { readonly type: "WINDOW_READY"; readonly payload: { readonly id: string } }
  | {
      readonly type: "WINDOW_CLOSED";
      readonly payload: { readonly id: string };
    }
  /** Whether Foundry's layout is taken over; an error means it could not be and was left alone. */
  | {
      readonly type: "SHELL_STATE";
      readonly payload: { readonly on: boolean; readonly error?: string };
    }
  | { readonly type: "SAVE_DONE"; readonly payload: SaveDone }
  | { readonly type: "BACKUPS_DONE"; readonly payload: BackupsReply }
  | {
      readonly type: "SERVER_BACKUPS_DONE";
      readonly payload: ServerBackupsReply;
    }
  | { readonly type: "CONFIG_DONE"; readonly payload: ConfigReply };

const WINDOW_ID = /^[a-z][a-z0-9-]{0,60}$/;
const MAX_TEXT = 2000;
const MAX_SIZE = 4000;
const KINDS: readonly string[] = ["info", "warning", "error"];

/** The element our UI renders into inside a Foundry window. */
export const windowHostId = (id: string): string => `ml-host-${id}`;

type Loose = Record<string, unknown>;

const isObject = (v: unknown): v is Loose =>
  typeof v === "object" && v !== null;
const isText = (v: unknown, max = MAX_TEXT): v is string =>
  typeof v === "string" && v.length > 0 && v.length <= max;
const isSize = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= MAX_SIZE;
const isWindowId = (v: unknown): v is string =>
  typeof v === "string" && WINDOW_ID.test(v);
const optionalSize = (v: unknown): boolean => v === undefined || isSize(v);

function windowSpec(p: Loose): WindowSpec | undefined {
  const { id, title, icon, width, height, left, top } = p;
  if (!isWindowId(id) || !isText(title, 200) || !isText(icon, 80))
    return undefined;
  if (!isSize(width) || !isSize(height)) return undefined;
  if (!optionalSize(left) || !optionalSize(top)) return undefined;
  return {
    id,
    title,
    icon,
    width,
    height,
    ...(typeof left === "number" ? { left } : {}),
    ...(typeof top === "number" ? { top } : {}),
  };
}

const NOTE_MAX = 200;

function foundryAction(p: Loose): FoundryAction | undefined {
  const { action, worldId, note } = p;
  if ((SERVER_ACTIONS as readonly unknown[]).includes(action))
    return worldId === undefined && note === undefined
      ? { action: action as (typeof SERVER_ACTIONS)[number] }
      : undefined;
  if (!isText(worldId, 200)) return undefined;
  if (action === "backupLaunch") {
    if (note === undefined) return { action, worldId };
    return isText(note, NOTE_MAX) ? { action, worldId, note } : undefined;
  }
  if (note !== undefined) return undefined;
  if ((WORLD_ACTIONS as readonly unknown[]).includes(action))
    return {
      action: action as Exclude<(typeof WORLD_ACTIONS)[number], "backupLaunch">,
      worldId,
    };
  return undefined;
}

/** A message from the UI, checked; undefined when malformed. */
export function parseUiToPage(type: string, p: unknown): UiToPage | undefined {
  if (!isObject(p)) return undefined;
  switch (type) {
    case "WINDOW_OPEN": {
      const spec = windowSpec(p);
      return spec ? { type, payload: spec } : undefined;
    }
    case "WINDOW_CLOSE":
      return isWindowId(p.id) ? { type, payload: { id: p.id } } : undefined;
    case "NOTIFY":
      return typeof p.kind === "string" &&
        KINDS.includes(p.kind) &&
        isText(p.text)
        ? { type, payload: { kind: p.kind as NoticeKind, text: p.text } }
        : undefined;
    case "SHELL":
      return typeof p.on === "boolean"
        ? { type, payload: { on: p.on } }
        : undefined;
    case "FOUNDRY_ACTION": {
      const payload = foundryAction(p);
      return payload ? { type, payload } : undefined;
    }
    case "SAVE_WORLD": {
      const payload = parseSaveWorld(p);
      return payload ? { type, payload } : undefined;
    }
    case "BACKUPS": {
      const payload = parseBackupsRequest(p);
      return payload ? { type, payload } : undefined;
    }
    case "SERVER_BACKUPS": {
      const payload = parseServerBackupsRequest(p);
      return payload ? { type, payload } : undefined;
    }
    case "CONFIG": {
      const payload = parseConfigRequest(p);
      return payload ? { type, payload } : undefined;
    }
    default:
      return undefined;
  }
}

/** A message from the page world, checked; undefined when malformed. */
export function parsePageToUi(type: string, p: unknown): PageToUi | undefined {
  if (!isObject(p)) return undefined;
  switch (type) {
    case "WINDOW_READY":
    case "WINDOW_CLOSED":
      return isWindowId(p.id) ? { type, payload: { id: p.id } } : undefined;
    case "SHELL_STATE":
      if (typeof p.on !== "boolean") return undefined;
      if (p.error === undefined) return { type, payload: { on: p.on } };
      return isText(p.error)
        ? { type, payload: { on: p.on, error: p.error } }
        : undefined;
    case "SAVE_DONE": {
      const payload = parseSaveDone(p);
      return payload ? { type, payload } : undefined;
    }
    case "BACKUPS_DONE": {
      const payload = parseBackupsReply(p);
      return payload ? { type, payload } : undefined;
    }
    case "SERVER_BACKUPS_DONE": {
      const payload = parseServerBackupsReply(p);
      return payload ? { type, payload } : undefined;
    }
    case "CONFIG_DONE": {
      const payload = parseConfigReply(p);
      return payload ? { type, payload } : undefined;
    }
    default:
      return undefined;
  }
}
