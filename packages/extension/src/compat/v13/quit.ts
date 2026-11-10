// Foundry 13's quit: POST /quit stops the server at once, with no quit page
// and an answer of "failed" either way (13 quit.mjs). So the server counts
// as stopped only once it no longer answers its status route; a request
// that failed for another reason (offline, refused) is not a stop.
// Imported only by compat/quirks.ts.

export interface QuitDeps {
  readonly fetch: (url: string, init?: RequestInit) => Promise<Response>;
  readonly route: (path: string) => string;
  readonly sleep: (ms: number) => Promise<void>;
}

const POLL_MS = 500;
/** About 10 s: 13 exits right after answering. */
const POLLS = 20;

async function answers(deps: QuitDeps): Promise<boolean> {
  try {
    const res = await deps.fetch(deps.route("api/status"), {
      cache: "no-store",
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Stops Foundry 13; `stopped` once it is down. An error if it stays up. */
export async function quitAtOnce(
  deps: QuitDeps,
  stopped: () => void,
): Promise<string | undefined> {
  await deps
    .fetch(deps.route("quit"), { method: "POST" })
    .catch(() => undefined);
  for (let i = 0; i < POLLS; i++) {
    if (!(await answers(deps))) {
      stopped();
      return undefined;
    }
    await deps.sleep(POLL_MS);
  }
  return "Foundry did not stop";
}
