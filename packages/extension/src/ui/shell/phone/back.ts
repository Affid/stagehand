// Android's Back on our Setup page (Android plan, phase 4): native asks the
// page over the bridge ("back"), and the page plays an Escape key press
// that only it can make. Open dialogs and menus take it first (they stop
// Escape), then PhoneShell steps back. A page script's own Escape can't
// pass for it: in a text field only a real key press or ours counts, and
// a real key press there stays the field's (security review, phase 3).

/** The Escape presses made here, unreachable from page scripts. */
const ours = new WeakSet<Event>();

/** Whether `e` is native's Back (not a page script's look-alike). */
export function isNativeBack(e: Event): boolean {
  return ours.has(e);
}

/**
 * Plays Android's Back on the focused element; true when the page used it
 * (a dialog, menu or sheet closed, or a page went back). It stays ours as
 * far as it can: no key code (Foundry's keybindings read `code`, and on
 * the emulator claimed every press), and it stops at the document after
 * our own listeners, so bubbling handlers on the window never see it. A
 * capture-phase listener still could, and claim it; native goes on anyway
 * when Back comes again soon after a claimed one.
 */
export function pressBack(doc: Document): boolean {
  const win = doc.defaultView;
  if (!win) return false;
  const event = new win.KeyboardEvent("keydown", {
    key: "Escape",
    bubbles: true,
    cancelable: true,
  });
  ours.add(event);
  const stop = (e: Event): void => {
    if (e === event) e.stopImmediatePropagation();
  };
  doc.addEventListener("keydown", stop);
  try {
    (doc.activeElement ?? doc.body).dispatchEvent(event);
  } finally {
    doc.removeEventListener("keydown", stop);
  }
  return event.defaultPrevented;
}
