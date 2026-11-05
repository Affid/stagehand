// The organised list: grouped by folder (collapsible, S-1) when showing
// everything, flat otherwise; plus bulk actions on the selection.
import type { Folder } from "@module-library/shared/library/schema";
import type { PackageInfo } from "@module-library/shared/package";
import { Dot } from "../common/widgets.tsx";
import { useUi } from "../context.ts";
import { groupByFolder } from "../model/modules.ts";
import type { ModulesModel } from "./derived.ts";
import { ModuleRow } from "./ModuleRow.tsx";

const UNFILED = "unfiled";

/** Collapsed state: folders keep it in the library, Unfiled in the UI. */
function useCollapse(folder: Folder | null) {
  const { state, store, actions, canChange } = useUi();
  if (!folder) {
    const collapsed = state.collapsedGroups.includes(UNFILED);
    return {
      collapsed,
      toggle: (): void => {
        store.set((s) => ({
          collapsedGroups: collapsed
            ? s.collapsedGroups.filter((g) => g !== UNFILED)
            : [...s.collapsedGroups, UNFILED],
        }));
      },
    };
  }
  const collapsed = folder.collapsed;
  return {
    collapsed,
    toggle: (): void => {
      if (canChange)
        void actions.op({
          op: "folder.update",
          id: folder.id,
          baseRevision: folder.revision,
          changes: { collapsed: !collapsed },
        });
    },
  };
}

function FolderHeader(props: {
  readonly folder: Folder | null;
  readonly count: number;
  readonly collapsed: boolean;
  readonly onToggle: () => void;
}) {
  const { t } = useUi();
  const { folder, collapsed } = props;
  return (
    <button
      type="button"
      class="ml-group-header"
      aria-expanded={!collapsed}
      onClick={props.onToggle}
    >
      <i
        class={`fa-solid fa-chevron-${collapsed ? "right" : "down"} fa-fw`}
        aria-hidden="true"
      />
      {folder ? <Dot color={folder.color} /> : null}
      <span>{folder ? folder.name : t("sidebar.unfiled")}</span>
      <span class="ml-count">{props.count}</span>
    </button>
  );
}

function Group(props: {
  readonly folder: Folder | null;
  readonly modules: readonly PackageInfo[];
  readonly model: ModulesModel;
}) {
  const { collapsed, toggle } = useCollapse(props.folder);
  return (
    <section class="ml-group" data-folder-group={props.folder?.id ?? ""}>
      <FolderHeader
        folder={props.folder}
        count={props.modules.length}
        collapsed={collapsed}
        onToggle={toggle}
      />
      {collapsed ? null : <Rows modules={props.modules} model={props.model} />}
    </section>
  );
}

const Rows = (props: {
  readonly modules: readonly PackageInfo[];
  readonly model: ModulesModel;
}) => (
  <ul class="ml-rows">
    {props.modules.map((m) => (
      <ModuleRow key={m.id} pkg={m} model={props.model} />
    ))}
  </ul>
);

export function ModuleList(props: { readonly model: ModulesModel }) {
  const { state, t } = useUi();
  const { model } = props;
  if (model.visible.length === 0)
    return <p class="ml-empty">{t("list.empty")}</p>;
  if (state.scope.kind !== "all")
    return <Rows modules={model.visible} model={model} />;
  return (
    <div class="ml-groups">
      {groupByFolder(model.visible, state.data.library).map((g) => (
        <Group
          key={g.folder?.id ?? UNFILED}
          folder={g.folder}
          modules={g.modules}
          model={model}
        />
      ))}
    </div>
  );
}
