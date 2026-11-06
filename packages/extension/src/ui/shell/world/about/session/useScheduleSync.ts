// When Setup opens, a world whose next session has passed gets the next
// date on its schedule (SETUP-REDESIGN.md: we move Foundry's one date on).
import { useEffect, useRef } from "preact/hooks";
import { useUi } from "../../../../context.ts";
import { nextIso } from "./SessionView.tsx";
import { useCanEditWorld } from "../../AboutEdit.tsx";

export function useScheduleSync(): void {
  const { state, page } = useUi();
  const canEdit = useCanEditWorld();
  // Each world once per wanted date: a refused save must not loop.
  const tried = useRef(new Set<string>());
  useEffect(() => {
    if (!canEdit) return;
    for (const w of state.data.setup?.worlds ?? []) {
      if (!w.schedule || w.locked) continue;
      const want = nextIso(w.schedule, Date.now());
      const have = w.nextSession ?? null;
      const key = `${w.id}\u0000${String(want)}`;
      if (want === have || tried.current.has(key)) continue;
      tried.current.add(key);
      void page.saveWorld(w.id, { nextSession: want });
    }
  }, [state.data.setup, canEdit, page]);
}
