// Runs in the Setup page's own JavaScript world. Posts package data to the
// isolated UI (V-1), and lends it Foundry's own pieces: windows, the
// right-click menu on world cards, and notifications. Every message from the
// UI is checked; anything unexpected is ignored.
import { logError } from "@module-library/shared/log";
import { isEnvelope, makeEnvelope } from "@module-library/shared/protocol";
import {
  type PageToUi,
  parseUiToPage,
  type UiToPage,
} from "../page-protocol.ts";
import { collect } from "../page/collect.ts";
import { pageGlobals } from "../page/globals.ts";
import { installWorldMenu, type MenuConfig } from "../page/menu.ts";
import { createWindowHost, type WindowHost } from "../page/windows.ts";

const page = pageGlobals();
const POLL_MS = 100;
const MAX_POLLS = 300;

function post(type: string, payload: unknown): void {
  window.postMessage(
    makeEnvelope("setup-main", type, payload),
    location.origin,
  );
}

const postToUi = (m: PageToUi): void => {
  post(m.type, m.payload);
};

function postSetupData(): void {
  if (page.game) post("SETUP_DATA", collect(page.game));
}

/** Foundry's toast; it renders HTML, so our text is escaped first. */
function notify(kind: "info" | "warning" | "error", text: string): void {
  const safe = page.foundry?.utils?.escapeHTML?.(text);
  const n = page.ui?.notifications;
  const level = kind === "warning" ? "warn" : kind;
  if (safe !== undefined && n?.[level]) n[level](safe, { console: false });
  else logError("notice", new Error(text));
}

interface Bridge {
  readonly windows: WindowHost | undefined;
  readonly setMenu: ((config: MenuConfig | null) => void) | undefined;
}

function handle(bridge: Bridge, m: UiToPage): void {
  switch (m.type) {
    case "WINDOW_OPEN":
      void bridge.windows?.open(m.payload);
      break;
    case "WINDOW_CLOSE":
      void bridge.windows?.close(m.payload.id);
      break;
    case "NOTIFY":
      notify(m.payload.kind, m.payload.text);
      break;
    case "MENU":
      bridge.setMenu?.(
        m.payload.labels
          ? { labels: m.payload.labels, worldCard: m.payload.worldCard }
          : null,
      );
  }
}

function connect(): void {
  const api = page.foundry?.applications;
  const base = api?.api?.ApplicationV2;
  const menu = api?.ux?.ContextMenu?.prototype;
  const bridge: Bridge = {
    windows: base ? createWindowHost(base, postToUi) : undefined,
    setMenu: menu ? installWorldMenu(menu, postToUi) : undefined,
  };
  window.addEventListener("message", (event: MessageEvent<unknown>) => {
    if (event.source !== window || event.origin !== location.origin) return;
    if (!isEnvelope(event.data, "setup-ui")) return;
    const m = parseUiToPage(event.data.type, event.data.payload);
    if (m) handle(bridge, m);
  });
}

function start(polls = 0): void {
  if (page.game?.view === "setup" && page.ui?.setupPackages) {
    connect();
    postSetupData();
    page.Hooks?.on("renderSetupPackages", postSetupData);
    return;
  }
  if (polls < MAX_POLLS)
    setTimeout(() => {
      start(polls + 1);
    }, POLL_MS);
}

start();
