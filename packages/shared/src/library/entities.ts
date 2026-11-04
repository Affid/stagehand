// Revision-checked updates of a list of entities (D-2): a change based on an
// old revision is rejected with the current entity, never silently applied.

export interface Revisioned {
  readonly id: string;
  readonly revision: number;
}

export type EntityKind = "folder" | "tag" | "preset";

export interface Conflict<T> {
  readonly entity: EntityKind;
  readonly id: string;
  readonly current: T;
}

export type EntityResult<T> =
  | { readonly ok: true; readonly list: readonly T[] }
  | { readonly ok: false; readonly conflict: Conflict<T> }
  | { readonly ok: false; readonly error: string };

export function updateEntity<T extends Revisioned>(
  kind: EntityKind,
  list: readonly T[],
  id: string,
  baseRevision: number,
  change: (current: T) => T | null,
): EntityResult<T> {
  const current = list.find((e) => e.id === id);
  if (!current) return { ok: false, error: `${kind} ${id} not found` };
  if (current.revision !== baseRevision)
    return { ok: false, conflict: { entity: kind, id, current } };
  const next = change(current);
  return {
    ok: true,
    list:
      next === null
        ? list.filter((e) => e.id !== id)
        : list.map((e) =>
            e.id === id ? { ...next, revision: current.revision + 1 } : e,
          ),
  };
}

/** Drops keys whose value is undefined, so they don't overwrite. */
export type DefinedChanges<T> = { [K in keyof T]?: Exclude<T[K], undefined> };

export function definedChanges<T extends object>(
  changes: T,
): DefinedChanges<T> {
  return Object.fromEntries(
    Object.entries(changes).filter(([, v]) => v !== undefined),
  ) as DefinedChanges<T>;
}
