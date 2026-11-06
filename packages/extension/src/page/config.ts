// Foundry's configuration as its own Application Configuration window runs
// it (foundry.mjs, ServerSettingsConfig): validate with
// game.serverSettings.updateSource, post "adminConfigure" with only what
// changed (a new admin password included, which the server hashes), check
// the current password with "adminPassword", and get or release a
// certificate with "adminGenerateCertificates" / "adminReleaseCertificate".
// Reading returns an allow-list (page-config.ts): never a password or key.
import {
  type Certificate,
  type Choice,
  type Choices,
  type ConfigRequest,
  EDITABLE,
  type ReadOnly,
  type Settings,
} from "../page-config.ts";
import type { PageGlobals } from "./globals.ts";

type Raw = Record<string, unknown>;

interface ConfigGame {
  serverSettings?: {
    readonly _source: Raw;
    toObject(): Raw;
    updateSource(changes: object): Raw;
  };
  post?: (data: object, options?: object) => Promise<unknown>;
  data?: { options?: Raw; certificate?: unknown; languages?: unknown };
}

type Game = NonNullable<PageGlobals["game"]> & ConfigGame;

export interface ConfigResult {
  readonly settings?: Settings & ReadOnly;
  readonly choices?: Choices;
  readonly restart?: boolean;
  readonly passwordOk?: boolean;
  readonly method?: string;
  readonly reason?: string;
  readonly error?: string;
}

/** Defaults Foundry's model uses when a value is missing. */
const DEFAULT_TEXT: Readonly<Record<string, string>> = {
  language: "en.core",
  cssTheme: "dark",
  updateChannel: "stable",
  dataPath: "",
};
const MAX_TEXT = 255;
const MAX_PATH = 4096;
const DEFAULT_PORT = 30000;

function value(kind: string, key: string, v: unknown): unknown {
  const max = key === "dataPath" || key.startsWith("ssl") ? MAX_PATH : MAX_TEXT;
  switch (kind) {
    case "bool":
      return v === true;
    case "text":
      return typeof v === "string" && v ? v.slice(0, max) : DEFAULT_TEXT[key];
    case "optText":
      return typeof v === "string" ? v.slice(0, max) : null;
    default:
      return Number.isInteger(v) ? v : DEFAULT_PORT;
  }
}

const str = (v: unknown): string => (typeof v === "string" ? v : "");

function certificateOf(v: unknown): Certificate {
  const c = (v ?? {}) as Raw;
  return {
    managed: c.managed === true,
    expired: c.expired === true,
    error: typeof c.error === "string" ? c.error.slice(0, 2000) : null,
  };
}

function read(game: Game): Settings & ReadOnly {
  const source = game.serverSettings?._source ?? {};
  const options = game.data?.options ?? {};
  const editable = Object.fromEntries(
    Object.entries(EDITABLE).map(([k, kind]) => [k, value(kind, k, source[k])]),
  ) as unknown as Settings;
  return {
    ...editable,
    // A blank data path can't be saved back; Foundry always has one.
    dataPath: editable.dataPath || str(options.dataPath) || "/",
    passwordSet: Boolean(options.adminPassword),
    running: {
      port: Number.isInteger(options.port)
        ? (options.port as number)
        : DEFAULT_PORT,
      unixSocket:
        typeof options.unixSocket === "string"
          ? options.unixSocket.slice(0, MAX_PATH)
          : null,
      dataPath: str(options.dataPath).slice(0, MAX_PATH),
    },
    proxySSL: options.proxySSL === true,
    noBackups: options.noBackups === true,
    electron: navigator.userAgent.includes("Electron"),
    certificate: certificateOf(game.data?.certificate),
  };
}

