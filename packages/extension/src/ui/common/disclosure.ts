// A button that opens a small popover: open state, Escape and outside clicks
// close it (focus goes back to the button), and the first item takes focus.
import { useCallback, useEffect, useRef, useState } from "preact/hooks";
import { useDismiss } from "./dismiss.ts";

export function useDisclosure<W extends HTMLElement = HTMLElement>() {
  const [open, setOpen] = useState(false);
  const wrap = useRef<W>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const first = useRef<HTMLElement | null>(null);
  const close = useCallback((refocus: boolean) => {
    setOpen(false);
    if (refocus) trigger.current?.focus();
  }, []);
  useDismiss(open, close, wrap);
  useEffect(() => {
    if (open) first.current?.focus();
  }, [open]);
  /** Tabbing out of the popover closes it, like a click outside. */
  const onFocusOut = (e: FocusEvent): void => {
    const next = e.relatedTarget as Node | null;
    if (open && !wrap.current?.contains(next)) close(false);
  };
  return { open, setOpen, wrap, trigger, first, close, onFocusOut };
}

const FIRST_CHOICE = "button:not(:disabled), select, input, a[href]";

/**
 * A menu with steps: its first choice takes focus whenever it opens or its
 * step changes, as every menu does (Phase 6).
 */
export function useFocusFirst(
  menu: { readonly current: HTMLElement | null },
  open: boolean,
  step: unknown,
): void {
  useEffect(() => {
    if (open) menu.current?.querySelector<HTMLElement>(FIRST_CHOICE)?.focus();
  }, [open, step]);
}
