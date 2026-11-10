// No jump from Foundry's Setup to ours (owner, 2026-11-07). Foundry's Setup
// pieces are hidden by CSS from the first paint (shell/veil.css) while the
// page is marked as waiting; the new page then takes over (st-shell-on on
// body), or Foundry's page is shown again: when the new page gives up or
// won't start (liftVeil), or when nothing took over in time.
import { SHELL_CLASS } from "./shell.ts";

/** Set at document_start: the new page may still take over. */
export const VEIL_WAIT = "st-shell-wait";
/** Foundry's own page is shown: the new page won't take over. */
export const VEIL_OFF = "st-shell-off";
/** A slow server's Setup still loads in time; a broken one isn't hidden long. */
export const VEIL_TIMEOUT_MS = 15_000;

type Schedule = (fn: () => void, ms: number) => unknown;

export function liftVeil(doc: Document): void {
  doc.documentElement.classList.add(VEIL_OFF);
}

export function startVeil(
  doc: Document,
  schedule: Schedule = (fn, ms) => setTimeout(fn, ms),
): void {
  doc.documentElement.classList.add(VEIL_WAIT);
  schedule(() => {
    if (!doc.body.classList.contains(SHELL_CLASS)) liftVeil(doc);
  }, VEIL_TIMEOUT_MS);
}
