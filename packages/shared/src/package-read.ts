// Reads package data from Foundry's live package objects (or plain data)
// defensively. Kept free of Zod so the Setup page script stays small.
import type {
  Author,
  Compatibility,
  PackageInfo,
  Relation,
} from "./package.ts";

type Loose = Record<string, unknown>;

const asLoose = (v: unknown): Loose =>
  typeof v === "object" && v !== null ? (v as Loose) : {};

const items = (v: unknown): Loose[] =>
  v && typeof v === "object" && Symbol.iterator in v
    ? [...(v as Iterable<unknown>)].map(asLoose)
    : [];

const size = (v: unknown): number => items(v).length;

const text = (v: unknown): string | undefined =>
  typeof v === "string" && v !== "" ? v : undefined;

/** Copies only the keys whose value is defined (exactOptionalPropertyTypes). */
function defined<T extends Loose>(obj: T): T {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined),
  ) as T;
}

function compatibility(v: unknown): Compatibility {
  const c = asLoose(v);
  return defined({
    minimum: text(c.minimum),
    verified: text(c.verified),
    maximum: text(c.maximum),
  });
}

function relation(r: Loose): Relation {
  const compat = compatibility(r.compatibility);
  return defined({
    id: String(r.id),
    type: String(r.type),
    compatibility: Object.keys(compat).length > 0 ? compat : undefined,
    reason: text(r.reason),
  });
}

const author = (a: Loose): Author =>
  defined({
    name: text(a.name) ?? "",
    url: text(a.url),
    discord: text(a.discord),
  });

/** Reads a Foundry Module/System object (or its plain data) defensively. */
export function toPackageInfo(pkg: unknown): PackageInfo {
  const p = asLoose(pkg);
  const rel = asLoose(p.relationships);
  return defined({
    id: String(p.id),
    title: String(p.title ?? p.id),
    version: text(p.version) ?? "",
    authors: items(p.authors).map(author),
    url: text(p.url),
    bugs: text(p.bugs),
    library: p.library === true,
    hasPacks: size(p.packs) > 0,
    hasCode: size(p.esmodules) + size(p.scripts) + size(p.styles) > 0,
    compatibility: compatibility(p.compatibility),
    requires: items(rel.requires).map(relation),
    recommends: items(rel.recommends).map(relation),
    conflicts: items(rel.conflicts).map(relation),
    systems: items(rel.systems).map(relation),
  });
}