function choices(page: Pick<PageGlobals, "game" | "CONST">): Choices {
  const game = page.game as Game | undefined;
  const t = (k: string): string => game?.i18n?.localize?.(k) ?? k;
  const fromConst = (
    o: Readonly<Record<string, string>> | undefined,
  ): Choice[] =>
    Object.entries(o ?? {}).map(([value, key]) => ({ value, label: t(key) }));
  return {
    worlds: [...(game?.worlds?.values() ?? [])].map((w) => {
      const world = w as { id: string; title: string };
      return { value: world.id, label: world.title };
    }),
    languages: (page.game?.data?.languages ?? []).flatMap((l) =>
      l.modules.map((m) => ({
        value: `${l.id}.${m.id}`,
        label: `${l.label} - ${m.label}`,
      })),
    ),
    themes: fromConst(page.CONST?.CSS_THEMES),
    channels: fromConst(page.CONST?.SOFTWARE_UPDATE_CHANNELS),
  };
}

function post(game: Game, data: object): Promise<unknown> {
  if (!game.post) throw new Error("Foundry's configuration is not available");
  return game.post(data, { notify: false });
}

/** As ServerSettingsConfig#onSubmit, with the new password as its form adds it. */
async function save(game: Game, req: ConfigRequest): Promise<boolean> {
  const model = game.serverSettings;
  if (!model) throw new Error("Foundry's configuration is not available");
  const original = model.toObject();
  const wanted = req.password
    ? { ...req.changes, adminPassword: req.password }
    : req.changes;
  const diff = model.updateSource(wanted);
  if (Object.keys(diff).length === 0) return false;
  try {
    const response = (await post(game, {
      action: "adminConfigure",
      config: diff,
    })) as { restart?: boolean } | undefined;
    if (req.password && game.data?.options)
      game.data.options.adminPassword = true;
    return response?.restart === true;
  } catch (e: unknown) {
    model.updateSource(original);
    throw e;
  }
}

/** As ServerSettingsConfig#onChangePassword: Foundry checks the current password. */
async function checkPassword(game: Game, password: string): Promise<boolean> {
  const r = (await post(game, {
    action: "adminPassword",
    adminPassword: password,
  })) as { result?: unknown } | undefined;
  return r?.result === true;
}

/** Remembers the new certificate as Foundry's window does. */
function setCertificate(game: Game, files: Raw, certificate: unknown): void {
  game.serverSettings?.updateSource(files);
  if (game.data?.options) Object.assign(game.data.options, files);
  if (game.data) game.data.certificate = certificate;
}

/** As ServerSettingsConfig#onConfigureSSL, after our own confirm. */
async function generate(game: Game): Promise<ConfigResult> {
  const got = (await post(game, {
    action: "adminGenerateCertificates",
  })) as Raw;
  const files = { sslCert: got.sslCert ?? null, sslKey: got.sslKey ?? null };
  const r = (await post(game, {
    action: "adminConfigure",
    config: files,
  })) as Raw;
  setCertificate(game, files, r.certificate);
  return {
    restart: r.restart === true,
    method: str(got.method).slice(0, MAX_TEXT),
    ...(typeof got.reason === "string"
      ? { reason: got.reason.slice(0, 2000) }
      : {}),
  };
}

/** As ServerSettingsConfig#onReleaseCertificate, after our own confirm. */
async function release(game: Game): Promise<ConfigResult> {
  const files = { sslCert: null, sslKey: null };
  const r = (await post(game, {
    action: "adminConfigure",
    config: files,
  })) as Raw;
  await post(game, { action: "adminReleaseCertificate" });
  setCertificate(game, files, {
    ...((r.certificate ?? {}) as Raw),
    error: null,
  });
  return { restart: r.restart === true };
}

async function apply(game: Game, req: ConfigRequest): Promise<ConfigResult> {
  switch (req.op) {
    case "save":
      return { restart: await save(game, req) };
    case "checkPassword":
      return { passwordOk: await checkPassword(game, req.password ?? "") };
    case "generateCertificate":
      return generate(game);
    case "releaseCertificate":
      return release(game);
    default:
      return {};
  }
}

export async function runConfig(
  page: Pick<PageGlobals, "game" | "CONST">,
  req: ConfigRequest,
): Promise<ConfigResult> {
  const game = page.game as Game | undefined;
  if (!game?.serverSettings)
    return { error: "Foundry's configuration is not available" };
  try {
    const done = await apply(game, req);
    return { ...done, settings: read(game), choices: choices(page) };
  } catch (e: unknown) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}
