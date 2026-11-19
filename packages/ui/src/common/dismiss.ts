// Closing popups: Escape (focus back on the opener) or a press outside.
import type { RefObject } from "preact";
import { useEffect } from "preact/hooks";

/**
 * Closes a popup on Escape (focus back on its button) or on a press outside
 * `wrap`. Escape stops here, so Foundry doesn't also act on it, and is
 * marked handled (the phone layout's Back leaves it alone).
 */
export function useDismiss(
  open: boolean,
  close: (refocus: boolean) => void,
  wrap: RefObject<HTMLElement | null>,
): void {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopPropagation();
      close(true);
    };
    const onDown = (e: PointerEvent): void => {
      if (!wrap.current?.contains(e.target as Node)) close(false);
    };
    document.addEventListener("keydown", onKey, true);
    document.addEventListener("pointerdown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [open, close, wrap]);
}
