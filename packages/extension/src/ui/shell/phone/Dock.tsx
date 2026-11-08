// The dock: the bar just above the tab bar in the phone and tablet layouts,
// where a page puts what a thumb should reach (a world's Launch, the
// Library's selection, Backups' New snapshot, Configuration's Save). On the
// desktop the same content renders where the page puts it.
// createPortal from Preact's core: importing preact/compat would turn every
// onBlur and onFocus in the page into focusout and focusin.
import { type ComponentChildren, createContext, createPortal } from "preact";
import { useContext } from "preact/hooks";

/**
 * undefined: no dock (the desktop), render in place; null: the dock isn't
 * on the page yet, render nothing; an element: render into it.
 */
export const DockContext = createContext<HTMLElement | null | undefined>(
  undefined,
);

/** Whether the page is in a layout with a dock. */
export function useDocked(): boolean {
  return useContext(DockContext) !== undefined;
}

export function Docked(props: { readonly children: ComponentChildren }) {
  const host = useContext(DockContext);
  if (host === undefined) return <>{props.children}</>;
  if (host === null) return null;
  return createPortal(<>{props.children}</>, host);
}
