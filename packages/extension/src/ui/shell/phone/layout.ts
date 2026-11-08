// Which layout the Setup page takes (Android plan, phase 3). A touch screen
// goes by orientation: upright, the phone layout at any width; on its side,
// the tablet layout (worlds list on the left) when tall enough, else the
// phone layout. A mouse goes by width: today's desktop layout from 700 px.
import { createContext } from "preact";
import { useContext, useEffect, useState } from "preact/hooks";

export type Layout = "desktop" | "phone" | "tablet";

export interface Viewport {
  readonly width: number;
  readonly height: number;
  /** The primary pointer is a finger (`pointer: coarse`). */
  readonly coarse: boolean;
}

/** A mouse window narrower than this gets the phone layout. */
export const MOUSE_PHONE_BELOW = 700;
/** A touch screen on its side needs this height for the tablet layout. */
export const TABLET_MIN_HEIGHT = 600;

const COARSE = "(pointer: coarse)";

export function layoutFor(v: Viewport): Layout {
  if (!v.coarse) return v.width < MOUSE_PHONE_BELOW ? "phone" : "desktop";
  if (v.height >= v.width) return "phone";
  return v.height >= TABLET_MIN_HEIGHT ? "tablet" : "phone";
}

interface ViewportSource {
  readonly innerWidth: number;
  readonly innerHeight: number;
  readonly matchMedia?: (query: string) => { readonly matches: boolean };
}

export function readViewport(win: ViewportSource): Viewport {
  return {
    width: win.innerWidth,
    height: win.innerHeight,
    coarse: win.matchMedia?.(COARSE).matches ?? false,
  };
}

const TYPING = "input, textarea, select, [contenteditable]";

/** A text field has focus: the on-screen keyboard may be shrinking the page. */
const typing = (doc: Document): boolean =>
  doc.activeElement?.matches(TYPING) === true;

/**
 * The layout now, kept up to date on resizes and pointer changes. While a
 * text field has focus the layout stays: Android's keyboard shrinks the
 * page, and a tablet must not turn into a phone under the user's fingers
 * (review); it catches up when the field loses focus.
 */
export function useViewportLayout(win: Window = window): Layout {
  const [layout, setLayout] = useState(() => layoutFor(readViewport(win)));
  useEffect(() => {
    const update = (): void => {
      if (!typing(win.document)) setLayout(layoutFor(readViewport(win)));
    };
    // After focus has landed: moving from one field to the next isn't a
    // keyboard closing.
    const settle = (): void => {
      win.setTimeout(update, 0);
    };
    const pointer = win.matchMedia(COARSE);
    win.addEventListener("resize", update);
    win.document.addEventListener("focusout", settle);
    pointer.addEventListener("change", update);
    update();
    return () => {
      win.removeEventListener("resize", update);
      win.document.removeEventListener("focusout", settle);
      pointer.removeEventListener("change", update);
    };
  }, [win]);
  return layout;
}

export const LayoutContext = createContext<Layout>("desktop");

/** The layout the shell chose; "desktop" outside it. */
export function useLayout(): Layout {
  return useContext(LayoutContext);
}

/** The phone or tablet layout: one page at a time, a tab bar, sheets. */
export const isCompact = (layout: Layout): boolean => layout !== "desktop";
