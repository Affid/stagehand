// A suggestion for a new module: file it like its family. Its family is the
// module it needs, else the installed module whose id it extends
// ("modular-av-livekit-krisp" extends "modular-av-livekit").
import type { PackageInfo } from "@module-library/shared/package";
import type { Library } from "@module-library/shared/library/schema";

export interface Suggestion {
  readonly from: PackageInfo;
  /** "needs" or "family", for the sentence. */
  readonly why: "needs" | "family";
  readonly folderId: string | null;
  readonly tags: readonly string[];
}

function relative(
  pkg: PackageInfo,
  all: readonly PackageInfo[],
  skip: ReadonlySet<string>,
): { readonly p: PackageInfo; readonly why: Suggestion["why"] } | undefined {
  const usable = all.filter((m) => m.id !== pkg.id && !skip.has(m.id));
  const needed = pkg.requires
    .map((r) => usable.find((m) => m.id === r.id))
    .find((m) => m !== undefined);
  if (needed) return { p: needed, why: "needs" };
  const family = usable
    .filter((m) => pkg.id.startsWith(`${m.id}-`))
    .sort((a, b) => b.id.length - a.id.length)[0];
  return family ? { p: family, why: "family" } : undefined;
}

/** Only a relative that is itself sorted (filed or tagged) suggests anything. */
export function suggestFor(
  pkg: PackageInfo,
  all: readonly PackageInfo[],
  library: Library,
  fresh: ReadonlySet<string>,
): Suggestion | undefined {
  const r = relative(pkg, all, fresh);
  if (!r) return undefined;
  const meta = library.modules[r.p.id];
  const folderId =
    meta?.folderId && library.folders.some((f) => f.id === meta.folderId)
      ? meta.folderId
      : null;
  const tags = (meta?.tags ?? []).filter((id) =>
    library.tags.some((t) => t.id === id),
  );
  if (!folderId && !tags.length) return undefined;
  return { from: r.p, why: r.why, folderId, tags };
}
