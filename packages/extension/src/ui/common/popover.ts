// Closing behaviour for <details> popovers: Escape (focus back on the
// summary) and a pointer press outside.
import { type RefObject } from "preact";
import { useEffect, useRef } from "preact/hooks";

export function closePopover(el: HTMLDetailsElement | null): void {
  el?.removeAttribute("open");
}

export function useDismiss(): RefObject<HTMLDetailsElement | null> {
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key !== "Escape" || !ref.current?.open) return;
      closePopover(ref.current);
      ref.current.querySelector("summary")?.focus();
    };
    const onDown = (e: PointerEvent): void => {
      if (!ref.current?.contains(e.target as Node)) closePopover(ref.current);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, []);
  return ref;
}
