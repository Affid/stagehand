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

/** Queues "Turn all on / off" for a group, in parts the background accepts. */
export function useTurnAll(rows: readonly WorldModuleRow[], worldId: string) {
  const { state, actions } = useUi();
  return (on: boolean): void => {
    const installed = new Set(state.data.setup?.modules.map((m) => m.id));
    const ids = rows
      .filter((r) => turns(r, on, installed))
      .map((r) => r.pkg.id);
    void (async () => {
      for (const part of inParts(ids))
        await actions.queueApply(worldId, on ? "add" : "remove", [], part);
    })();
  };
}
