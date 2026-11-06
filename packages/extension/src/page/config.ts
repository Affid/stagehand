// Foundry's configuration through its own model, as its Application
// Configuration window does (foundry.mjs, ServerSettingsConfig): validate
// with game.serverSettings.updateSource, post "adminConfigure" with only
// what changed, and report whether a restart is needed. Reading returns an
// allow-list (page-config.ts EDITABLE): never the password hash, salt or keys.
import {
  type Choice,
  type Choices,
  type ConfigRequest,
  EDITABLE,
  type ReadOnly,
  type SettingChanges,
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
  post?: (data: object) => Promise<unknown>;
}

export interface ConfigResult {
  readonly settings?: Settings & ReadOnly;
  readonly choices?: Choices;
  readonly restart?: boolean;
  readonly error?: string;
}

/** Defaults Foundry's model uses when a value is missing. */
const DEFAULT_TEXT: Readonly<Record<string, string>> = {
  language: "en.core",
  cssTheme: "dark",
  updateChannel: "stable",
};
const MAX_TEXT = 255;

function value(kind: string, key: string, v: unknown): unknown {
  switch (kind) {
    case "bool":
      return v === true;
    case "text":
      return typeof v === "string" && v
        ? v.slice(0, MAX_TEXT)
        : DEFAULT_TEXT[key];
    case "optText":
      return typeof v === "string" ? v.slice(0, MAX_TEXT) : null;
    case "port":
      return Number.isInteger(v) ? v : 30000;
    default:
      return Number.isInteger(v) ? v : null;
  }
}

function read(
  game: ConfigGame & Pick<NonNullable<PageGlobals["game"]>, "data">,
): Settings & ReadOnly {
  const source = game.serverSettings?._source ?? {};
  const editable = Object.fromEntries(
    Object.entries(EDITABLE).map(([k, kind]) => [k, value(kind, k, source[k])]),
  ) as unknown as Settings;
  return {
    ...editable,
    passwordSet: Boolean(game.data?.options?.adminPassword),
    dataPath: typeof source.dataPath === "string" ? source.dataPath : "",
  };
}

function choices(page: Pick<PageGlobals, "game" | "CONST">): Choices {
  const game = page.game as (PageGlobals["game"] & ConfigGame) | undefined;
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
    languages: (game?.data?.languages ?? []).flatMap((l) =>
      l.modules.map((m) => ({
        value: `${l.id}.${m.id}`,
        label: `${l.label} - ${m.label}`,
      })),
    ),
    themes: fromConst(page.CONST?.CSS_THEMES),
    channels: fromConst(page.CONST?.SOFTWARE_UPDATE_CHANNELS),
  };
}

async function save(
  game: ConfigGame,
  changes: SettingChanges,
): Promise<boolean> {
  const model = game.serverSettings;
  if (!model || !game.post)
    throw new Error("Foundry's configuration is not available");
  const original = model.toObject();
  const diff = model.updateSource(changes);
  if (Object.keys(diff).length === 0) return false;
  try {
    const response = (await game.post({
      action: "adminConfigure",
      config: diff,
    })) as { restart?: boolean } | undefined;
    return response?.restart === true;
  } catch (e: unknown) {
    model.updateSource(original);
    throw e;
  }
}

export async function runConfig(
  page: Pick<PageGlobals, "game" | "CONST">,
  req: ConfigRequest,
): Promise<ConfigResult> {
  const game = page.game as (PageGlobals["game"] & ConfigGame) | undefined;
  if (!game?.serverSettings)
    return { error: "Foundry's configuration is not available" };
  try {
    const restart =
      req.op === "save" ? await save(game, req.changes) : undefined;
    return {
      settings: read(game),
      choices: choices(page),
      ...(restart === undefined ? {} : { restart }),
    };
  } catch (e: unknown) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}
