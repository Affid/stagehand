// A module's Library tab: folder, tags, note, the presets that hold it, and
// a switch per tracked world that queues a change for its next launch.
import type { PackageInfo } from "@module-library/shared/package";
import { useState } from "preact/hooks";
import { IconButton } from "../../common/widgets.tsx";
import { useUi } from "../../context.ts";
import { worldModules } from "../../model/world-modules.ts";

function FolderField(props: { readonly id: string }) {
  const { state, actions, t, canChange } = useUi();
  const { library } = state.data;
  const current = library.modules[props.id]?.folderId ?? "";
  return (
    <label class="mll-field">
      <span>{t("mp.folder")}</span>
      <select
        aria-label={t("mp.folder")}
        value={current}
        disabled={!canChange}
        onChange={(e) => {
          const v = e.currentTarget.value;
          void actions.op({
            op: "module.setFolder",
            moduleIds: [props.id],
            folderId: v === "" ? null : v,
          });
        }}
      >
        <option value="">{t("folder.none")}</option>
        {library.folders.map((f) => (
          <option key={f.id} value={f.id}>
            {f.name}
          </option>
        ))}
      </select>
    </label>
  );
}

function AddTag(props: {
  readonly others: readonly { readonly id: string; readonly name: string }[];
  readonly onAdd: (id: string) => void;
}) {
  const { t } = useUi();
  if (props.others.length === 0) return null;
  return (
    <select
      aria-label={t("mp.addTag")}
      value=""
      onChange={(e) => {
        if (e.currentTarget.value) props.onAdd(e.currentTarget.value);
      }}
    >
      <option value="">{t("mp.addTag")}</option>
      {props.others.map((tag) => (
        <option key={tag.id} value={tag.id}>
          {tag.name}
        </option>
      ))}
    </select>
  );
}

function TagsField(props: { readonly id: string }) {
  const { state, actions, t, canChange } = useUi();
  const { library } = state.data;
  const ids = library.modules[props.id]?.tags ?? [];
  const mine = library.tags.filter((tag) => ids.includes(tag.id));
  const others = library.tags.filter((tag) => !ids.includes(tag.id));
  const set = (add: string[], remove: string[]): void => {
    void actions.op({
      op: "module.setTags",
      moduleIds: [props.id],
      add,
      remove,
    });
  };
  return (
    <div class="mll-field">
      <span>{t("mp.tags")}</span>
      <div class="mll-chips">
        {mine.map((tag) => (
          <span key={tag.id} class="mll-tag" style={{ "--ml-c": tag.color }}>
            <i class="ml-dot" aria-hidden="true" />
            {tag.name}
            {canChange ? (
              <IconButton
                icon="xmark"
                label={t("mp.removeTag", { tag: tag.name })}
                onClick={() => set([], [tag.id])}
              />
            ) : null}
          </span>
        ))}
        {canChange ? (
          <AddTag others={others} onAdd={(id) => set([id], [])} />
        ) : null}
      </div>
    </div>
  );
}

/** Saves when it loses focus, as every text field on the page does. */
function NoteField(props: { readonly id: string }) {
  const { state, actions, t, canChange } = useUi();
  const saved = state.data.library.modules[props.id]?.note ?? "";
  const [text, setText] = useState(saved);
  return (
    <label class="mll-field">
      <span>{t("mp.note")}</span>
      <textarea
        aria-label={t("mp.note")}
        maxLength={4000}
        value={text}
        disabled={!canChange}
        onInput={(e) => setText(e.currentTarget.value)}
        onBlur={(e) => {
          // The field's own value: a click right after typing must not lose it.
          const note = e.currentTarget.value;
          if (note.trim() !== saved.trim())
            void actions.op({ op: "module.setNote", moduleId: props.id, note });
        }}
      />
    </label>
  );
}

function Worlds(props: { readonly pkg: PackageInfo }) {
  const { state, actions, t, canChange } = useUi();
  const tracked = (state.data.setup?.worlds ?? []).filter(
    (w) => state.data.snapshots[w.id],
  );
  if (tracked.length === 0) return <p class="ml-empty">{t("mp.noWorlds")}</p>;
  return (
    <ul class="mll-worlds">
      {tracked.map((w) => {
        const row = worldModules(state.data, w.id).rows.find(
          (r) => r.pkg.id === props.pkg.id,
        );
        const on = row?.next ?? false;
        return (
          <li key={w.id}>
            <input
              type="checkbox"
              role="switch"
              class="mls-switch"
              checked={on}
              disabled={!canChange}
              aria-label={t("wp.switch", {
                module: props.pkg.title,
                world: w.title,
              })}
              onClick={(e) => {
                e.preventDefault();
                void actions.flip(w.id, props.pkg.id, !on);
              }}
            />
            <span>{w.title}</span>
            {row?.delta ? (
              <span class={`d ${row.delta}`}>{t(`wp.delta.${row.delta}`)}</span>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

export function LibraryTab(props: { readonly pkg: PackageInfo }) {
  const { state, t } = useUi();
  const { pkg } = props;
  const presets = state.data.library.presets.filter((p) =>
    p.modules.includes(pkg.id),
  );
  return (
    <div class="mll-libtab">
      <FolderField id={pkg.id} />
      <TagsField id={pkg.id} />
      <NoteField key={pkg.id} id={pkg.id} />
      <div class="mll-field">
        <span>{t("mp.presets")}</span>
        <span>
          {presets.length
            ? presets.map((p) => p.name).join(", ")
            : t("mp.noPresets")}
        </span>
      </div>
      <h4>{t("mp.worlds")}</h4>
      <Worlds pkg={pkg} />
    </div>
  );
}
