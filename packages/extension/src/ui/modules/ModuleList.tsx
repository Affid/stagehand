// The organised list: grouped by folder (collapsible, S-1) when showing
// everything, flat otherwise; plus bulk actions on the selection.
import type { Folder } from "@module-library/shared/library/schema";
import type { PackageInfo } from "@module-library/shared/package";
import { Dot } from "../common/widgets.tsx";
import { useUi } from "../context.ts";
import { groupByFolder } from "../model/modules.ts";
import type { ModulesModel } from "./derived.ts";
import { ModuleRow } from "./ModuleRow.tsx";

function FolderHeader(props: {
  readonly folder: Folder | null;
  readonly count: number;
}) {
  const { actions, t, canChange } = useUi();
  const { folder } = props;
  const collapsed = folder?.collapsed ?? false;
  const toggle = (): void => {
    if (folder && canChange)
      void actions.op({
        op: "folder.update",
        id: folder.id,
        baseRevision: folder.revision,
        changes: { collapsed: !collapsed },
      });
  };
  return (
    <button
      type="button"
      class="ml-group-header"
      aria-expanded={!collapsed}
      onClick={toggle}
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
        <section
          key={g.folder?.id ?? "unfiled"}
          class="ml-group"
          data-folder-group={g.folder?.id ?? ""}
        >
          <FolderHeader folder={g.folder} count={g.modules.length} />
          {g.folder?.collapsed ? null : (
            <Rows modules={g.modules} model={model} />
          )}
        </section>
      ))}
    </div>
  );
}
