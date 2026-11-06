// The Library page's own view state: tab, grouping, select mode, folded
// groups and the folder being renamed.
import { useEffect, useState } from "preact/hooks";
import { newId, nextColor } from "../../actions.ts";
import { useUi } from "../../context.ts";
import type { GroupBy } from "../../model/library-groups.ts";
import type { LibTab } from "./head/LibraryTabs.tsx";

/** Folded groups: one at a time, or all at once. */
function useFolding() {
  const [closed, setClosed] = useState<ReadonlySet<string>>(new Set());
  const toggle = (key: string): void => {
    setClosed((c) =>
      c.has(key)
        ? new Set([...c].filter((k) => k !== key))
        : new Set([...c, key]),
    );
  };
  /** Collapse every group, or open them all when they already are. */
  const collapseAll = (keys: readonly string[]): void => {
    setClosed((c) => (keys.every((k) => c.has(k)) ? new Set() : new Set(keys)));
  };
  return { closed, toggle, collapseAll };
}

export function usePageState() {
  const { state, store, actions, t } = useUi();
  const [by, setBy] = useState<GroupBy>("folder");
  const [selecting, setSelecting] = useState(false);
  const { closed, toggle, collapseAll } = useFolding();
  // A system opened from elsewhere (the Update page) shows on its tab.
  const [tab, setTab] = useState<LibTab>(
    state.side?.kind === "system" ? "systems" : "modules",
  );
  const [renaming, setRenaming] = useState<string | null>(null);
  // A selection doesn't outlive the page: no stale picks on return (review).
  useEffect(
    () => () => {
      store.set({ selection: [] });
    },
    [store],
  );
  const onSelecting = (on: boolean): void => {
    setSelecting(on);
    if (!on) store.set({ selection: [] });
  };
  /** A folder named "New folder", grouped by folder and renamed in place. */
  const newFolder = (): void => {
    const folder = {
      id: newId(),
      name: t("folder.newName"),
      color: nextColor(state.data.library.folders.length),
      parentId: null,
    };
    void actions.op({ op: "folder.create", folder });
    setBy("folder");
    setTab("modules");
    setRenaming(folder.id);
  };
  return {
    by,
    setBy,
    selecting,
    onSelecting,
    closed,
    toggle,
    collapseAll,
    tab,
    setTab,
    renaming,
    setRenaming,
    newFolder,
  };
}

export type PageState = ReturnType<typeof usePageState>;
