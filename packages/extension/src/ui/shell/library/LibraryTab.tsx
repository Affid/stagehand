// A module's Library tab: folder, tags, note, the presets that hold it, and
// every world: a switch that queues a change for its next launch, or
// "companion off" where Module Library isn't set up.
import type { PackageInfo } from "@module-library/shared/package";
import type { WorldInfo } from "@module-library/shared/world";
import { useState } from "preact/hooks";
import { IconButton } from "../../common/widgets.tsx";
import { useUi } from "../../context.ts";
import { worldOrder } from "../../model/order.ts";
import { COMPANION_ID } from "../../model/preview.ts";
import { worldModules } from "../../model/world-modules.ts";

export function FolderField(props: { readonly id: string }) {
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

export function TagsField(props: { readonly id: string }) {
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

function WorldItem(props: {
  readonly pkg: PackageInfo;
  readonly world: WorldInfo;
  readonly here: boolean;
}) {
  const { state, actions, t, canChange } = useUi();
  const { pkg, world } = props;
  const model = worldModules(state.data, world.id);
  const row = model.rows.find((r) => r.pkg.id === pkg.id);
  const on = row?.next ?? false;
  return (
    <li class={props.here ? "mls-here" : ""}>
      <span>
        {world.title}
        {props.here ? (
          <span class="ml-muted"> · {t("mp.thisWorld")}</span>
        ) : null}
      </span>
      {!model.tracked ? (
        <span class="d na">{t("grid.off")}</span>
      ) : row?.delta ? (
        <span class={`d ${row.delta === "on" ? "plus" : "minus"}`}>
          {t(`mp.delta.${row.delta}`)}
        </span>
      ) : (
        <span />
      )}
      <input
        type="checkbox"
        role="switch"
        class="mls-switch"
        checked={on}
        disabled={!canChange || !model.tracked || pkg.id === COMPANION_ID}
        aria-label={t("wp.switch", { module: pkg.title, world: world.title })}
        onClick={(e) => {
          e.preventDefault();
          void actions.flip(world.id, pkg.id, !on);
        }}
      />
    </li>
  );
}

/** Every world, in Foundry's order; worlds without the companion say so. */
function Worlds(props: {
  readonly pkg: PackageInfo;
  readonly here: string | undefined;
}) {
  const { state, t } = useUi();
  const worlds = worldOrder(
    state.data.setup?.worlds ?? [],
    state.data.setup?.lang,
  );
  const onIn = worlds.filter(
    (w) =>
      worldModules(state.data, w.id).rows.find((r) => r.pkg.id === props.pkg.id)
        ?.next,
  ).length;
  return (
    <div class="mls-chg">
      <h4>
        <span>
          {t("mp.onIn", { n: String(onIn), total: String(worlds.length) })}
        </span>
      </h4>
      <ul class="mls-wlist">
        {worlds.map((w) => (
          <WorldItem
            key={w.id}
            pkg={props.pkg}
            world={w}
            here={w.id === props.here}
          />
        ))}
      </ul>
    </div>
  );
}

export function LibraryTab(props: {
  readonly pkg: PackageInfo;
  readonly here?: string | undefined;
}) {
  const { state, t } = useUi();
  const { pkg } = props;
  const presets = state.data.library.presets.filter((p) =>
    p.modules.includes(pkg.id),
  );
  return (
    <div class="mll-libtab">
      <FolderField id={pkg.id} />
      <TagsField id={pkg.id} />
      <NoteField
        // Starts again when the saved note changes elsewhere (import, another tab).
        key={`${pkg.id}:${state.data.library.modules[pkg.id]?.note ?? ""}`}
        id={pkg.id}
      />
      <div class="mll-field">
        <span>{t("mp.presets")}</span>
        <span class="mll-chips">
          {presets.length
            ? presets.map((p) => (
                <span key={p.id} class="mll-tag mll-chip preset">
                  <i class="fa-solid fa-layer-group" aria-hidden="true" />
                  {p.name}
                </span>
              ))
            : t("mp.noPresets")}
        </span>
      </div>
      <Worlds pkg={pkg} here={props.here} />
    </div>
  );
}
