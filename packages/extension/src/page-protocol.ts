// Messages between the Setup page's own world (setup-main) and the isolated
// UI (setup-ui). Both sides check every message by hand: the page world stays
// free of Zod to keep it small, and page scripts can post anything.
import {
  type Lock,
  type Progress,
  parseLock,
  parseProgress,
} from "./page-progress.ts";
import { parseUpdates, type Updates } from "./page-updates.ts";
import {
  type EditorOpen,
  type EditorSave,
  parseEditorClose,
  parseEditorOpen,
  parseEditorSave,
} from "./page-editor.ts";
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

/** Foundry actions the new Setup page may ask for. World actions need a world id. */
export const SERVER_ACTIONS = [
  "warnings",
  "logout",
  "shutdown",
  "createWorld",
] as const;
export const WORLD_ACTIONS = [
  "launch",
  "favorite",
  "lock",
  "unlock",
  "deleteWorld",
  "pickBackground",
  "backupLaunch",
] as const;
/** Foundry's Install and Update All, for modules or systems. */
export const PACKAGE_ACTIONS = ["installPackage", "updateAll"] as const;
export const PACKAGE_KINDS = ["module", "system"] as const;
export type PackageKind = (typeof PACKAGE_KINDS)[number];

/** Foundry's card-menu actions on one module or system. */
export const PACKAGE_ID_ACTIONS = [
  "updatePackage",
  "favoritePackage",
  "lockPackage",
  "unlockPackage",
  "backupPackage",
  "uninstallPackage",
] as const;

export type FoundryAction =
  | { readonly action: (typeof SERVER_ACTIONS)[number] }
  | {
      readonly action: (typeof PACKAGE_ID_ACTIONS)[number];
      readonly packageType: PackageKind;
      readonly id: string;
    }
  | {
      readonly action: (typeof PACKAGE_ACTIONS)[number];
      readonly packageType: PackageKind;
    }
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
  | {
      readonly type: "NOTIFY";
      readonly payload: { readonly kind: NoticeKind; readonly text: string };
    }
  /** Take over Foundry's Setup layout (on) or give it back (off). */
  | { readonly type: "SHELL"; readonly payload: { readonly on: boolean } }
  | { readonly type: "FOUNDRY_ACTION"; readonly payload: FoundryAction }
  /** Save a world's details through Foundry (answered by SAVE_DONE). */
  | { readonly type: "SAVE_WORLD"; readonly payload: SaveWorld }
  /** Foundry's prose-mirror editor in one of our hosts (page-editor.ts). */
  | { readonly type: "EDITOR_OPEN"; readonly payload: EditorOpen }
  | {
      readonly type: "EDITOR_CLOSE";
      readonly payload: { readonly hostId: string };
    }
  /** Save the editor's HTML as the world's description (answered by SAVE_DONE). */
  | { readonly type: "EDITOR_SAVE"; readonly payload: EditorSave }
  /** A world's backups: list, take, restore or delete (answered by BACKUPS_DONE). */
  | { readonly type: "BACKUPS"; readonly payload: BackupsRequest }
  /** The server's backups and snapshots (answered by SERVER_BACKUPS_DONE). */
  | { readonly type: "SERVER_BACKUPS"; readonly payload: ServerBackupsRequest }
  /** Foundry's configuration: read, or save some settings (answered by CONFIG_DONE). */
  | { readonly type: "CONFIG"; readonly payload: ConfigRequest }
  /** Check Foundry's package list for updates (answered by UPDATES). */
  | { readonly type: "CHECK_UPDATES"; readonly payload: Record<string, never> };

export type PageToUi =
  /** Newer versions Foundry would install (page-updates.ts). */
  | { readonly type: "UPDATES"; readonly payload: Updates }
  /** Foundry's progress for a backup, snapshot or update (page-progress.ts). */
  | { readonly type: "PROGRESS"; readonly payload: Progress }
  /** Foundry's busy lock, mirrored on our page. */
  | { readonly type: "LOCK"; readonly payload: Lock }
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

const MAX_TEXT = 2000;
const KINDS: readonly string[] = ["info", "warning", "error"];

type Loose = Record<string, unknown>;

const isObject = (v: unknown): v is Loose =>
  typeof v === "object" && v !== null;
const isText = (v: unknown, max = MAX_TEXT): v is string =>
  typeof v === "string" && v.length > 0 && v.length <= max;

const NOTE_MAX = 200;

function packageAction(p: Loose): FoundryAction | undefined {
  const { action, packageType } = p;
  if (!(PACKAGE_ACTIONS as readonly unknown[]).includes(action))
    return undefined;
  if (!(PACKAGE_KINDS as readonly unknown[]).includes(packageType))
    return undefined;
  if (Object.keys(p).some((k) => k !== "action" && k !== "packageType"))
    return undefined;
  return {
    action: action as (typeof PACKAGE_ACTIONS)[number],
    packageType: packageType as PackageKind,
  };
}

const PACKAGE_ID = /^[A-Za-z0-9_-]{1,200}$/;

function packageIdAction(p: Loose): FoundryAction | undefined {
  const { action, packageType, id } = p;
  if (!(PACKAGE_KINDS as readonly unknown[]).includes(packageType))
    return undefined;
  if (typeof id !== "string" || !PACKAGE_ID.test(id)) return undefined;
  if (Object.keys(p).length !== 3) return undefined;
  return {
    action: action as (typeof PACKAGE_ID_ACTIONS)[number],
    packageType: packageType as PackageKind,
    id,
  };
}

function foundryAction(p: Loose): FoundryAction | undefined {
  const { action, worldId, note } = p;
  if ((PACKAGE_ID_ACTIONS as readonly unknown[]).includes(action))
    return packageIdAction(p);
  if ((PACKAGE_ACTIONS as readonly unknown[]).includes(action))
    return packageAction(p);
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

/** The description editor's messages (page-editor.ts). */
function parseEditor(type: string, p: Loose): UiToPage | undefined {
  if (type === "EDITOR_OPEN") {
    const payload = parseEditorOpen(p);
    return payload ? { type, payload } : undefined;
  }
  if (type === "EDITOR_CLOSE") {
    const payload = parseEditorClose(p);
    return payload ? { type, payload } : undefined;
  }
  if (type === "EDITOR_SAVE") {
    const payload = parseEditorSave(p);
    return payload ? { type, payload } : undefined;
  }
  return undefined;
}

/** A message from the UI, checked; undefined when malformed. */
export function parseUiToPage(type: string, p: unknown): UiToPage | undefined {
  if (!isObject(p)) return undefined;
  if (type.startsWith("EDITOR_")) return parseEditor(type, p);
  switch (type) {
    case "CHECK_UPDATES":
      return Object.keys(p).length === 0 ? { type, payload: {} } : undefined;
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
  if (type === "PROGRESS") {
    const payload = parseProgress(p);
    return payload ? { type, payload } : undefined;
  }
  if (type === "UPDATES") {
    const payload = parseUpdates(p);
    return payload ? { type, payload } : undefined;
  }
  if (type === "LOCK") {
    const payload = parseLock(p);
    return payload ? { type, payload } : undefined;
  }
  switch (type) {
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
