// Which page the new Setup page shows, the worlds filter, and world artwork
// made safe for CSS.
import type { WorldInfo } from "@module-library/shared/world";
import { worldOrder } from "../model/order.ts";

export type Route =
  | { readonly kind: "library" }
  | { readonly kind: "world"; readonly worldId: string };

const LIBRARY: Route = { kind: "library" };

/**
 * The page to show: the chosen world while it exists, else the first world
 * in Foundry's order, else the Library.
 */
export function resolveRoute(
  route: Route | null,
  worlds: readonly WorldInfo[],
  lang?: string,
): Route {
  if (route?.kind === "library") return route;
  if (route && worlds.some((w) => w.id === route.worldId)) return route;
  const first = worldOrder(worlds, lang)[0];
  return first ? { kind: "world", worldId: first.id } : LIBRARY;
}

/** Worlds whose title contains the text, ignoring case; blank shows all. */
export function filterWorlds<T extends WorldInfo>(
  worlds: readonly T[],
  text: string,
): readonly T[] {
  const q = text.trim().toLowerCase();
  if (!q) return worlds;
  return worlds.filter((w) => w.title.toLowerCase().includes(q));
}

/**
 * A `url("…")` for one of Foundry's own files. Only same-origin http(s)
 * paths are allowed; the URL parser percent-encodes quotes and spaces, so
 * the value can't leave the url().
 */
export function cssImage(
  path: string | undefined,
  origin: string,
): string | undefined {
  if (!path) return undefined;
  let url: URL;
  try {
    url = new URL(path, `${origin}/`);
  } catch {
    return undefined;
  }
  if (url.origin !== origin) return undefined;
  if (url.protocol !== "http:" && url.protocol !== "https:") return undefined;
  return `url("${url.href.replaceAll('"', "%22")}")`;
}
