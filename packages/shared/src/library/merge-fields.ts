// Three-way merge of one library item, field by field (library sync).
// Base is the server copy this device saw last; undefined on a first sync.
import { MAX_NOTE } from "./schema.ts";

/**
 * How a field merges when both sides changed it: "value" keeps this
 * device's and reports it, "quiet" keeps this device's without a report
 * (layout such as folder order), "text" keeps both, "set" merges elements.
 */
export type FieldKind = "value" | "quiet" | "text" | "set";

/** Merge rule per field, checked against the field's type. */
export type FieldKinds<T> = Readonly<{
  [K in keyof T]?: T[K] extends readonly string[]
    ? "value" | "quiet" | "set"
    : T[K] extends string
      ? "value" | "quiet" | "text"
      : "value" | "quiet";
}>;

export type ClashReason = "kept-this-device" | "joined-text" | "kept-edit";

export interface ItemOutcome<T> {
  readonly value: T | undefined;
  readonly clash: ClashReason | null;
}

/** Deep equality of plain JSON values; object key order does not matter. */
export function sameJson(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== "object" || typeof b !== "object" || !a || !b) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a) && Array.isArray(b))
    return a.length === b.length && a.every((x, i) => sameJson(x, b[i]));
  const ra = a as Record<string, unknown>;
  const rb = b as Record<string, unknown>;
  const ka = Object.keys(ra);
  return (
    ka.length === Object.keys(rb).length &&
    ka.every((k) => Object.hasOwn(rb, k) && sameJson(ra[k], rb[k]))
  );
}

/** The item without bookkeeping and without the fields left out. */
function contentOf(
  item: object,
  leaveOut: ReadonlySet<string>,
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(item).filter(([k]) => k !== "revision" && !leaveOut.has(k)),
  );
}

const NOTHING: ReadonlySet<string> = new Set();

/** Same content, ignoring revisions (and `leaveOut` fields). */
export function sameContent(
  a: object | undefined,
  b: object | undefined,
  leaveOut: ReadonlySet<string> = NOTHING,
): boolean {
  if (a === undefined || b === undefined) return a === b;
  return sameJson(contentOf(a, leaveOut), contentOf(b, leaveOut));
}

/**
 * Keeps an element both sides have, or one side added; drops one a side
 * removed. Order: the server's, then this device's additions, so devices
 * converge on one order.
 */
export function mergeSet(
  base: readonly string[] | undefined,
  local: readonly string[],
  server: readonly string[],
): string[] {
  const inBase = new Set(base ?? []);
  const inLocal = new Set(local);
  const inServer = new Set(server);
  const keep = (e: string): boolean =>
    (inLocal.has(e) && inServer.has(e)) || !inBase.has(e);
  return [...new Set([...server, ...local])].filter(keep);
}

/** Cut to the note limit (UTF-16 units, as the schema counts) without halving a character. */
function clip(text: string): string {
  if (text.length <= MAX_NOTE) return text;
  const cut = text.slice(0, MAX_NOTE);
  const last = cut.charCodeAt(cut.length - 1);
  return last >= 0xd800 && last <= 0xdbff ? cut.slice(0, -1) : cut;
}

interface FieldOutcome {
  readonly value: unknown;
  readonly clash: ClashReason | null;
}

/** Both texts, unless one already holds the other (a join from an earlier sync). */
function joinText(local: string, server: string): FieldOutcome {
  if (local.includes(server)) return { value: local, clash: null };
  if (server.includes(local)) return { value: server, clash: null };
  return { value: clip(`${local}\n\n${server}`), clash: "joined-text" };
}

const asList = (v: unknown): readonly string[] =>
  Array.isArray(v) ? (v as string[]) : [];

function mergeField(
  kind: FieldKind,
  base: unknown,
  local: unknown,
  server: unknown,
): FieldOutcome {
  if (sameJson(local, server)) return { value: local, clash: null };
  if (kind === "set") {
    const b = base === undefined ? undefined : asList(base);
    return { value: mergeSet(b, asList(local), asList(server)), clash: null };
  }
  if (base !== undefined && sameJson(local, base))
    return { value: server, clash: null };
  if (base !== undefined && sameJson(server, base))
    return { value: local, clash: null };
  if (kind === "text") return joinText(String(local), String(server));
  return { value: local, clash: kind === "quiet" ? null : "kept-this-device" };
}

const worse = (
  a: ClashReason | null,
  b: ClashReason | null,
): ClashReason | null => (a === "kept-this-device" || !b ? a : b);

/** Both sides hold the item: merge every field but id and revision. */
function mergeBoth<T extends object>(
  base: T | undefined,
  local: T,
  server: T,
  kinds: FieldKinds<T> | undefined,
): ItemOutcome<T> {
  let clash: ClashReason | null = null;
  const b = base as Record<string, unknown> | undefined;
  const s = server as Record<string, unknown>;
  const k = (kinds ?? {}) as Readonly<Record<string, FieldKind | undefined>>;
  const fields = Object.entries(local as Record<string, unknown>);
  const entries = fields.map(([key, value]): [string, unknown] => {
    if (key === "id" || key === "revision") return [key, value];
    const field = mergeField(k[key] ?? "value", b?.[key], value, s[key]);
    clash = worse(clash, field.clash);
    return [key, field.value];
  });
  return { value: Object.fromEntries(entries) as T, clash };
}

const quietFields = <T>(
  kinds: FieldKinds<T> | undefined,
): ReadonlySet<string> =>
  new Set(
    Object.entries((kinds ?? {}) as Record<string, FieldKind>)
      .filter(([, kind]) => kind === "quiet")
      .map(([key]) => key),
  );

/**
 * One item, present on any of the three sides. An edit beats a delete; a
 * change to quiet fields only (a renumbered folder) is no edit.
 */
export function mergeItem<T extends object>(
  base: T | undefined,
  local: T | undefined,
  server: T | undefined,
  kinds?: FieldKinds<T>,
): ItemOutcome<T> {
  if (local && server) return mergeBoth(base, local, server, kinds);
  const present = local ?? server;
  if (!present) return { value: undefined, clash: null };
  if (!base) return { value: present, clash: null };
  if (sameContent(present, base, quietFields(kinds)))
    return { value: undefined, clash: null };
  return { value: present, clash: "kept-edit" };
}
