// Text fields on Foundry's pages in the Android app (owner, 2026-11-09).
// Foundry's game.mjs blocks the context menu on the whole document, which
// in a WebView is also where a long press offers Paste; in a text field we
// let the menu through. And Foundry's password fields carry no autocomplete
// hint, which password managers fill by.

const TEXT_FIELD =
  'textarea, [contenteditable=""], [contenteditable="true"], [contenteditable="plaintext-only"], input:not([type]), input[type="text"], input[type="password"], input[type="search"], input[type="email"], input[type="url"], input[type="number"], input[type="tel"]';

/**
 * A long press in a text field shows the system's menu (Paste, Select all):
 * the event stops at the window, before Foundry's document-wide block.
 * Everywhere else Foundry's own menus behave as before. Returns the stop.
 */
export function allowTextMenus(win: Window): () => void {
  const onMenu = (e: Event): void => {
    const target = e.target as Partial<Element> | null;
    if (typeof target?.closest !== "function") return;
    if (target.closest(TEXT_FIELD)) e.stopImmediatePropagation();
  };
  win.addEventListener("contextmenu", onMenu, { capture: true });
  return () => {
    win.removeEventListener("contextmenu", onMenu, { capture: true });
  };
}

const PASSWORDS =
  'input[type="password"][name="adminPassword"], #join-game-form input[type="password"][name="password"]';

function hint(doc: Document): void {
  for (const input of doc.querySelectorAll(PASSWORDS))
    if (!input.hasAttribute("autocomplete"))
      input.setAttribute("autocomplete", "current-password");
}

/** How long after the page has loaded the fields are still looked for. */
const AFTER_LOAD_MS = 3000;

/**
 * Foundry's admin and join passwords marked as current passwords, now and
 * as they appear (the page builds them after document start), until a
 * moment after the page has loaded. Returns the stop.
 */
export function hintPasswords(doc: Document): () => void {
  hint(doc);
  const watch = new MutationObserver(() => {
    hint(doc);
  });
  // The document itself: at document start it may have no root yet (review).
  watch.observe(doc, { childList: true, subtree: true });
  const win = doc.defaultView;
  const stop = (): void => {
    watch.disconnect();
  };
  const later = (): void => {
    win?.setTimeout(stop, AFTER_LOAD_MS);
  };
  if (doc.readyState === "complete") later();
  else win?.addEventListener("load", later, { once: true });
  return stop;
}
