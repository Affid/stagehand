// The UI's link to the Setup page's own world: Foundry windows, the world
// card menu and notifications. Messages go over window.postMessage.
import { isEnvelope, makeEnvelope } from "@module-library/shared/protocol";
import {
  type MenuLabels,
  type NoticeKind,
  type PageToUi,
  parsePageToUi,
  type UiToPage,
  type WindowSpec,
  windowHostId,
} from "../page-protocol.ts";

export interface PageBridge {
  notify(kind: NoticeKind, text: string): void;
  openWindow(spec: WindowSpec): void;
  closeWindow(id: string): void;
  setMenu(labels: MenuLabels | null, worldCard: string): void;
  /** Our host element inside an open Foundry window, if it is there. */
  windowHost(id: string): HTMLElement | null;
  subscribe(fn: (event: PageToUi) => void): () => void;
}

/** NOTIFY's limit; longer text is cut rather than dropped. */
const MAX_NOTICE = 2000;

const clip = (text: string): string =>
  text.length > MAX_NOTICE ? `${text.slice(0, MAX_NOTICE - 1)}…` : text;

export function createPageBridge(win: Window): PageBridge {
  const listeners = new Set<(event: PageToUi) => void>();
  const send = (m: UiToPage): void => {
    win.postMessage(
      makeEnvelope("setup-ui", m.type, m.payload),
      win.location.origin,
    );
  };
  win.addEventListener("message", (event: MessageEvent<unknown>) => {
    if (event.source !== win || event.origin !== win.location.origin) return;
    if (!isEnvelope(event.data, "setup-main")) return;
    const m = parsePageToUi(event.data.type, event.data.payload);
    if (m)
      listeners.forEach((fn) => {
        fn(m);
      });
  });
  return {
    notify: (kind, text) => {
      if (text) send({ type: "NOTIFY", payload: { kind, text: clip(text) } });
    },
    openWindow: (spec) => {
      send({ type: "WINDOW_OPEN", payload: spec });
    },
    closeWindow: (id) => {
      send({ type: "WINDOW_CLOSE", payload: { id } });
    },
    setMenu: (labels, worldCard) => {
      send({ type: "MENU", payload: { labels, worldCard } });
    },
    windowHost: (id) => {
      const host = win.document.getElementById(windowHostId(id));
      // Only ever render into a host inside a Foundry window.
      return host?.closest(".application.ml-window") ? host : null;
    },
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}
