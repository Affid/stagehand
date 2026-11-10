// Library sync's file on the server: the UI asks with LIBRARY_FILE (read the
// file, or write new text), the page world does it with the admin's session
// (page/library-file.ts) and answers LIBRARY_FILE_DONE. The text itself is
// checked by the background (sync-file.ts); here only the envelope. Checked
// both ways.
import { MAX_SYNC_FILE_CHARS } from "@stagehand/shared/library/sync-file";

export type LibraryFileRequest =
  | { readonly requestId: string; readonly op: "read" }
  | { readonly requestId: string; readonly op: "write"; readonly text: string };

/**
 * A read gives text or missing; a write gives nothing; either may fail.
 * At most one field is set (checked on the way in).
 */
export interface LibraryFileReply {
  readonly text?: string;
  readonly missing?: true;
  readonly error?: string;
}

export type LibraryFileDone = LibraryFileReply & { readonly requestId: string };

type Loose = Readonly<Record<string, unknown>>;

const REQUEST_ID = /^[a-z0-9-]{1,64}$/i;
const MAX_ERROR = 2000;

const isText = (v: unknown, max: number): v is string =>
  typeof v === "string" && v.length <= max;

export function parseLibraryFileRequest(
  p: Loose,
): LibraryFileRequest | undefined {
  const { requestId, op, text } = p;
  if (typeof requestId !== "string" || !REQUEST_ID.test(requestId))
    return undefined;
  if (op === "read") return { requestId, op };
  if (op === "write" && isText(text, MAX_SYNC_FILE_CHARS))
    return { requestId, op, text };
  return undefined;
}

function reply(p: Loose): LibraryFileReply | undefined {
  const keys = Object.keys(p).filter((k) => k !== "requestId");
  if (keys.length === 0) return {};
  if (keys.length > 1) return undefined;
  if (isText(p.text, MAX_SYNC_FILE_CHARS)) return { text: p.text };
  if (p.missing === true) return { missing: true };
  if (isText(p.error, MAX_ERROR) && p.error !== "") return { error: p.error };
  return undefined;
}

export function parseLibraryFileDone(p: Loose): LibraryFileDone | undefined {
  const { requestId } = p;
  if (typeof requestId !== "string" || !REQUEST_ID.test(requestId))
    return undefined;
  const r = reply(p);
  return r ? { requestId, ...r } : undefined;
}
