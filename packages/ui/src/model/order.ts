// Worlds in Foundry's own order (SetupPackages#sortWorlds in V14): favourites first,
// then the most recently played, then worlds never played (or with an unreadable date),
// then by title in the page's language. Used everywhere the new Setup page lists worlds.
import type { WorldInfo } from "@stagehand/shared/world";

const playedAt = (w: WorldInfo): number | undefined => {
  const t = Date.parse(w.lastPlayed ?? "");
  return Number.isFinite(t) ? t : undefined;
};

export function worldOrder<T extends WorldInfo>(
  worlds: readonly T[],
  lang?: string,
): T[] {
  return [...worlds].sort((a, b) => {
    const fav = Number(b.favorite === true) - Number(a.favorite === true);
    if (fav !== 0) return fav;
    const pa = playedAt(a),
      pb = playedAt(b);
    if (pa !== undefined && pb === undefined) return -1;
    if (pb !== undefined && pa === undefined) return 1;
    if (pa !== undefined && pb !== undefined && pa !== pb) return pb - pa;
    return a.title.localeCompare(b.title, lang === "" ? undefined : lang);
  });
}
