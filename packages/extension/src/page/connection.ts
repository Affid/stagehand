// Foundry's notices about its own connection, taken away in the app
// (owner, 2026-11-11). Android drops the page's socket while the app is in
// the background; back in front, Foundry said "lost connection", then
// "re-established", then reloaded the page (client/game.mjs, the socket's
// disconnect and reconnect). The reload stays; when Foundry gives up
// instead, native shows our unreachable screen. The texts are Foundry's
// own English, the same in 13 and 14 (it doesn't translate them).
import type { PageGlobals } from "./globals.ts";
import { hideNotices } from "./notices.ts";

const LOST =
  "You have lost connection to the server, attempting to re-establish.";
/** After Foundry's name (CONST.vtt) and a bar. */
const NAMED = /^[^|]{1,60} \| Server connection (re-established|lost)\.$/;

/** Removes them now and whenever Foundry raises them; returns the stop. */
export function hideConnectionNotices(
  page: PageGlobals,
  doc: Document,
): () => void {
  return hideNotices(
    page,
    doc,
    (_li, text) => text === LOST || NAMED.test(text),
  );
}
