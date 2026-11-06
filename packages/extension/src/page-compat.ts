// Foundry's compatibility preview for a release (its "previewCompatibility",
// as its update screen's Compatibility Checker reads it): for each installed
// system, module and world, the newest version Foundry knows and how it
// rates it against the release. Only these fields cross from the page world,
// each checked; never a description.
type Loose = Readonly<Record<string, unknown>>;

export interface CompatEntry {
  readonly id: string;
  readonly title: string;
  /** The newest version Foundry knows for this release; null for a world. */
  readonly version: string | null;
  /** Foundry's PACKAGE_AVAILABILITY_CODES. */
  readonly availability: number;
  readonly verified: string | null;
  readonly maximum: string | null;
  /** The ids it requires. */
  readonly requires: readonly string[];
  /** A world's system. */
  readonly system?: string;
  /** The package's page on foundryvtt.com or its own site. */
  readonly url?: string;
  /** Its changelog, for the newest version. */
  readonly changelog?: string;
}

export interface Preview {
  readonly system: readonly CompatEntry[];
  readonly module: readonly CompatEntry[];
  readonly world: readonly CompatEntry[];
}

const ID = /^[A-Za-z0-9_.-]{1,256}$/;
const VERSION = /^[A-Za-z0-9_.+-]{1,50}$/;
const MAX_TITLE = 300;
const MAX_URL = 500;
const MAX_ENTRIES = 3000;
const MAX_REQUIRES = 100;
/** Foundry's highest code today is 11; a few more leave room. */
const MAX_CODE = 30;

const isObject = (v: unknown): v is Loose =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const isId = (v: unknown): v is string => typeof v === "string" && ID.test(v);
const version = (v: unknown): string | null =>
  typeof v === "string" && VERSION.test(v) ? v : null;
const url = (v: unknown): string | undefined =>
  typeof v === "string" && v.length <= MAX_URL && /^https?:\/\//.test(v)
    ? v
    : undefined;

function requiresOf(v: unknown): string[] {
  const rel = isObject(v) ? v.requires : undefined;
  if (!Array.isArray(rel)) return [];
  return rel
    .map((r: unknown) => (isObject(r) ? r.id : undefined))
    .filter(isId)
    .slice(0, MAX_REQUIRES);
}

/** One entry, from Foundry's package data or from our own reply. */
export function compatEntry(v: unknown): CompatEntry | undefined {
  if (!isObject(v) || !isId(v.id)) return undefined;
  const code = v.availability;
  if (typeof code !== "number" || !Number.isInteger(code)) return undefined;
  if (code < 0 || code > MAX_CODE) return undefined;
  const c = isObject(v.compatibility) ? v.compatibility : {};
  const title =
    typeof v.title === "string" ? v.title.slice(0, MAX_TITLE) : v.id;
  const link = url(v.url);
  const changelog = url(v.changelog);
  const requires = Array.isArray(v.requires)
    ? v.requires.filter(isId).slice(0, MAX_REQUIRES)
    : requiresOf(v.relationships);
  return {
    id: v.id,
    title,
    version: version(v.version),
    availability: code,
    verified: version(c.verified ?? v.verified),
    maximum: version(c.maximum ?? v.maximum),
    requires,
    ...(isId(v.system) ? { system: v.system } : {}),
    ...(link ? { url: link } : {}),
    ...(changelog ? { changelog } : {}),
  };
}

function entries(v: unknown): CompatEntry[] | undefined {
  if (!Array.isArray(v) || v.length > MAX_ENTRIES) return undefined;
  const out = v.map(compatEntry);
  return out.every(Boolean) ? (out as CompatEntry[]) : undefined;
}

/** Foundry's answer, in the page world: an odd entry is left out, not the rest. */
export function readPreview(v: unknown): Preview | undefined {
  if (!isObject(v)) return undefined;
  const pick = (list: unknown): CompatEntry[] =>
    Array.isArray(list)
      ? list
          .slice(0, MAX_ENTRIES)
          .map(compatEntry)
          .filter((e): e is CompatEntry => e !== undefined)
      : [];
  return {
    system: pick(v.system),
    module: pick(v.module),
    world: pick(v.world),
  };
}

/** Our reply, in the UI: all of it checked, or none of it. */
export function parsePreview(v: unknown): Preview | undefined {
  if (!isObject(v)) return undefined;
  const system = entries(v.system);
  const module = entries(v.module);
  const world = entries(v.world);
  return system && module && world ? { system, module, world } : undefined;
}
