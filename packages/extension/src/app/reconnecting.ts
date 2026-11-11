// The app's small sign while Foundry has lost its connection and is trying
// again (owner, 2026-11-11): Foundry's own notices are taken away
// (page/connection.ts), so without it the page would give no sign of being
// offline. Shown only when the loss lasts a moment (coming back to the app
// usually reconnects at once); it goes when Foundry is connected again
// (it then reloads the page after a long loss) or gives up (native shows
// the unreachable screen).
import { hideConnectionNotices } from "../page/connection.ts";
import type { PageGlobals } from "../page/globals.ts";

const ID = "st-reconnecting";
/** A loss shorter than this never shows the sign. */
const SHOW_AFTER_MS = 1_000;

export interface ReconnectingDeps {
  readonly page: PageGlobals;
  readonly doc: Document;
  readonly win: Window;
  /** "Reconnecting…" in the page's language. */
  readonly label: string;
  readonly showAfterMs?: number;
}

/**
 * Under the top bar, out of the finger's way, above our screens and above
 * Foundry's notices, which show in the same place (seen on the emulator).
 */
const SIGN_STYLE = [
  "position:fixed",
  "top:calc(64px + env(safe-area-inset-top, 0px))",
  "left:50%",
  "transform:translateX(-50%)",
  "z-index:2147483000",
  "display:flex",
  "align-items:center",
  "gap:8px",
  "padding:6px 14px 6px 12px",
  "border:1px solid #353042",
  "border-radius:999px",
  "background:#1a1724",
  "color:#efe9dd",
  "font:600 13px/1.4 var(--font-body, Signika, sans-serif)",
  "box-shadow:0 4px 14px rgba(0,0,0,.45)",
  "pointer-events:none",
  "white-space:nowrap",
].join(";");
const DOT_STYLE =
  "width:8px;height:8px;border-radius:50%;background:#ee9b3a;flex:none";

function signOf(doc: Document, label: string): HTMLElement {
  const sign = doc.createElement("div");
  sign.id = ID;
  sign.setAttribute("role", "status");
  sign.style.cssText = SIGN_STYLE;
  const dot = doc.createElement("span");
  dot.setAttribute("aria-hidden", "true");
  dot.style.cssText = DOT_STYLE;
  sign.append(dot, label);
  return sign;
}

/** Hides Foundry's connection notices and shows our sign instead; returns the stop. */
export function showReconnecting(deps: ReconnectingDeps): () => void {
  const { doc, win } = deps;
  let timer: number | undefined;
  const clear = (): void => {
    if (timer !== undefined) win.clearTimeout(timer);
    timer = undefined;
    doc.getElementById(ID)?.remove();
  };
  const show = (): void => {
    timer = undefined;
    if (!doc.getElementById(ID)) doc.body.append(signOf(doc, deps.label));
  };
  const stopNotices = hideConnectionNotices(deps.page, doc, (news) => {
    if (news !== "lost") clear();
    else if (timer === undefined && !doc.getElementById(ID))
      timer = win.setTimeout(show, deps.showAfterMs ?? SHOW_AFTER_MS);
  });
  return () => {
    stopNotices();
    clear();
  };
}
