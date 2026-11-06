// The server Configuration page: the UI asks with CONFIG (read; save some
// settings and maybe a new admin password; check the current password; get
// or release a certificate); the page world runs it as Foundry's own
// Application Configuration window does and answers CONFIG_DONE. Only an
// allow-list of settings crosses back: never a password, hash, salt or key
// file contents. Checked both ways.
type Loose = Readonly<Record<string, unknown>>;

/** A setting's kind: what the UI edits and what a save may carry. */
type Kind = "bool" | "text" | "optText" | "port";

/** The settings Foundry's own window edits (server-settings-config.hbs), and the update channel. */
export const EDITABLE = {
  adminUsername: "optText",
  dataPath: "text",
  cssTheme: "text",
  world: "optText",
  language: "text",
  port: "port",
  upnp: "bool",
  unixSocket: "optText",
  compressStatic: "bool",
  compressSocket: "bool",
  sslCert: "optText",
  sslKey: "optText",
  awsConfig: "optText",
  fullscreen: "bool",
  telemetry: "bool",
  deleteNEDB: "bool",
  hotReload: "bool",
  updateChannel: "text",
} as const satisfies Record<string, Kind>;

export type SettingKey = keyof typeof EDITABLE;
type ValueOf<K extends Kind> = K extends "bool"
  ? boolean
  : K extends "text"
    ? string
    : K extends "optText"
      ? string | null
      : number;
export type Settings = {
  readonly [K in SettingKey]: ValueOf<(typeof EDITABLE)[K]>;
};
export type SettingChanges = Partial<Settings>;

/** Foundry's certificate state (game.data.certificate). */
export interface Certificate {
  readonly managed: boolean;
  readonly expired: boolean;
  readonly error: string | null;
}

