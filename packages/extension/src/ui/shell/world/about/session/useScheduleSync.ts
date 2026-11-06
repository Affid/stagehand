// When Setup opens, a world whose next session has passed gets the next
// date on its schedule (SETUP-REDESIGN.md: we move Foundry's one date on).
import { useEffect, useRef } from "preact/hooks";
import { useUi } from "../../../../context.ts";
import type { Schedule } from "../../../../model/schedule.ts";
import { nextIso } from "./SessionView.tsx";
import { useCanEditWorld } from "../../AboutEdit.tsx";

/** The schedule's next date; undefined when its math fails (review). */
function safeNext(s: Schedule, now: number): string | null | undefined {
  try {
    return nextIso(s, now);
  } catch {
    return undefined;
  }
}

export function useScheduleSync(): void {
  const { state, page } = useUi();
  const canEdit = useCanEditWorld();
  // Each world once per wanted date: a refused save must not loop.
  const tried = useRef(new Set<string>());
  useEffect(() => {
    if (!canEdit) return;
    for (const w of state.data.setup?.worlds ?? []) {
      if (!w.schedule || w.locked) continue;
      const now = Date.now();
      const want = safeNext(w.schedule, now);
      if (want === undefined) continue;
      const have = w.nextSession ?? null;
      // Only a missing or passed date moves on: a date still to come, even
      // one set in Foundry's own window, stays (review).
      const passed = have === null || Date.parse(have) < now;
      const same =
        want !== null && have !== null && Date.parse(want) === Date.parse(have);
      const key = `${w.id}\u0000${String(want)}`;
      if (!passed || same || want === have || tried.current.has(key)) continue;
      tried.current.add(key);
      void page.saveWorld(w.id, { nextSession: want });
    }
  }, [state.data.setup, canEdit, page]);
}
