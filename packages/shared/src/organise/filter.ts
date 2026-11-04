// Search and filters over installed modules (S-3, S-4, S-7).
import type { Library, ModuleFilterSpec } from "../library/schema.ts";
import type { PackageInfo } from "../package.ts";
import { authorsOf } from "./authors.ts";

function haystack(m: PackageInfo, library: Library): string {
  const meta = library.modules[m.id];
  const tagNames = (meta?.tags ?? []).map(
    (id) => library.tags.find((t) => t.id === id)?.name ?? "",
  );
  return [
    m.title,
    m.id,
    ...m.authors.map((a) => a.name),
    ...tagNames,
    meta?.note ?? "",
  ]
    .join("\n")
    .toLowerCase();
}

function matchesText(m: PackageInfo, library: Library, text: string): boolean {
  const words = text.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const hay = haystack(m, library);
  return words.every((w) => hay.includes(w));
}

function matchesTags(
  m: PackageInfo,
  library: Library,
  f: ModuleFilterSpec,
): boolean {
  if (f.tags.length === 0) return true;
  const own = library.modules[m.id]?.tags ?? [];
  return f.tagOp === "and"
    ? f.tags.every((t) => own.includes(t))
    : f.tags.some((t) => own.includes(t));
}

function matchesAuthors(m: PackageInfo, f: ModuleFilterSpec): boolean {
  if (f.authors.length === 0) return true;
  const own = authorsOf(m);
  return f.authors.some((a) => own.includes(a));
}

export function filterModules(
  modules: readonly PackageInfo[],
  library: Library,
  filter: ModuleFilterSpec,
): PackageInfo[] {
  return modules.filter(
    (m) =>
      matchesText(m, library, filter.text) &&
      matchesTags(m, library, filter) &&
      matchesAuthors(m, filter),
  );
}
