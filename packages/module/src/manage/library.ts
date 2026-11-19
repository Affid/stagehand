// The library Setup keeps in the server's Data folder, read from inside a
// world (docs/IN-WORLD-LIBRARY-PLAN.md, "Reading the library"). The file is
// public and untrusted: size-capped and validated by the shared reader. No
// file, no library view: Foundry's window stays as it is.
import type { Library } from "@stagehand/shared/library/schema";
import {
  MAX_SYNC_FILE_CHARS,
  parseSyncFile,
  SYNC_FILE_PATH,
} from "@stagehand/shared/library/sync-file";

export interface LibraryDeps {
  readonly fetch: (url: string, init: RequestInit) => Promise<Response>;
  /** The server's own path for a route (route prefix included). */
  readonly route: (path: string) => string;
  readonly log: (message: string) => void;
  /** The size cap (tests); MAX_SYNC_FILE_CHARS by default. */
  readonly maxChars?: number;
}

const TIMEOUT_MS = 15_000;
const TOO_BIG = "the file is too big";

async function fetchText(deps: LibraryDeps): Promise<string | undefined> {
  const response = await deps.fetch(deps.route(SYNC_FILE_PATH), {
    cache: "no-store",
    credentials: "same-origin",
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (response.status === 404) return undefined;
  if (!response.ok)
    throw new Error(`Foundry answered HTTP ${String(response.status)}`);
  const max = deps.maxChars ?? MAX_SYNC_FILE_CHARS;
  const length = Number(response.headers.get("content-length") ?? 0);
  if (length > max) throw new Error(TOO_BIG);
  return readCapped(response, max);
}

/** The body as text, stopped once it passes the cap (no length needed). */
async function readCapped(response: Response, max: number): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) return "";
  const decoder = new TextDecoder();
  let text = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) return text + decoder.decode();
    text += decoder.decode(value, { stream: true });
    if (text.length > max) {
      await reader.cancel();
      throw new Error(TOO_BIG);
    }
  }
}

export async function readWorldLibrary(
  deps: LibraryDeps,
): Promise<Library | undefined> {
  try {
    const text = await fetchText(deps);
    if (text === undefined) return undefined;
    const read = parseSyncFile(text, deps.route(""));
    if (read.ok) return read.file.side.library;
    deps.log(`Stagehand's library file can't be read (${read.error}).`);
    return undefined;
  } catch (error: unknown) {
    const why = error instanceof Error ? error.message : String(error);
    deps.log(`Stagehand's library file can't be read (${why}).`);
    return undefined;
  }
}
