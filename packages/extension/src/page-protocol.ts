// Messages between the Setup page's own world (setup-main) and the isolated
// UI (setup-ui). Both sides check every message by hand: the page world stays
// free of Zod to keep it small, and page scripts can post anything.

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

/** Entries added to Foundry's right-click menu on world cards. */
export interface MenuLabels {
  readonly details: string;
  /** Absent when changes are not allowed (read-only or safe mode). */
  readonly apply?: string;
}

export type MenuAction = "details" | "apply";

/** Foundry actions the new Setup page may ask for. World actions need a world id. */
export const SERVER_ACTIONS = [
  "configure",
  "backups",
  "update",
  "logout",
  "shutdown",
  "createWorld",
] as const;
export const WORLD_ACTIONS = ["launch", "editWorld", "favorite"] as const;
export type FoundryAction =
  | { readonly action: (typeof SERVER_ACTIONS)[number] }
  | {
      readonly action: (typeof WORLD_ACTIONS)[number];
      readonly worldId: string;
    };

export type UiToPage =
  | { readonly type: "WINDOW_OPEN"; readonly payload: WindowSpec }
  | { readonly type: "WINDOW_CLOSE"; readonly payload: { readonly id: string } }
  | {
      readonly type: "NOTIFY";
      readonly payload: { readonly kind: NoticeKind; readonly text: string };
    }
  | {
      readonly type: "MENU";
      readonly payload: {
        readonly labels: MenuLabels | null;
        readonly worldCard: string;
      };
    }
  /** Take over Foundry's Setup layout (on) or give it back (off). */
  | { readonly type: "SHELL"; readonly payload: { readonly on: boolean } }
  | { readonly type: "FOUNDRY_ACTION"; readonly payload: FoundryAction };

export type PageToUi =
  | { readonly type: "WINDOW_READY"; readonly payload: { readonly id: string } }
  | {
      readonly type: "WINDOW_CLOSED";
      readonly payload: { readonly id: string };
    }
  | {
      readonly type: "MENU_ACTION";
      readonly payload: {
        readonly action: MenuAction;
        readonly worldId: string;
      };
    }
  /** Whether Foundry's layout is taken over; an error means it could not be and was left alone. */
  | {
      readonly type: "SHELL_STATE";
      readonly payload: { readonly on: boolean; readonly error?: string };
    };

const WINDOW_ID = /^[a-z][a-z0-9-]{0,60}$/;
const MAX_TEXT = 2000;
const MAX_SIZE = 4000;
const KINDS: readonly string[] = ["info", "warning", "error"];
const ACTIONS: readonly string[] = ["details", "apply"];

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

function menuLabels(v: unknown): MenuLabels | null | undefined {
  if (v === null) return null;
  if (!isObject(v) || !isText(v.details, 100)) return undefined;
  if (v.apply === undefined) return { details: v.details };
  return isText(v.apply, 100)
    ? { details: v.details, apply: v.apply }
    : undefined;
}

function foundryAction(p: Loose): FoundryAction | undefined {
  const { action, worldId } = p;
  if ((SERVER_ACTIONS as readonly unknown[]).includes(action))
    return worldId === undefined
      ? { action: action as (typeof SERVER_ACTIONS)[number] }
      : undefined;
  if (
    (WORLD_ACTIONS as readonly unknown[]).includes(action) &&
    isText(worldId, 200)
  )
    return { action: action as (typeof WORLD_ACTIONS)[number], worldId };
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
    case "MENU": {
      const labels = menuLabels(p.labels);
      return labels === undefined || !isText(p.worldCard, 200)
        ? undefined
        : { type, payload: { labels, worldCard: p.worldCard } };
    }
    case "SHELL":
      return typeof p.on === "boolean"
        ? { type, payload: { on: p.on } }
        : undefined;
    case "FOUNDRY_ACTION": {
      const payload = foundryAction(p);
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
    case "MENU_ACTION":
      return typeof p.action === "string" &&
        ACTIONS.includes(p.action) &&
        isText(p.worldId, 200)
        ? {
            type,
            payload: {
              action: p.action as MenuAction,
              worldId: p.worldId,
            },
          }
        : undefined;
    case "SHELL_STATE":
      if (typeof p.on !== "boolean") return undefined;
      if (p.error === undefined) return { type, payload: { on: p.on } };
      return isText(p.error)
        ? { type, payload: { on: p.on, error: p.error } }
        : undefined;
    default:
      return undefined;
  }
}
