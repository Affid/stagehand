// The Library page's own view state: tab, grouping, select mode, folded
// groups and the folder being renamed.
import { useState } from "preact/hooks";
import { newId, nextColor } from "../../actions.ts";
import { useUi } from "../../context.ts";
import type { GroupBy } from "../../model/library-groups.ts";
import type { LibTab } from "./head/LibraryTabs.tsx";

export function usePageState() {
  const { state, store, actions, t } = useUi();
  const [by, setBy] = useState<GroupBy>("folder");
  const [selecting, setSelecting] = useState(false);
  const [closed, setClosed] = useState<ReadonlySet<string>>(new Set());
  const [tab, setTab] = useState<LibTab>("modules");
  const [renaming, setRenaming] = useState<string | null>(null);
  const toggle = (key: string): void => {
    setClosed((c) =>
      c.has(key)
        ? new Set([...c].filter((k) => k !== key))
        : new Set([...c, key]),
    );
  };
  const onSelecting = (on: boolean): void => {
    setSelecting(on);
    if (!on) store.set({ selection: [] });
  };
  /** Collapse every group, or open them all when they already are. */
  const collapseAll = (keys: readonly string[]): void => {
    setClosed((c) => (keys.every((k) => c.has(k)) ? new Set() : new Set(keys)));
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
