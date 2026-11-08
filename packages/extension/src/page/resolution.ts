// Foundry's "requires a window of 1024×768" notice, taken away while the new
// Setup page is in its phone or tablet layout (Android plan, phase 3): that
// layout is made for the small window. Foundry raises the notice at load and
// again after each resize (client-issues.mjs, ERROR.RESOLUTION.*); it is the
// permanent notification whose text is the formatted issue.
import type { PageGlobals } from "./globals.ts";

const AREA = "notifications";
const PERMANENT = "li.notification.permanent";

const plain = (text: string): string => text.replace(/\s+/g, " ").trim();

const isRecord = (v: unknown): v is Readonly<Record<string, unknown>> =>
  typeof v === "object" && v !== null;

/** The notice's text as Foundry formats it, while Foundry reports the issue. */
function noticeText(page: PageGlobals): string | undefined {
  const issue = page.game?.issues?.usabilityIssues?.resolutionTooLow;
  if (!isRecord(issue) || typeof issue.message !== "string") return undefined;
  const params = isRecord(issue.params) ? issue.params : {};
  const text = page.game?.i18n?.format?.(issue.message, params);
  return typeof text === "string" && text ? plain(text) : undefined;
}

function removeNotice(page: PageGlobals, doc: Document): void {
  const text = noticeText(page);
  // Called on Foundry's object: remove reads its private queue through `this`.
  const notifications = page.ui?.notifications;
  if (!text || !notifications?.remove) return;
  const shown = doc.getElementById(AREA)?.querySelectorAll(PERMANENT) ?? [];
  for (const li of shown) {
    const id = Number((li as HTMLElement).dataset.id);
    if (id > 0 && plain(li.textContent) === text) notifications.remove(id);
  }
}

/** Removes the notice now and whenever it comes back; returns the stop. */
export function hideResolutionNotice(
  page: PageGlobals,
  doc: Document,
): () => void {
  removeNotice(page, doc);
  const area = doc.getElementById(AREA);
  if (!area) return () => undefined;
  // One check per burst of changes, whatever the page does to the list.
  let queued = false;
  const watch = new MutationObserver(() => {
    if (queued) return;
    queued = true;
    queueMicrotask(() => {
      queued = false;
      removeNotice(page, doc);
    });
  });
  watch.observe(area, { childList: true });
  return () => {
    watch.disconnect();
  };
}
