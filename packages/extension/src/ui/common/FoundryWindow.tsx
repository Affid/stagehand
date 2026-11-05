// A real Foundry window around our content: Foundry draws the frame, title
// bar, dragging, resizing and closing; we render into its body. If the page
// can't open one (a Foundry change), the content shows in our own modal.
import type { ComponentChildren } from "preact";
import { createPortal } from "preact/compat";
import { useEffect, useRef, useState } from "preact/hooks";
import { useUi } from "../context.ts";
import { Modal } from "./widgets.tsx";

/** How long to wait for Foundry's window before using our modal. */
export const FALLBACK_MS = 1500;
const EDGE = 40;

/** Foundry centres the window; it is clamped to the screen. */
export interface WindowSize {
  readonly width: number;
  readonly height: number;
}

let opened = 0;
/** Per page load, so a page script can't predict our host ids. */
const NONCE = [...crypto.getRandomValues(new Uint8Array(4))]
  .map((b) => b.toString(16).padStart(2, "0"))
  .join("");

function spec(id: string, title: string, icon: string, size: WindowSize) {
  const height = Math.min(size.height, window.innerHeight - EDGE * 2);
  const width = Math.min(size.width, window.innerWidth - EDGE);
  return { id, title, icon, width, height };
}

/** Opens the window on mount and closes it on unmount. */
function useFoundryWindow(
  key: string,
  title: string,
  icon: string,
  size: WindowSize,
  onClose: () => void,
) {
  const { page } = useUi();
  const [id] = useState(() => `${key}-${NONCE}-${String(++opened)}`);
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [fallback, setFallback] = useState(false);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  // Once our modal shows, a late Foundry window would reset the form.
  const usingModal = useRef(false);
  useEffect(() => {
    const toModal = (): void => {
      usingModal.current = true;
      setFallback(true);
    };
    const timer = setTimeout(toModal, FALLBACK_MS);
    const stop = page.subscribe((e) => {
      if (e.type === "MENU_ACTION" || e.payload.id !== id) return;
      if (e.type === "WINDOW_CLOSED") closeRef.current();
      else if (usingModal.current) page.closeWindow(id);
      else {
        clearTimeout(timer);
        const found = page.windowHost(id);
        if (found) setHost(found);
        else toModal();
      }
    });
    page.openWindow(spec(id, title, icon, size));
    return () => {
      clearTimeout(timer);
      stop();
      page.closeWindow(id);
    };
    // Opened once per mount; a new world or preset remounts with a new key.
  }, []);
  return { host, fallback: fallback && host === null };
}

export function FoundryWindow(props: {
  /** Kind of window, such as "apply" or "sheet". */
  readonly kind: string;
  readonly title: string;
  readonly icon: string;
  readonly size: WindowSize;
  readonly onClose: () => void;
  readonly children: ComponentChildren;
  readonly footer?: ComponentChildren;
}) {
  const { host, fallback } = useFoundryWindow(
    props.kind,
    props.title,
    props.icon,
    props.size,
    props.onClose,
  );
  if (host)
    return createPortal(
      <div class={`ml-win-body ml-win-${props.kind}`}>
        <div class="ml-win-main">{props.children}</div>
        {props.footer ? (
          <footer class="ml-win-footer">{props.footer}</footer>
        ) : null}
      </div>,
      host,
    );
  if (!fallback) return null;
  return (
    <Modal title={props.title} onClose={props.onClose} footer={props.footer}>
      <div class={`ml-win-body ml-win-${props.kind}`}>{props.children}</div>
    </Modal>
  );
}
