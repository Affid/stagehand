// "Turn all on / off" for a group of a world's modules: the world page's
// group menu and the By world grid's group counts. Queued for the next
// launch, in parts the background accepts.
import { MAX_PICKED } from "@module-library/shared/world";
import { useUi } from "../../context.ts";
import { COMPANION_ID } from "../../model/preview.ts";
import type { WorldModuleRow } from "../../model/world-modules.ts";

/** Ids in parts the background accepts in one change (MAX_PICKED). */
export function inParts(ids: readonly string[], size = MAX_PICKED): string[][] {
  const parts: string[][] = [];
  for (let i = 0; i < ids.length; i += size) parts.push(ids.slice(i, i + size));
  return parts;
}

/**
 * Whether "Turn all" includes this row: never the companion off, never a
 * module on that needs one that isn't installed (it would be blocked).
 */
const turns = (
  r: WorldModuleRow,
  on: boolean,
  installed: ReadonlySet<string>,
): boolean =>
  r.next !== on &&
  (on
    ? r.pkg.requires.every((q) => q.type !== "module" || installed.has(q.id))
    : r.pkg.id !== COMPANION_ID);

/** Bulk changes on their way, by world and modules: a second click waits (review). */
const running = new Set<string>();

/**
 * Queues one bulk change in parts the background accepts (MAX_PICKED);
 * the same change twice at once is sent once.
 */
export async function queueInParts(
  queue: (part: readonly string[]) => Promise<unknown>,
  key: string,
  ids: readonly string[],
): Promise<void> {
  if (!ids.length || running.has(key)) return;
  running.add(key);
  try {
    for (const part of inParts(ids)) await queue(part);
  } finally {
    running.delete(key);
  }
}

/** The rows "Turn all on / off" would change. */
export function useTurnable(rows: readonly WorldModuleRow[]) {
  const { state } = useUi();
  const installed = new Set(state.data.setup?.modules.map((m) => m.id));
  return (on: boolean): readonly WorldModuleRow[] =>
    rows.filter((r) => turns(r, on, installed));
}

/** Queues "Turn all on / off" for a group, in parts the background accepts. */
export function useTurnAll(rows: readonly WorldModuleRow[], worldId: string) {
  const { actions } = useUi();
  const turnable = useTurnable(rows);
  return (on: boolean): void => {
    const ids = turnable(on).map((r) => r.pkg.id);
    void queueInParts(
      (part) => actions.queueApply(worldId, on ? "add" : "remove", [], part),
      `${worldId}:${on ? "on" : "off"}:${ids.join(",")}`,
      ids,
    );
  };
}
