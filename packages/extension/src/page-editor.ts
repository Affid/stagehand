// Editing a world's description in Foundry's own prose-mirror editor
// (SETUP-REDESIGN.md, build requirements): the editor is a page-world
// element, so the page world mounts it into a host our page draws
// (EDITOR_OPEN), saves its HTML through editWorld (EDITOR_SAVE, answered by
// SAVE_DONE) and removes it (EDITOR_CLOSE). Checked both ways.
type Loose = Readonly<Record<string, unknown>>;

/** Our host elements only: never another element on the page. */
export const EDITOR_HOST = /^st-pm-[a-z0-9-]{1,64}$/i;
const REQUEST_ID = /^[a-z0-9-]{1,64}$/i;
/** As Setup reads it (MAX_DESCRIPTION in the shared world schema). */
const MAX_VALUE = 20000;

export interface EditorOpen {
  readonly hostId: string;
  readonly value: string;
}

export interface EditorSave {
  readonly requestId: string;
  readonly hostId: string;
  readonly worldId: string;
}

const isHost = (v: unknown): v is string =>
  typeof v === "string" && EDITOR_HOST.test(v);

export function parseEditorOpen(p: Loose): EditorOpen | undefined {
  return isHost(p.hostId) &&
    typeof p.value === "string" &&
    p.value.length <= MAX_VALUE
    ? { hostId: p.hostId, value: p.value }
    : undefined;
}

export function parseEditorClose(p: Loose): { hostId: string } | undefined {
  return isHost(p.hostId) ? { hostId: p.hostId } : undefined;
}

export function parseEditorSave(p: Loose): EditorSave | undefined {
  const { requestId, hostId, worldId } = p;
  return typeof requestId === "string" &&
    REQUEST_ID.test(requestId) &&
    isHost(hostId) &&
    typeof worldId === "string" &&
    worldId.length > 0 &&
    worldId.length <= 200
    ? { requestId, hostId, worldId }
    : undefined;
}
