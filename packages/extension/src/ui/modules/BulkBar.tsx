// Bulk actions on the selected modules: move to a folder, add or remove a
// tag, start a preset (S-1, S-3, P-1).
import { useUi } from "../context.ts";
import type { ModulesModel } from "./derived.ts";
import { useFolderOps } from "./FolderList.tsx";

interface Option {
  readonly value: string;
  readonly label: string;
}

/** A select that acts on pick and then resets to its label. */
function ActionSelect(props: {
  readonly label: string;
  readonly options: readonly Option[];
  readonly onPick: (value: string) => void;
}) {
  return (
    <select
      aria-label={props.label}
      value=""
      onChange={(e) => {
        if (e.currentTarget.value) props.onPick(e.currentTarget.value);
      }}
    >
      <option value="">{props.label}</option>
      {props.options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

function SelectionTools(props: { readonly ids: readonly string[] }) {
  const { state, store, actions, t } = useUi();
  const ops = useFolderOps();
  const { library } = state.data;
  const ids = [...props.ids];
  const folders = [
    { value: "-", label: t("folder.none") },
    ...library.folders.map((f) => ({ value: f.id, label: f.name })),
  ];
  const tags = library.tags.map((tag) => ({ value: tag.id, label: tag.name }));
  const setTags = (add: string[], remove: string[]): void => {
    void actions.op({ op: "module.setTags", moduleIds: ids, add, remove });
  };
  return (
    <>
      <ActionSelect
        label={t("bulk.moveTo")}
        options={folders}
        onPick={(v) => ops.assign(ids, v === "-" ? null : v)}
      />
      <ActionSelect
        label={t("bulk.addTag")}
        options={tags}
        onPick={(v) => setTags([v], [])}
      />
      <ActionSelect
        label={t("bulk.removeTag")}
        options={tags}
        onPick={(v) => setTags([], [v])}
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
    </>
  );
}

export function BulkBar(props: { readonly model: ModulesModel }) {
  const { state, store, t, canChange } = useUi();
  const { selection } = state;
  if (!canChange) return null;
  if (selection.length === 0)
    return (
      <div class="ml-bulk">
        <button
          type="button"
          class="ml-link"
          onClick={() =>
            store.set({ selection: props.model.visible.map((m) => m.id) })
          }
        >
          {t("bulk.selectAll")}
        </button>
      </div>
    );
  return (
    <div
      class="ml-bulk ml-bulk-active"
      role="toolbar"
      aria-label={t("bulk.selected", { n: selection.length })}
    >
      <strong>{t("bulk.selected", { n: selection.length })}</strong>
      <SelectionTools ids={selection} />
    </div>
  );
}
