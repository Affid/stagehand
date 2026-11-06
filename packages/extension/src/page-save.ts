// Saving a world's details from the new Setup page (build plan, Phase 4):
// the UI asks with SAVE_WORLD and a request id; the page world answers
// SAVE_DONE with the same id and an error if it failed. Checked both ways.
type Loose = Readonly<Record<string, unknown>>;

/** The fields our About tab edits; Foundry's validate checks them again. */
export interface WorldChanges {
  readonly title?: string;
  /** An ISO time, or null to clear it. */
  readonly nextSession?: string | null;
}

export interface SaveWorld {
  readonly requestId: string;
  readonly worldId: string;
  readonly changes: WorldChanges;
}

export interface SaveDone {
  readonly requestId: string;
  readonly error?: string;
}

const REQUEST_ID = /^[a-z0-9-]{1,64}$/i;
const MAX_TITLE = 200;
const MAX_ERROR = 2000;
const KEYS: ReadonlySet<string> = new Set(["title", "nextSession"]);

const isObject = (v: unknown): v is Loose =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const isRequestId = (v: unknown): v is string =>
  typeof v === "string" && REQUEST_ID.test(v);

function title(v: unknown): string | undefined | false {
  if (v === undefined) return undefined;
  return typeof v === "string" && v.trim() !== "" && v.length <= MAX_TITLE
    ? v
    : false;
}

function session(v: unknown): string | null | undefined | false {
  if (v === undefined || v === null) return v;
  return typeof v === "string" &&
    v.length <= 64 &&
    Number.isFinite(Date.parse(v))
    ? v
    : false;
}

function changes(v: unknown): WorldChanges | undefined {
  if (!isObject(v)) return undefined;
  const keys = Object.keys(v);
  if (keys.length === 0 || keys.some((k) => !KEYS.has(k))) return undefined;
  const t = title(v.title);
  const s = session(v.nextSession);
  if (t === false || s === false) return undefined;
  return {
    ...(t === undefined ? {} : { title: t }),
    ...(s === undefined ? {} : { nextSession: s }),
  };
}

export function parseSaveWorld(p: Loose): SaveWorld | undefined {
  if (!isRequestId(p.requestId)) return undefined;
  const id = p.worldId;
  if (typeof id !== "string" || id.length === 0 || id.length > 200)
    return undefined;
  const c = changes(p.changes);
  return c ? { requestId: p.requestId, worldId: id, changes: c } : undefined;
}

export function parseSaveDone(p: Loose): SaveDone | undefined {
  if (!isRequestId(p.requestId)) return undefined;
  if (p.error === undefined) return { requestId: p.requestId };
  return typeof p.error === "string" && p.error.length <= MAX_ERROR
    ? { requestId: p.requestId, error: p.error }
    : undefined;
}
