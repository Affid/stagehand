// Foundry's "uses modern JavaScript features which are unsupported on
// Chromium version less than 146" notice, taken away in the app (owner,
// 2026-11-11): a permanent red notice over our page, and the app says the
// same itself when it starts (web/SupportNotice.kt, once per WebView
// version). Foundry raises it at load (client-issues.mjs,
// ERROR.BrowserVersion); it is told by Foundry's own translation, whatever
// the browser and versions in it.
import type { PageGlobals } from "./globals.ts";
import { hideNotices, plainText } from "./notices.ts";

const KEY = "ERROR.BrowserVersion";
/** Stands for the browser and the versions in Foundry's sentence. */
const GAP = "\u0001";
const escapeRegExp = (text: string): string =>
  text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Foundry's sentence with anything short where the names and versions go. */
function noticePattern(page: PageGlobals): RegExp | undefined {
  const text = page.game?.i18n?.format?.(KEY, {
    browser: GAP,
    version: GAP,
    minimum: GAP,
  });
  if (typeof text !== "string" || !text.includes(GAP)) return undefined;
  const parts = plainText(text).split(GAP).map(escapeRegExp);
  return new RegExp(`^${parts.join("[^\\s]{1,40}")}$`);
}

/** Removes the notice now and whenever it comes back; returns the stop. */
export function hideBrowserNotice(
  page: PageGlobals,
  doc: Document,
): () => void {
  let pattern: RegExp | undefined;
  return hideNotices(page, doc, (li, text) => {
    if (!li.classList.contains("permanent")) return false;
    // Foundry's translations come after document start: asked until there.
    pattern ??= noticePattern(page);
    return pattern?.test(text) === true;
  });
}