/** What the page shows besides the editable settings. */
export interface ReadOnly {
  /** Whether an admin password is set; the password itself never crosses. */
  readonly passwordSet: boolean;
  /** What Foundry is running with now (saved changes wait for a restart). */
  readonly running: {
    readonly port: number;
    readonly unixSocket: string | null;
    readonly dataPath: string;
  };
  /** HTTPS ends at a reverse proxy: Foundry needs no certificate. */
  readonly proxySSL: boolean;
  /** Backups were turned off when the server started (--noBackups). */
  readonly noBackups: boolean;
  /** Foundry's desktop app (full-screen applies only there). */
  readonly electron: boolean;
  readonly certificate: Certificate;
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

export const CONFIG_OPS = [
  "read",
  "save",
  "checkPassword",
  "generateCertificate",
  "releaseCertificate",
] as const;
export type ConfigOp = (typeof CONFIG_OPS)[number];

export interface ConfigRequest {
  readonly requestId: string;
  readonly op: ConfigOp;
  readonly changes: SettingChanges;
  /** save: the new admin password; checkPassword: the current one. */
  readonly password?: string;
}

export interface ConfigReply {
  readonly requestId: string;
  readonly settings?: Settings & ReadOnly;
  readonly choices?: Choices;
  /** A save that only applies after Foundry restarts. */
  readonly restart?: boolean;
  /** checkPassword: whether Foundry accepted the current password. */
  readonly passwordOk?: boolean;
  /** generateCertificate: Let's Encrypt, or a self-signed fallback and why. */
  readonly method?: string;
  readonly reason?: string;
  readonly error?: string;
}

const REQUEST_ID = /^[a-z0-9-]{1,64}$/i;
const MAX_TEXT = 255;
const MAX_PATH = 4096;
const MAX_PASSWORD = 1000;
const MAX_CHOICES = 2000;
const MAX_ERROR = 2000;

const isObject = (v: unknown): v is Loose =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const isRequestId = (v: unknown): v is string =>
  typeof v === "string" && REQUEST_ID.test(v);
const isText = (v: unknown, max: number): v is string =>
  typeof v === "string" && v.length <= max;

const PATHS: ReadonlySet<string> = new Set([
  "dataPath",
  "sslCert",
  "sslKey",
  "awsConfig",
  "unixSocket",
]);

function valid(key: string, kind: Kind, v: unknown): boolean {
  const max = PATHS.has(key) ? MAX_PATH : MAX_TEXT;
  switch (kind) {
    case "bool":
      return typeof v === "boolean";
    case "text":
      return isText(v, max) && v.length > 0;
    case "optText":
      return v === null || isText(v, max);
    case "port":
      return (
        Number.isInteger(v) && (v as number) >= 1 && (v as number) <= 65535
      );
  }
}

function changes(v: unknown): SettingChanges | undefined {
  const obj = v ?? {};
  if (!isObject(obj)) return undefined;
  for (const k of Object.keys(obj)) {
    const kind = (EDITABLE as Record<string, Kind>)[k];
    if (!kind || !valid(k, kind, obj[k])) return undefined;
  }
  return obj;
}

const isPassword = (v: unknown): v is string =>
  typeof v === "string" && v.length > 0 && v.length <= MAX_PASSWORD;

export function parseConfigRequest(p: Loose): ConfigRequest | undefined {
  if (!isRequestId(p.requestId)) return undefined;
  if (!(CONFIG_OPS as readonly unknown[]).includes(p.op)) return undefined;
  const op = p.op as ConfigOp;
  const c = changes(p.changes);
  if (!c) return undefined;
  const some = Object.keys(c).length > 0;
  const base = { requestId: p.requestId, op };
  if (op === "save") {
    if (p.password !== undefined && !isPassword(p.password)) return undefined;
    if (!some && p.password === undefined) return undefined;
    return {
      ...base,
      changes: c,
      ...(isPassword(p.password) ? { password: p.password } : {}),
    };
  }
  if (some) return undefined;
  if (op === "checkPassword")
    return isPassword(p.password)
      ? { ...base, changes: {}, password: p.password }
      : undefined;
  return p.password === undefined ? { ...base, changes: {} } : undefined;
}

function certificate(v: unknown): Certificate | undefined {
  if (!isObject(v)) return undefined;
  const { managed, expired, error } = v;
  if (typeof managed !== "boolean" || typeof expired !== "boolean")
    return undefined;
  if (error !== null && !isText(error, MAX_ERROR)) return undefined;
  return { managed, expired, error };
}

function readOnly(v: Loose): boolean {
  const r = v.running;
  if (!isObject(r)) return false;
  if (!Number.isInteger(r.port) || !isText(r.dataPath, MAX_PATH)) return false;
  if (r.unixSocket !== null && !isText(r.unixSocket, MAX_PATH)) return false;
  const bools = ["passwordSet", "proxySSL", "noBackups", "electron"];
  return (
    bools.every((k) => typeof v[k] === "boolean") &&
    certificate(v.certificate) !== undefined
  );
}

const READ_ONLY = [
  "passwordSet",
  "running",
  "proxySSL",
  "noBackups",
  "electron",
  "certificate",
];

function settings(v: unknown): (Settings & ReadOnly) | undefined {
  if (!isObject(v)) return undefined;
  const allowed = new Set([...Object.keys(EDITABLE), ...READ_ONLY]);
  if (Object.keys(v).some((k) => !allowed.has(k))) return undefined;
  for (const [k, kind] of Object.entries(EDITABLE) as [SettingKey, Kind][])
    if (!valid(k, kind, v[k])) return undefined;
  return readOnly(v) ? (v as unknown as Settings & ReadOnly) : undefined;
}

function choiceList(v: unknown): Choice[] | undefined {
  if (!Array.isArray(v) || v.length > MAX_CHOICES) return undefined;
  const ok = v.every(
    (c) =>
      isObject(c) && isText(c.value, MAX_TEXT) && isText(c.label, MAX_TEXT),
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

/** The small answers besides the settings: each optional, each checked. */
function extras(p: Loose): Partial<ConfigReply> | undefined {
  const { error, restart, passwordOk, method, reason } = p;
  if (error !== undefined && !isText(error, MAX_ERROR)) return undefined;
  if (restart !== undefined && typeof restart !== "boolean") return undefined;
  if (passwordOk !== undefined && typeof passwordOk !== "boolean")
    return undefined;
  if (method !== undefined && !isText(method, MAX_TEXT)) return undefined;
  if (reason !== undefined && !isText(reason, MAX_ERROR)) return undefined;
  return {
    ...(error === undefined ? {} : { error }),
    ...(restart === undefined ? {} : { restart }),
    ...(passwordOk === undefined ? {} : { passwordOk }),
    ...(method === undefined ? {} : { method }),
    ...(reason === undefined ? {} : { reason }),
  };
}

export function parseConfigReply(p: Loose): ConfigReply | undefined {
  if (!isRequestId(p.requestId)) return undefined;
  const more = extras(p);
  if (!more) return undefined;
  const base = { requestId: p.requestId, ...more };
  if (p.settings === undefined) return base;
  const s = settings(p.settings);
  const c = choices(p.choices);
  return s && c ? { ...base, settings: s, choices: c } : undefined;
}
