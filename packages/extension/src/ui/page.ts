// The UI's link to the Setup page's own world: Foundry windows, the world
// card menu and notifications. Messages go over window.postMessage.
import { isEnvelope, makeEnvelope } from "@module-library/shared/protocol";
import {
  type FoundryAction,
  type MenuLabels,
  type NoticeKind,
  type PageToUi,
  parsePageToUi,
  type UiToPage,
  type WindowSpec,
  windowHostId,
} from "../page-protocol.ts";
import type { WorldChanges } from "../page-save.ts";

export interface PageBridge {
  notify(kind: NoticeKind, text: string): void;
  openWindow(spec: WindowSpec): void;
  closeWindow(id: string): void;
  setMenu(labels: MenuLabels | null, worldCard: string): void;
  /** Take over Foundry's Setup layout, or give it back; the answer arrives as SHELL_STATE. */
  setShell(on: boolean): void;
  foundryAction(action: FoundryAction): void;
  /** Saves a world's details through Foundry; resolves with an error, or undefined. */
  saveWorld(
    worldId: string,
    changes: WorldChanges,
  ): Promise<string | undefined>;
  /** Our host element inside an open Foundry window, if it is there. */
  windowHost(id: string): HTMLElement | null;
  subscribe(fn: (event: PageToUi) => void): () => void;
}

/** A save goes to Foundry's server; longer than this is a failure. */
const SAVE_TIMEOUT_MS = 20_000;

const newRequestId = (): string =>
  [...crypto.getRandomValues(new Uint8Array(12))]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

/** NOTIFY's limit; longer text is cut rather than dropped. */
const MAX_NOTICE = 2000;

const clip = (text: string): string =>
  text.length > MAX_NOTICE ? `${text.slice(0, MAX_NOTICE - 1)}…` : text;

/** One SAVE_WORLD, settled by the SAVE_DONE with its id or by the timeout. */
function requestSave(
  send: (m: UiToPage) => void,
  listeners: Set<(event: PageToUi) => void>,
  worldId: string,
  changes: WorldChanges,
): Promise<string | undefined> {
  return new Promise((resolve) => {
    const requestId = newRequestId();
    const finish = (error: string | undefined): void => {
      clearTimeout(timer);
      listeners.delete(onReply);
      resolve(error);
    };
    const onReply = (e: PageToUi): void => {
      if (e.type === "SAVE_DONE" && e.payload.requestId === requestId)
        finish(e.payload.error);
    };
    const timer = setTimeout(() => {
      finish("Foundry did not answer in time.");
    }, SAVE_TIMEOUT_MS);
    listeners.add(onReply);
    send({ type: "SAVE_WORLD", payload: { requestId, worldId, changes } });
  });
}

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
    setShell: (on) => {
      send({ type: "SHELL", payload: { on } });
    },
    foundryAction: (action) => {
      send({ type: "FOUNDRY_ACTION", payload: action });
    },
    saveWorld: (worldId, changes) =>
      requestSave(send, listeners, worldId, changes),
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
