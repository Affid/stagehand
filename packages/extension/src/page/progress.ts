// Foundry draws progress and its busy lock inside its own (hidden) Setup
// layout. We wrap its public ui.setupPackages.onProgress and toggleLock once,
// keep Foundry's own behaviour, and post a checked copy to our page.
import type { PageToUi } from "../page-protocol.ts";
import { parseLock, parseProgress } from "../page-progress.ts";
import type { PageGlobals } from "./globals.ts";

interface SetupPackagesLike {
  onProgress?: (data: Record<string, unknown>) => unknown;
  toggleLock?: (locked: boolean, options?: { message?: string }) => unknown;
  /** Set once we have wrapped them. */
  mlWatched?: boolean;
}

/** Watching must never break Foundry's own call: an odd argument is skipped. */
function forward(send: () => void): void {
  try {
    send();
  } catch {
    // Not a tick we can read; Foundry has already handled it.
  }
}

export function watchProgress(
  page: Pick<PageGlobals, "ui">,
  post: (m: PageToUi) => void,
): void {
  const sp = page.ui?.setupPackages as SetupPackagesLike | undefined;
  if (!sp || sp.mlWatched) return;
  sp.mlWatched = true;
  const onProgress = sp.onProgress?.bind(sp);
  if (onProgress)
    sp.onProgress = (data) => {
      const result = onProgress(data);
      forward(() => {
        const payload = parseProgress(data);
        if (payload) post({ type: "PROGRESS", payload });
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
