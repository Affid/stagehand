// Says when a world's queued changes change, wherever the change came from
// (the world page, the Library, the grid, a menu): one polite live region
// for the whole page (SETUP-REDESIGN.md, H4).
import { useEffect, useRef, useState } from "preact/hooks";
import { useUi } from "../context.ts";
import { plural } from "../i18n.ts";
import { pendingFor } from "../model/preview.ts";

/** Each world's number of queued changes. */
function useCounts(): ReadonlyMap<string, number> {
  const { state } = useUi();
  const worlds = state.data.setup?.worlds ?? [];
  return new Map(
    worlds.map((w) => [w.id, pendingFor(state.data, w.id).length]),
  );
}

export function Announcer() {
  const { state, t } = useUi();
  const counts = useCounts();
  const last = useRef<ReadonlyMap<string, number> | null>(null);
  const [said, setSaid] = useState("");
  const key = [...counts].map(([id, n]) => `${id}:${String(n)}`).join("|");
  useEffect(() => {
    const before = last.current;
    last.current = counts;
    // Nothing on load: only changes are news.
    if (!before) return;
    const changed = [...counts].find(([id, n]) => (before.get(id) ?? 0) !== n);
    if (!changed) return;
    const [id, n] = changed;
    const title =
      state.data.setup?.worlds.find((w) => w.id === id)?.title ?? id;
    const what = n ? plural(t, "wp.pending.changes", n) : t("announce.none");
    setSaid(t("announce.world", { world: title, what }));
    // Only when the counts change.
  }, [key]);
  return (
    <p class="ml-sr-only mls-announce" aria-live="polite">
      {said}
    </p>
  );
}
