// Mounts the new Setup page whenever the extension runs (not in safe mode),
// and gives Foundry's page back when it can't start.
// Order: ask the page world to hide Foundry's layout, wait for its answer,
// then render. A refusal or a render error leaves Foundry's page and says
// why, once.
import { logError } from "@module-library/shared/log";
import { render } from "preact";
import { allowsChanges } from "../../adapters/select.ts";
import { ShellRoot } from "../App.tsx";
import type { UiDeps } from "../context.ts";

export const SHELL_HOST = "ml-shell-root";

type Phase = "off" | "asking" | "on" | "failed";

const message = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

function unmount(doc: Document): void {
  const host = doc.getElementById(SHELL_HOST);
  if (host) render(null, host);
  host?.remove();
}

/** Renders the shell into its own host; a first-render error throws. */
function mountShell(
  doc: Document,
  deps: UiDeps,
  onError: (error: unknown) => void,
): void {
  const host = doc.createElement("div");
  host.id = SHELL_HOST;
  doc.body.append(host);
  render(<ShellRoot deps={deps} onError={onError} />, host);
}

/** Returns the function to run whenever the store changes. */
export function syncShell(deps: UiDeps, doc: Document): () => void {
  const { store, page, t } = deps;
  let phase: Phase = "off";

  /** `giveBack`: Foundry's layout was hidden and must be shown again. */
  const fail = (error: unknown, giveBack: boolean): void => {
    logError("new setup page", error);
    phase = "failed";
    unmount(doc);
    if (giveBack) page.setShell(false);
    page.notify("error", t("shell.failed", { error: message(error) }));
  };
  // A later error unmounts from outside Preact's render.
  const onLateError = (error: unknown): void => {
    queueMicrotask(() => {
      if (phase === "on") fail(error, true);
    });
  };

  page.subscribe((e) => {
    if (e.type !== "SHELL_STATE" || phase !== "asking") return;
    // A refusal always says why; a bare "off" acknowledges an earlier off.
    if (!e.payload.on && e.payload.error === undefined) return;
    if (!e.payload.on) {
      fail(e.payload.error, false);
      return;
    }
    try {
      phase = "on";
      mountShell(doc, deps, onLateError);
    } catch (error: unknown) {
      fail(error, true);
    }
  });

  return () => {
    const s = store.get();
    const wanted = allowsChanges(s.adapter);
    if (wanted && phase === "off") {
      phase = "asking";
      page.setShell(true);
    } else if (!wanted && phase !== "off") {
      if (phase !== "failed") {
        unmount(doc);
        page.setShell(false);
      }
      phase = "off";
    }
  };
}
