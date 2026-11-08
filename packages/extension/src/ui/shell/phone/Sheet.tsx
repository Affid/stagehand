// A sheet in the phone and tablet layouts (mockup: _phone.js phPanelBar,
// phSheetDrag): the details, Tags, Presets, New modules and system panels
// slide up from the bottom on a phone (dragged down by their top, or a tap
// outside, to close) and in from the right on a tablet. The page behind is
// inert while one is open (PhoneShell); Back closes it (nav.ts).
import type { ComponentChildren } from "preact";
import { useEffect, useLayoutEffect, useRef } from "preact/hooks";
import type { Layout } from "./layout.ts";
import { usePopupOpen } from "./popups.ts";

/** How far a sheet must be dragged down to close (mockup: 110 px). */
export const DRAG_CLOSE_PX = 110;
const GRAB = ".mlp-grab, .mls-panel > h2.divider";

interface Drag {
  y0: number;
  id: number;
}

function useDrag(
  box: { readonly current: HTMLDivElement | null },
  onClose: () => void,
  on: boolean,
) {
  const drag = useRef<Drag | null>(null);
  const move = (dy: number, settle: boolean): void => {
    const el = box.current;
    if (!el) return;
    el.style.transition = settle ? "" : "none";
    el.style.transform = dy > 0 ? `translateY(${String(dy)}px)` : "";
  };
  return {
    onPointerDown: (e: PointerEvent) => {
      const target = e.target instanceof Element ? e.target : null;
      if (!on || !target?.closest(GRAB) || target.closest("button")) return;
      drag.current = { y0: e.clientY, id: e.pointerId };
      box.current?.setPointerCapture(e.pointerId);
    },
    onPointerMove: (e: PointerEvent) => {
      if (drag.current?.id === e.pointerId)
        move(e.clientY - drag.current.y0, false);
    },
    onPointerUp: (e: PointerEvent) => {
      const d = drag.current;
      if (d?.id !== e.pointerId) return;
      drag.current = null;
      // Closing: it leaves from where it was dragged, not from the top.
      if (e.clientY - d.y0 > DRAG_CLOSE_PX) onClose();
      else move(0, true);
    },
    onPointerCancel: () => {
      drag.current = null;
      move(0, true);
    },
  };
}

/**
 * Focus moves into the sheet when it opens and back to what opened it when
 * it closes; the sheet takes its name from the panel inside.
 */
function useSheetFocus(box: { readonly current: HTMLDivElement | null }) {
  // A layout effect: it runs before PhoneShell makes the page inert, which
  // would take the focus off the opener first.
  useLayoutEffect(() => {
    const opener =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    box.current?.focus();
    return () => {
      // After the page behind stops being inert (PhoneShell's layout effect).
      window.requestAnimationFrame(() => {
        if (opener?.isConnected && !opener.closest("[inert]")) opener.focus();
      });
    };
  }, [box]);
  useEffect(() => {
    const el = box.current;
    const name = el?.querySelector("[aria-label]")?.getAttribute("aria-label");
    if (el && name) el.setAttribute("aria-label", name);
  });
}

export function Sheet(props: {
  readonly layout: Layout;
  readonly onClose: () => void;
  readonly children: ComponentChildren;
}) {
  const box = useRef<HTMLDivElement>(null);
  const phone = props.layout === "phone";
  const drag = useDrag(box, props.onClose, phone);
  const popup = usePopupOpen(box);
  useSheetFocus(box);
  return (
    <>
      {/* A tap that only closed a menu inside the sheet doesn't also close
          the sheet (the menu's scrim lingers past its click; review). */}
      <div
        class="mlp-scrim"
        aria-hidden="true"
        onClick={() => {
          if (!popup) props.onClose();
        }}
      />
      <div
        ref={box}
        class="mlp-sheet"
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        {...drag}
      >
        {phone ? <span class="mlp-grab" aria-hidden="true" /> : null}
        {props.children}
        {popup ? <div class="mlp-scrim pop" aria-hidden="true" /> : null}
      </div>
    </>
  );
}
