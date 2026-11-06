// Reads package data from Foundry's live package objects (or plain data)
// defensively. Kept free of Zod so the Setup page script stays small.
import {
  type Author,
  type Compatibility,
  MAX_DESCRIPTION,
  MAX_LABEL,
  MAX_LINK,
  MAX_LIST,
  type PackageInfo,
  type Relation,
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

const ENTITIES: Readonly<Record<string, string>> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

const MAX_CODE_POINT = 0x10ffff;

/** A numeric entity's character; a space for one out of range (review). */
function codePoint(digits: string): string {
  const n = Number(digits);
  return Number.isInteger(n) && n > 0 && n <= MAX_CODE_POINT
    ? String.fromCodePoint(n)
    : " ";
}

/** A manifest's HTML description as plain text for a card line. */
export function plainText(html: unknown): string | undefined {
  if (typeof html !== "string") return undefined;
  const plain = html
    .replace(/<[^>]*>/g, " ")
    .replace(/&(#\d+|[a-z]+);/gi, (m, e: string) =>
      e.startsWith("#")
        ? codePoint(e.slice(1))
        : (ENTITIES[e.toLowerCase()] ?? m),
    )
    .replace(/\s+/g, " ")
    .trim();
  return plain ? plain.slice(0, MAX_DESCRIPTION) : undefined;
}

const link = (v: unknown): string | undefined =>
  text(v) && String(v).length <= MAX_LINK ? String(v) : undefined;

/** Labels of a list (packs, languages): bounded, blanks dropped. */
function labels(v: unknown, key: string): string[] | undefined {
  const list = items(v)
    .map((x) => text(x[key]) ?? "")
    .filter(Boolean)
    .map((x) => x.slice(0, MAX_LABEL))
    .slice(0, MAX_LIST);
  return list.length ? list : undefined;
}

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
    description: plainText(p.description),
    favorite: p.favorite === true ? true : undefined,
    locked: p.locked === true ? true : undefined,
    readme: link(p.readme),
    changelog: link(p.changelog),
    license: link(p.license),
    packs: labels(p.packs, "label"),
    languages: labels(p.languages, "name"),
  });
}
