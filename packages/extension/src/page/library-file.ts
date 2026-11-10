// The library file in the server's Data folder (docs/LIBRARY-SYNC-PLAN.md),
// read and written from the admin's Setup page: a GET of the public file,
// and Foundry's own upload (admin session, no world needed). The folder is
// created through Foundry's socket only when an upload says it is missing.
import {
  MAX_SYNC_FILE_CHARS,
  SYNC_FILE,
  SYNC_FILE_PATH,
  SYNC_FOLDER,
} from "@stagehand/shared/library/sync-file";
import type { LibraryFileReply } from "../page-library-file.ts";
import type { PageGlobals } from "./globals.ts";

export interface LibraryFileDeps {
  readonly fetch: (url: string, init: RequestInit) => Promise<Response>;
  /** The server's own path for a route (route prefix included). */
  readonly route: (path: string) => string;
  /** Foundry's socket is up: right after a server start it is not yet. */
  readonly socketReady: () => boolean;
  /** Foundry's file picker, creating a folder in Data. */
  readonly createDirectory: (path: string) => Promise<unknown>;
  readonly sleep: (ms: number) => Promise<void>;
}

const SOCKET_POLL_MS = 100;
/** About 10 s; the socket took 0.7 s after a cold start on 14.370. */
const SOCKET_POLLS = 100;

const message = (e: unknown): string =>
  e instanceof Error ? e.message : String(e);

const httpError = (r: Response): string =>
  `Foundry answered HTTP ${String(r.status)}.`;

const TOO_BIG = "The library file on the server is too big.";

export async function readLibraryFile(
  deps: LibraryFileDeps,
): Promise<LibraryFileReply> {
  try {
    const response = await deps.fetch(deps.route(SYNC_FILE_PATH), {
      cache: "no-store",
      credentials: "same-origin",
    });
    if (response.status === 404) return { missing: true };
    if (!response.ok) return { error: httpError(response) };
    const length = Number(response.headers.get("content-length") ?? 0);
    if (length > MAX_SYNC_FILE_CHARS) return { error: TOO_BIG };
    const text = await response.text();
    return text.length > MAX_SYNC_FILE_CHARS ? { error: TOO_BIG } : { text };
  } catch (e: unknown) {
    return { error: message(e) };
  }
}

type Upload = { readonly ok: true } | { readonly error: string };

async function upload(deps: LibraryFileDeps, text: string): Promise<Upload> {
  const form = new FormData();
  form.set("source", "data");
  form.set("target", SYNC_FOLDER);
  form.set("upload", new File([text], SYNC_FILE, { type: "application/json" }));
  const response = await deps.fetch(deps.route("upload"), {
    method: "POST",
    body: form,
    credentials: "same-origin",
  });
  const body = (await response.json().catch(() => undefined)) as
    { status?: unknown; error?: unknown } | undefined;
  if (typeof body?.error === "string") return { error: body.error };
  if (!response.ok || body?.status !== "success")
    return { error: httpError(response) };
  return { ok: true };
}

async function waitForSocket(deps: LibraryFileDeps): Promise<boolean> {
  for (let i = 0; i < SOCKET_POLLS; i++) {
    if (deps.socketReady()) return true;
    await deps.sleep(SOCKET_POLL_MS);
  }
  return deps.socketReady();
}

/** Creates our folder; one another device just created counts. */
async function createFolder(deps: LibraryFileDeps): Promise<string | null> {
  if (!(await waitForSocket(deps))) return "Foundry's connection is not ready.";
  try {
    await deps.createDirectory(SYNC_FOLDER);
    return null;
  } catch (e: unknown) {
    return message(e).includes("EEXIST") ? null : message(e);
  }
}

const MISSING_FOLDER = /does not exist/i;

export async function writeLibraryFile(
  deps: LibraryFileDeps,
  text: string,
): Promise<LibraryFileReply> {
  try {
    const first = await upload(deps, text);
    if ("ok" in first) return {};
    if (!MISSING_FOLDER.test(first.error)) return { error: first.error };
    const failed = await createFolder(deps);
    if (failed) return { error: failed };
    const second = await upload(deps, text);
    return "ok" in second ? {} : { error: second.error };
  } catch (e: unknown) {
    return { error: message(e) };
  }
}

interface FilePickerClass {
  createDirectory(source: string, target: string): Promise<unknown>;
}

/** The real page: Foundry's globals and the browser's fetch. */
export function libraryFileDeps(page: PageGlobals): LibraryFileDeps {
  const picker = (): FilePickerClass | undefined =>
    page.foundry?.applications?.apps?.FilePicker?.implementation as
      FilePickerClass | undefined;
  return {
    fetch: (url, init) => globalThis.fetch(url, init),
    route: (path) => page.foundry?.utils?.getRoute?.(path) ?? `/${path}`,
    socketReady: () => page.game?.socket?.connected === true,
    createDirectory: async (path) => {
      const p = picker();
      if (!p) throw new Error("Foundry's file picker is missing.");
      return p.createDirectory("data", path);
    },
    sleep: (ms) =>
      new Promise((resolve) => {
        setTimeout(resolve, ms);
      }),
  };
}
