// Foundry's notices that our pages take away (the window-size notice in
// the phone layouts, its connection notices in the app): removed through
// Foundry's own ui.notifications, now and whenever they come back.
import type { PageGlobals } from "./globals.ts";

const AREA = "notifications";

/** A notice's text on one line. */
export const plainText = (text: string): string =>
  text.replace(/\s+/g, " ").trim();

/** Whether a notice (Foundry's `li.notification`) is one to take away. */
export type NoticeMatch = (li: HTMLElement, text: string) => boolean;

function removeNotices(
  page: PageGlobals,
  doc: Document,
  match: NoticeMatch,
): void {
  // Called on Foundry's object: remove reads its private queue through `this`.
  const notifications = page.ui?.notifications;
  if (!notifications?.remove) return;
  const shown =
    doc
      .getElementById(AREA)
      ?.querySelectorAll<HTMLElement>("li.notification") ?? [];
  for (const li of shown) {
    const id = Number(li.dataset.id);
    if (id > 0 && match(li, plainText(li.textContent)))
      notifications.remove(id);
  }
}

/** Watches the notification area: the notices go whenever they come back. */
function watchArea(area: HTMLElement, remove: () => void): () => void {
  // One check per burst of changes, whatever the page does to the list.
  let queued = false;
  const watch = new MutationObserver(() => {
    if (queued) return;
    queued = true;
    queueMicrotask(() => {
      queued = false;
      remove();
    });
  });
  watch.observe(area, { childList: true });
  return () => {
    watch.disconnect();
  };
}

/**
 * Removes the matching notices now and whenever they come back; returns
 * the stop. Where Foundry adds its notification area later (its login
 * page, or at document start), it waits for the area first.
 */
export function hideNotices(
  page: PageGlobals,
  doc: Document,
  match: NoticeMatch,
): () => void {
  const remove = (): void => {
    removeNotices(page, doc, match);
  };
  remove();
  const area = doc.getElementById(AREA);
  if (area) return watchArea(area, remove);
  let stopArea = (): void => undefined;
  const wait = new MutationObserver(() => {
    const found = doc.getElementById(AREA);
    if (!found) return;
    wait.disconnect();
    remove();
    stopArea = watchArea(found, remove);
  });
  // The document itself: at document start it may have no root yet (review).
  wait.observe(doc, { childList: true, subtree: true });
  return () => {
    wait.disconnect();
    stopArea();
  };
}
