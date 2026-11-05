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

export function BulkBar(props: { readonly model: ModulesModel }) {
  const { state, store, actions, t, canChange } = useUi();
  const { selection } = state;
  const { library } = state.data;
  if (!canChange) return null;
  const selectAll = (): void => {
    store.set({ selection: props.model.visible.map((m) => m.id) });
  };
  if (selection.length === 0)
    return (
      <div class="ml-bulk">
        <button type="button" class="ml-link" onClick={selectAll}>
          {t("bulk.selectAll")}
        </button>
      </div>
    );
  const ids = [...selection];
  return (
    <div
      class="ml-bulk ml-bulk-active"
      role="toolbar"
      aria-label={t("bulk.selected", { n: ids.length })}
    >
      <strong>{t("bulk.selected", { n: ids.length })}</strong>
      <select
        aria-label={t("bulk.moveTo")}
        value=""
        onChange={(e) => {
          const v = e.currentTarget.value;
          if (v)
            void actions.op({
              op: "module.setFolder",
              moduleIds: ids,
              folderId: v === "-" ? null : v,
            });
        }}
      >
        <option value="">{t("bulk.moveTo")}</option>
        <option value="-">{t("folder.none")}</option>
        {library.folders.map((f) => (
          <option key={f.id} value={f.id}>
            {f.name}
          </option>
        ))}
      </select>
      <TagSelect
        label={t("bulk.addTag")}
        onPick={(id) =>
          void actions.op({
            op: "module.setTags",
            moduleIds: ids,
            add: [id],
            remove: [],
          })
        }
      />
      <TagSelect
        label={t("bulk.removeTag")}
        onPick={(id) =>
          void actions.op({
            op: "module.setTags",
            moduleIds: ids,
            add: [],
            remove: [id],
          })
        }
      />
      <button
        type="button"
        onClick={() => store.set({ editingPreset: "new", draftModules: ids })}
      >
        {t("bulk.preset")}
      </button>
      <button
        type="button"
        class="ml-link"
        onClick={() => store.set({ selection: [] })}
      >
        {t("bulk.clear")}
      </button>
    </div>
  );
}

function TagSelect(props: {
  readonly label: string;
  readonly onPick: (id: string) => void;
}) {
  const { state } = useUi();
  return (
    <select
      aria-label={props.label}
      value=""
      onChange={(e) => {
        if (e.currentTarget.value) props.onPick(e.currentTarget.value);
      }}
    >
      <option value="">{props.label}</option>
      {state.data.library.tags.map((tag) => (
        <option key={tag.id} value={tag.id}>
          {tag.name}
        </option>
      ))}
    </select>
  );
}
