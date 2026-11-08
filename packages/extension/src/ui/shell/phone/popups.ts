// Menus and popovers in the phone and tablet layouts open from the bottom
// over a scrim (phone.css). The scrim is ours, not the menu's: a tap on it
// closes the menu (outside its wrapper, so useDismiss closes it) and lands
// on nothing else. A menu inside a sheet gets the sheet's own scrim, since
// the sheet is a layer of its own.
import { useEffect, useState } from "preact/hooks";

export const POPUPS = ".ml-pop, .mlh-menu, .mlw-addmenu";
export const SHEET = ".mlp-sheet";

/**
 * How long the scrim outlives the menu. A finger's tap closes the menu on
 * pointerdown; without the scrim the click that follows would land on the
 * control under it (security review).
 */
export const SCRIM_LINGER_MS = 400;

function popupIn(host: HTMLElement, skip: string | undefined): boolean {
  return [...host.querySelectorAll(POPUPS)].some(
    (el) => skip === undefined || el.closest(skip) === null,
  );
}

/**
 * Whether the scrim should show: a menu or popover is open inside `root`
 * (not inside `skip`), or closed less than SCRIM_LINGER_MS ago. Checked once
 * per frame however much the page changes.
 */
export function usePopupOpen(
  root: { readonly current: HTMLElement | null },
  skip?: string,
): boolean {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const host = root.current;
    if (!host) return undefined;
    let frame = 0;
    let linger = 0;
    const check = (): void => {
      frame = 0;
      if (popupIn(host, skip)) {
        window.clearTimeout(linger);
        linger = 0;
        setOpen(true);
      } else if (!linger) {
        linger = window.setTimeout(() => {
          linger = 0;
          setOpen(popupIn(host, skip));
        }, SCRIM_LINGER_MS);
      }
    };
    const watch = new MutationObserver(() => {
      frame ||= window.requestAnimationFrame(check);
    });
    watch.observe(host, { childList: true, subtree: true });
    setOpen(popupIn(host, skip));
    return () => {
      watch.disconnect();
      window.cancelAnimationFrame(frame);
      window.clearTimeout(linger);
    };
  }, [root, skip]);
  return open;
}
