// A row of Your packages opens where it lives: a module's details in the
// Library, a system's panel on its Systems tab, a world's page.
import { useUi } from "../../../context.ts";
import type { CompatRow } from "./compat.ts";

export function useOpenRow(): (x: CompatRow) => void {
  const { store } = useUi();
  return (x) => {
    if (x.kind === "world")
      store.set({ route: { kind: "world", worldId: x.id }, panel: null });
    else if (x.kind === "system")
      store.set({
        route: { kind: "library" },
        side: { kind: "system", id: x.id },
        panel: null,
      });
    else store.set({ route: { kind: "library" }, panel: x.id, side: null });
  };
}
