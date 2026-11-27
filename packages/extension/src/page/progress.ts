// Foundry draws progress and its busy lock inside its own (hidden) Setup
// layout. We wrap its public ui.setupPackages.onProgress and toggleLock once,
// keep Foundry's own behaviour, and post a checked copy to our page.
import type { PageToUi } from "../page-protocol.ts";
import { parseLock, parseProgress, type Progress } from "../page-progress.ts";
import type { PageGlobals } from "./globals.ts";

interface SetupPackagesLike {
  onProgress?: (data: Record<string, unknown>) => unknown;
  toggleLock?: (locked: boolean, options?: { message?: string }) => unknown;
  /** Set once we have wrapped them. */
  stWatched?: boolean;
}

/** Watching must never break Foundry's own call: an odd argument is skipped. */
function forward(send: () => void): void {
  try {
    send();
  } catch {
    // Not a tick we can read; Foundry has already handled it.
  }
}

/** Listeners to Foundry's ticks inside the page world (a run that waits on one). */
const taps = new Set<(p: Progress) => void>();

/** Hears each tick Foundry draws; returns a function that stops hearing. */
export function tapProgress(listener: (p: Progress) => void): () => void {
  taps.add(listener);
  return () => {
    taps.delete(listener);
  };
}

export function watchProgress(
  page: Pick<PageGlobals, "ui">,
  post: (m: PageToUi) => void,
): void {
  const sp = page.ui?.setupPackages as SetupPackagesLike | undefined;
  if (!sp || sp.stWatched) return;
  sp.stWatched = true;
  const onProgress = sp.onProgress?.bind(sp);
  if (onProgress)
    sp.onProgress = (data) => {
      const result = onProgress(data);
      forward(() => {
        const payload = parseProgress(data);
        if (!payload) return;
        post({ type: "PROGRESS", payload });
        for (const tap of taps) tap(payload);
      });
      return result;
    };
  const toggleLock = sp.toggleLock?.bind(sp);
  if (toggleLock)
    sp.toggleLock = (locked, options) => {
      const result = toggleLock(locked, options);
      forward(() => {
        const payload = parseLock({ locked, message: options?.message });
        if (payload) post({ type: "LOCK", payload });
      });
      return result;
    };
}
