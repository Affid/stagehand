// The server Configuration page (build plan, Phase 5): the UI asks with
// CONFIG (read, or save some settings); the page world validates with
// Foundry's own ServerSettings model and answers CONFIG_DONE. Only an
// allow-list of settings crosses: never the password hash, salt or
// certificate keys. Checked both ways.
type Loose = Readonly<Record<string, unknown>>;

/** A setting's kind: what the UI edits and what a save may carry. */
type Kind = "bool" | "text" | "optText" | "port" | "optPort";

export const EDITABLE = {
  adminUsername: "optText",
  world: "optText",
  language: "text",
  cssTheme: "text",
  port: "port",
  upnp: "bool",
  hostname: "optText",
  routePrefix: "optText",
  proxyPort: "optPort",
  proxySSL: "bool",
  noBackups: "bool",
  telemetry: "bool",
  hotReload: "bool",
  deleteNEDB: "bool",
  compressStatic: "bool",
  compressSocket: "bool",
  updateChannel: "text",
} as const satisfies Record<string, Kind>;

export type SettingKey = keyof typeof EDITABLE;
type ValueOf<K extends Kind> = K extends "bool"
  ? boolean
  : K extends "text"
    ? string
    : K extends "optText"
      ? string | null
      : K extends "port"
        ? number
        : number | null;
export type Settings = {
  readonly [K in SettingKey]: ValueOf<(typeof EDITABLE)[K]>;
};
export type SettingChanges = Partial<Settings>;

/** What the page shows besides the editable settings. */
export interface ReadOnly {
  /** Whether an admin password is set; the password itself never crosses. */
  readonly passwordSet: boolean;
  readonly dataPath: string;
}

export interface Choice {
  readonly value: string;
  readonly label: string;
}

export interface Choices {
  readonly worlds: readonly Choice[];
  readonly languages: readonly Choice[];
  readonly themes: readonly Choice[];
  readonly channels: readonly Choice[];
}

export interface ConfigRequest {
  readonly requestId: string;
  readonly op: "read" | "save";
  readonly changes: SettingChanges;
}

export interface ConfigReply {
  readonly requestId: string;
  readonly settings?: Settings & ReadOnly;
  readonly choices?: Choices;
  /** A save that only applies after Foundry restarts. */
  readonly restart?: boolean;
  readonly error?: string;
}

const REQUEST_ID = /^[a-z0-9-]{1,64}$/i;
const MAX_TEXT = 255;
const MAX_CHOICES = 2000;
const MAX_ERROR = 2000;

const isObject = (v: unknown): v is Loose =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const isRequestId = (v: unknown): v is string =>
  typeof v === "string" && REQUEST_ID.test(v);

function valid(kind: Kind, v: unknown): boolean {
  switch (kind) {
    case "bool":
      return typeof v === "boolean";
    case "text":
      return typeof v === "string" && v.length > 0 && v.length <= MAX_TEXT;
    case "optText":
      return v === null || (typeof v === "string" && v.length <= MAX_TEXT);
    case "port":
      return (
        Number.isInteger(v) && (v as number) >= 1 && (v as number) <= 65535
      );
    case "optPort":
      return v === null || valid("port", v);
  }
}

function changes(v: unknown, requireSome: boolean): SettingChanges | undefined {
  const obj = v ?? {};
  if (!isObject(obj)) return undefined;
  const keys = Object.keys(obj);
  if (requireSome && keys.length === 0) return undefined;
  for (const k of keys) {
    const kind = (EDITABLE as Record<string, Kind>)[k];
    if (!kind || !valid(kind, obj[k])) return undefined;
  }
  return obj;
}

export function parseConfigRequest(p: Loose): ConfigRequest | undefined {
  if (!isRequestId(p.requestId)) return undefined;
  if (p.op === "read") {
    if (p.changes !== undefined) return undefined;
    return { requestId: p.requestId, op: "read", changes: {} };
  }
  if (p.op !== "save") return undefined;
  const c = changes(p.changes, true);
  return c ? { requestId: p.requestId, op: "save", changes: c } : undefined;
}

function settings(v: unknown): (Settings & ReadOnly) | undefined {
  if (!isObject(v)) return undefined;
  const allowed = new Set([
    ...Object.keys(EDITABLE),
    "passwordSet",
    "dataPath",
  ]);
  if (Object.keys(v).some((k) => !allowed.has(k))) return undefined;
  for (const [k, kind] of Object.entries(EDITABLE) as [SettingKey, Kind][])
    if (!valid(kind, v[k])) return undefined;
  if (typeof v.passwordSet !== "boolean") return undefined;
  if (typeof v.dataPath !== "string" || v.dataPath.length > 4096)
    return undefined;
  return v as unknown as Settings & ReadOnly;
}

function choiceList(v: unknown): Choice[] | undefined {
  if (!Array.isArray(v) || v.length > MAX_CHOICES) return undefined;
  const ok = v.every(
    (c) =>
      isObject(c) &&
      typeof c.value === "string" &&
      c.value.length <= MAX_TEXT &&
      typeof c.label === "string" &&
      c.label.length <= MAX_TEXT,
  );
  return ok ? (v as Choice[]) : undefined;
}

function choices(v: unknown): Choices | undefined {
  if (!isObject(v)) return undefined;
  const worlds = choiceList(v.worlds);
  const languages = choiceList(v.languages);
  const themes = choiceList(v.themes);
  const channels = choiceList(v.channels);
  return worlds && languages && themes && channels
    ? { worlds, languages, themes, channels }
    : undefined;
}

export function parseConfigReply(p: Loose): ConfigReply | undefined {
  if (!isRequestId(p.requestId)) return undefined;
  const { error, restart } = p;
  if (
    error !== undefined &&
    !(typeof error === "string" && error.length <= MAX_ERROR)
  )
    return undefined;
  if (restart !== undefined && typeof restart !== "boolean") return undefined;
  const base = {
    requestId: p.requestId,
    ...(error === undefined ? {} : { error }),
    ...(restart === undefined ? {} : { restart }),
  };
  if (p.settings === undefined) return base;
  const s = settings(p.settings);
  const c = choices(p.choices);
  return s && c ? { ...base, settings: s, choices: c } : undefined;
}
