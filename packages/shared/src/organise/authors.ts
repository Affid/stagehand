// Author identity from the standard manifest `authors` field only (A-1).
import type { Author, PackageInfo } from "../package.ts";

export interface AuthorEntry {
  readonly key: string;
  readonly name: string;
  readonly url?: string;
  readonly discord?: string;
  readonly moduleIds: readonly string[];
}

const normaliseUrl = (url: string): string =>
  url
    .trim()
    .toLowerCase()
    .replace(/^[a-z]+:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/+$/, "");

/** Keyed by url, then discord, then normalised name. */
export function authorKey(author: Author): string {
  if (author.url) return `url:${normaliseUrl(author.url)}`;
  if (author.discord) return `discord:${author.discord.trim().toLowerCase()}`;
  return `name:${author.name.trim().replace(/\s+/g, " ").toLowerCase()}`;
}

export const authorsOf = (pkg: PackageInfo): string[] => [
  ...new Set(pkg.authors.filter((a) => a.name || a.url).map(authorKey)),
];

/** One entry per author, with the first-seen name and links. */
export function listAuthors(modules: readonly PackageInfo[]): AuthorEntry[] {
  const entries = new Map<string, AuthorEntry>();
  for (const m of modules) {
    for (const a of m.authors) {
      if (!a.name && !a.url) continue;
      const key = authorKey(a);
      const known = entries.get(key);
      entries.set(
        key,
        known
          ? { ...known, moduleIds: [...new Set([...known.moduleIds, m.id])] }
          : {
              key,
              name: a.name !== "" ? a.name : (a.url ?? key),
              ...(a.url ? { url: a.url } : {}),
              ...(a.discord ? { discord: a.discord } : {}),
              moduleIds: [m.id],
            },
      );
    }
  }
  return [...entries.values()];
}
