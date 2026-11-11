// Foundry's "requires a window of 1024×768" notice, taken away while the new
// Setup page is in its phone or tablet layout (Android plan, phase 3): that
// layout is made for the small window. Foundry raises the notice at load and
// again after each resize (client-issues.mjs, ERROR.RESOLUTION.*); it is the
// permanent notification whose text is the formatted issue.
import type { PageGlobals } from "./globals.ts";
import { hideNotices, plainText } from "./notices.ts";

const isRecord = (v: unknown): v is Readonly<Record<string, unknown>> =>
  typeof v === "object" && v !== null;

/** The notice's text as Foundry formats it, while Foundry reports the issue. */
function noticeText(page: PageGlobals): string | undefined {
  const issue = page.game?.issues?.usabilityIssues?.resolutionTooLow;
  if (!isRecord(issue) || typeof issue.message !== "string") return undefined;
  const params = isRecord(issue.params) ? issue.params : {};
  const text = page.game?.i18n?.format?.(issue.message, params);
  return typeof text === "string" && text ? plainText(text) : undefined;
}

/**
 * Removes the notice now and whenever it comes back; returns the stop
 * (notices.ts).
 */
export function hideResolutionNotice(
  page: PageGlobals,
  doc: Document,
): () => void {
  return hideNotices(
    page,
    doc,
    (li, text) =>
      li.classList.contains("permanent") && text === noticeText(page),
  );
}
