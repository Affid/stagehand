// Foundry's version tag on the server page: the same generation is safe,
// an older one warns, a newer one can't be restored here.
import type { Translate } from "../../../i18n.ts";
import type { Tag } from "../../world/backups/BackupRow.tsx";

export type Made = "taken" | "made";

export function versionTag(
  t: Translate,
  build: string | undefined,
  made: Made,
  generation: number | undefined,
  text: string = build ?? "",
): Tag | null {
  if (!build) return null;
  const gen = Number.parseInt(build, 10);
  const params = { build, gen: String(gen), now: String(generation ?? "") };
  if (generation === undefined || !Number.isFinite(gen) || gen === generation)
    return { text, cls: "", tip: t(`sb.tag.same.${made}`, params) };
  return gen < generation
    ? { text, cls: "warn", tip: t(`sb.tag.older.${made}`, params) }
    : { text, cls: "bad", tip: t(`sb.tag.newer.${made}`, params) };
}
