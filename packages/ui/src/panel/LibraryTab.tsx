// A module's Library tab: folder, tags, note, the presets that hold it, and
// every world: a switch that queues a change for its next launch, or
// "companion off" where Stagehand isn't set up. Inside a world it is
// WorldLibraryTab.
import type { PackageInfo } from "@stagehand/shared/package";
import { useState } from "preact/hooks";
import { IconButton } from "../common/widgets.tsx";
import { useModules } from "../context.ts";
import { type Where, WorldItem } from "./WorldItem.tsx";
import { WorldLibraryTab } from "./WorldLibraryTab.tsx";
import { worldOrder } from "../model/order.ts";
import { worldModules } from "../model/world-modules.ts";

export function FolderField(props: { readonly id: string }) {
  const { t, data, organise, canOrganise } = useModules();
  const { library } = data;
  const current = library.modules[props.id]?.folderId ?? "";
  return (
    <label class="stl-field">
      <span>{t("mp.folder")}</span>
      <select
        aria-label={t("mp.folder")}
        value={current}
        disabled={!canOrganise}
        onChange={(e) => {
          const v = e.currentTarget.value;
          void organise({
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
  const { t } = useModules();
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
  const { t, data, organise, canOrganise } = useModules();
  const { library } = data;
  const ids = library.modules[props.id]?.tags ?? [];
  const mine = library.tags.filter((tag) => ids.includes(tag.id));
  const others = library.tags.filter((tag) => !ids.includes(tag.id));
  const set = (add: string[], remove: string[]): void => {
    void organise({
      op: "module.setTags",
      moduleIds: [props.id],
      add,
      remove,
    });
  };
  return (
    <div class="stl-field">
      <span>{t("mp.tags")}</span>
      <div class="stl-chips">
        {mine.map((tag) => (
          <span key={tag.id} class="stl-tag" style={{ "--st-c": tag.color }}>
            <i class="st-dot" aria-hidden="true" />
            {tag.name}
            {canOrganise ? (
              <IconButton
                icon="xmark"
                label={t("mp.removeTag", { tag: tag.name })}
                onClick={() => set([], [tag.id])}
              />
            ) : null}
          </span>
        ))}
        {canOrganise ? (
          <AddTag others={others} onAdd={(id) => set([id], [])} />
        ) : null}
      </div>
    </div>
  );
}

/** Saves when it loses focus, as every text field on the page does. */
function NoteField(props: { readonly id: string }) {
  const { t, data, organise, canOrganise } = useModules();
  const saved = data.library.modules[props.id]?.note ?? "";
  const [text, setText] = useState(saved);
  return (
    <label class="stl-field">
      <span>{t("mp.note")}</span>
      <textarea
        aria-label={t("mp.note")}
        maxLength={4000}
        value={text}
        disabled={!canOrganise}
        onInput={(e) => setText(e.currentTarget.value)}
        onBlur={(e) => {
          // The field's own value: a click right after typing must not lose it.
          const note = e.currentTarget.value;
          if (note.trim() !== saved.trim())
            void organise({ op: "module.setNote", moduleId: props.id, note });
        }}
      />
    </label>
  );
}

/** Every world, in Foundry's order; worlds without the companion say so. */
function Worlds(props: {
  readonly pkg: PackageInfo;
  readonly here: string | undefined;
}) {
  const { t, data } = useModules();
  const worlds = worldOrder(data.setup?.worlds ?? [], data.setup?.lang);
  // Each world's modules once per render (review: not twice per world).
  const where: Where[] = worlds.map((w) => {
    const m = worldModules(data, w.id);
    return {
      world: w,
      tracked: m.tracked,
      row: m.rows.find((r) => r.pkg.id === props.pkg.id),
    };
  });
  const onIn = where.filter((x) => x.row?.next).length;
  return (
    <div class="sts-chg">
      <h4>
        <span>
          {t("mp.onIn", { n: String(onIn), total: String(worlds.length) })}
        </span>
      </h4>
      <ul class="sts-wlist">
        {where.map((x) => (
          <WorldItem
            key={x.world.id}
            pkg={props.pkg}
            where={x}
            here={x.world.id === props.here}
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
  const { where } = useModules();
  if (where === "world" && props.here)
    return <WorldLibraryTab pkg={props.pkg} here={props.here} />;
  return <SetupLibraryTab pkg={props.pkg} here={props.here} />;
}

function SetupLibraryTab(props: {
  readonly pkg: PackageInfo;
  readonly here?: string | undefined;
}) {
  const { t, data } = useModules();
  const { pkg } = props;
  const presets = data.library.presets.filter((p) =>
    p.modules.includes(pkg.id),
  );
  return (
    <div class="stl-libtab">
      <FolderField id={pkg.id} />
      <TagsField id={pkg.id} />
      <NoteField
        // Starts again when the saved note changes elsewhere (import, another tab).
        key={`${pkg.id}:${data.library.modules[pkg.id]?.note ?? ""}`}
        id={pkg.id}
      />
      <div class="stl-field">
        <span>{t("mp.presets")}</span>
        <span class="stl-chips">
          {presets.length
            ? presets.map((p) => (
                <span key={p.id} class="stl-tag stl-chip preset">
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
