// Phase 3 preview for the spike app (dev only, not the app): the new Setup
// page's app bundle in the emulator's WebView before the Kotlin app exists.
// Everything native will do is played inside the page, as the app harness
// plays it in Node: the native stand-in (tests/app/native.ts), the
// background (served in this same page), and a small relay between them.
// Storage lives in this origin's localStorage. Added at document start on
// the server's pages by the spike's MainActivity.
import "@stagehand/shared/zod-config";
import {
  nativeRouterDeps,
  serveBackground,
} from "../../../packages/extension/src/app/background.ts";
import {
  createNativeBridge,
  type NativePort,
} from "../../../packages/extension/src/app/bridge.ts";
import {
  APP_ID,
  HOME_PAGE,
  READY,
  ROUTE,
} from "../../../packages/extension/src/app/native-api.ts";
import {
  startAppGame,
  startAppSetup,
} from "../../../packages/extension/src/app/page.ts";
import { NativeSim } from "../../../tests/app/native.ts";

declare const __ST_SETUP_CSS__: string;
declare const __ST_RUNNING_CSS__: string;

const SERVER = location.origin;
const STORE = "st-preview-kv";

interface Wire {
  readonly v: 1;
  readonly id?: string;
  readonly re?: string;
  readonly type?: string;
  readonly payload?: unknown;
  readonly ok?: boolean;
  readonly result?: unknown;
  readonly error?: string;
}

/** Native's dialogs and links, as a WebView page can show them. */
class PreviewNative extends NativeSim {
  override handlers() {
    const base = super.handlers();
    return {
      ...base,
      confirm: (p: Record<string, unknown>) => ({
        yes: window.confirm(String(p.text)),
      }),
      "files.save": () => {
        window.alert("Saving files comes with the app (phase 4).");
        return null;
      },
      "files.open": () => ({}),
      openExternal: (p: Record<string, unknown>) => {
        window.alert(`Opens in the browser in the app:\n${String(p.url)}`);
        return null;
      },
      "home.open": () => {
        window.alert("The app's home screen comes with the app (phase 4).");
        return null;
      },
    };
  }
}

const native = new PreviewNative({
  originAllowed: () => Promise.resolve(),
  scriptsRegistered: () => Promise.resolve(),
  homeOpened: () => Promise.resolve(),
});
native.origins.add(SERVER);
try {
  const saved = JSON.parse(localStorage.getItem(STORE) ?? "{}") as Record<
    string,
    string
  >;
  Object.entries(saved).forEach(([k, v]) => native.kv.set(k, v));
} catch {
  // A fresh start.
}
const persist = (): void => {
  localStorage.setItem(STORE, JSON.stringify(Object.fromEntries(native.kv)));
};

/** A port whose sends go to `onSend`; native answers through onmessage. */
function port(onSend: (text: string) => void): NativePort {
  return {
    postMessage: (text) => {
      queueMicrotask(() => {
        onSend(text);
      });
    },
    onmessage: null,
  };
}

const deliver = (p: NativePort, m: Wire): void => {
  p.onmessage?.({ data: JSON.stringify(m) });
};

let ready: () => void = () => undefined;
const backgroundReady = new Promise<void>((resolve) => {
  ready = resolve;
});
const waiting = new Map<string, (m: Wire) => void>();
let next = 0;

/** Native's `route` to the background (here, in this same page). */
async function route(message: unknown, sender: object): Promise<unknown> {
  await backgroundReady;
  next += 1;
  const id = `native-${String(next)}`;
  const reply = await new Promise<Wire>((resolve) => {
    waiting.set(id, resolve);
    deliver(bg, { v: 1, id, type: ROUTE, payload: { message, sender } });
  });
  if (reply.ok !== true) throw new Error(String(reply.error));
  return reply.result;
}

async function run(
  from: "server" | "background" | "home",
  type: string,
  payload: unknown,
): Promise<unknown> {
  if (type === READY) {
    ready();
    return null;
  }
  const p = (payload ?? {}) as Record<string, unknown>;
  if (type === "runtime.send")
    return route(p.message, {
      id: APP_ID,
      url: from === "server" ? location.href : HOME_PAGE,
      fromTab: from === "server",
    });
  const handler = native.handlers()[type];
  if (!handler) throw new Error(`Native doesn't know ${type}`);
  const result: unknown = await handler(p);
  persist();
  return result;
}

function receive(from: "server" | "background", p: () => NativePort) {
  return (text: string): void => {
    const m = JSON.parse(text) as Wire;
    if (typeof m.re === "string") {
      waiting.get(m.re)?.(m);
      waiting.delete(m.re);
      return;
    }
    if (typeof m.id !== "string" || typeof m.type !== "string") return;
    const id = m.id;
    run(from, m.type, m.payload).then(
      (result) => {
        deliver(p(), { v: 1, re: id, ok: true, result: result ?? null });
      },
      (error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        deliver(p(), { v: 1, re: id, ok: false, error: message });
      },
    );
  };
}

const bg: NativePort = port(receive("background", () => bg));
const page: NativePort = port(receive("server", () => page));

// The background, in this page.
const bgBridge = createNativeBridge(bg);
void serveBackground(
  bgBridge,
  nativeRouterDeps(bgBridge, { version: "preview" }),
);

// This server, as the app's home screen would add it (once).
if (!native.kv.has("servers"))
  void run("home", "runtime.send", {
    message: { kind: "register-server", server: SERVER },
  }).catch((error: unknown) => {
    console.error("Stagehand preview", error);
  });

// Our scripts on the server's pages, as native adds them.
(window as { stApp?: NativePort }).stApp = page;
const onSetup = startAppSetup({
  win: window,
  doc: document,
  href: location.href,
  server: SERVER,
  css: __ST_SETUP_CSS__,
});
if (!onSetup) {
  startAppGame({
    win: window,
    href: location.href,
    server: SERVER,
    referrer: document.referrer,
    runningCss: __ST_RUNNING_CSS__,
  });
}
