// One module: selection, drag, folder and tags, note (S-6), authors,
// "used in N worlds" (W-3) and an unverified badge (G-5).
import type { PackageInfo } from "@module-library/shared/package";
import { Availability, testAvailability } from "@module-library/shared/version";
import { useState } from "preact/hooks";
import { safeUrl } from "../common/files.ts";
import { Dot, IconButton } from "../common/widgets.tsx";
import { useUi } from "../context.ts";
import type { ModulesModel } from "./derived.ts";
import { startDrag } from "./drag.ts";

function NoteEditor(props: {
  readonly id: string;
  readonly note: string;
  readonly onDone: () => void;
}) {
  const { actions, t } = useUi();
  const [text, setText] = useState(props.note);
  const save = (): void => {
    props.onDone();
    if (text.trim() !== props.note)
      void actions.op({ op: "module.setNote", moduleId: props.id, note: text });
  };
  return (
    <div class="ml-note-editor">
      <textarea
        aria-label={t("row.note")}
        maxLength={4000}
        value={text}
        onInput={(e) => {
          setText(e.currentTarget.value);
        }}
      />
      <button type="button" onClick={save}>
        {t("row.noteSave")}
      </button>
    </div>
  );
}

function Authors(props: { readonly pkg: PackageInfo }) {
  return (
    <span class="ml-authors">
      {props.pkg.authors.map((a, i) => {
        const url = safeUrl(a.url);
        return url ? (
          <a key={i} href={url} target="_blank" rel="noopener noreferrer">
            {a.name}
          </a>
        ) : (
          <span key={i}>{a.name}</span>
        );
      })}
    </span>
  );
}

function Badges(props: {
  readonly pkg: PackageInfo;
  readonly model: ModulesModel;
}) {
  const { state, t } = useUi();
  const { pkg, model } = props;
  const meta = state.data.library.modules[pkg.id];
  const tags = (meta?.tags ?? []).flatMap((id) =>
    state.data.library.tags.filter((tag) => tag.id === id),
  );
  const used = model.usage[pkg.id];
  const verified =
    testAvailability(pkg.compatibility, model.core) === Availability.VERIFIED;
  return (
    <span class="ml-badges">
      {tags.map((tag) => (
        <span
          key={tag.id}
          class="ml-tag ml-small"
          style={{ borderColor: tag.color }}
        >
          <Dot color={tag.color} />
          {tag.name}
        </span>
      ))}
      {pkg.library ? <span class="ml-badge">{t("row.library")}</span> : null}
      {used !== undefined ? (
        <span class="ml-badge">{t("row.usedIn", { n: used })}</span>
      ) : null}
      {verified ? null : (
        <span class="ml-badge ml-warn">
          {t("row.unverified", { version: model.core.version })}
        </span>
      )}
    </span>
  );
}

function RowHeading(props: { readonly pkg: PackageInfo }) {
  const { pkg } = props;
  return (
    <div class="ml-row-line">
      <span class="ml-title">{pkg.title}</span>
      <span class="ml-id">{pkg.id}</span>
      <span class="ml-version">{pkg.version}</span>
      <Authors pkg={pkg} />
    </div>
  );
}

/** Selection of one row: toggles it in the store's selection. */
function useRowSelection(id: string) {
  const { state, store } = useUi();
  const selected = state.selection.includes(id);
  const toggle = (): void => {
    store.set((s) => ({
      selection: selected
        ? s.selection.filter((x) => x !== id)
        : [...s.selection, id],
    }));
  };
  return { selected, toggle, dragged: selected ? state.selection : [id] };
}

export function ModuleRow(props: {
  readonly pkg: PackageInfo;
  readonly model: ModulesModel;
}) {
  const { state, t, canChange } = useUi();
  const [editing, setEditing] = useState(false);
  const { pkg } = props;
  const row = useRowSelection(pkg.id);
  const note = state.data.library.modules[pkg.id]?.note ?? "";
  return (
    <li
      class={`ml-row${row.selected ? " ml-selected" : ""}`}
      data-module={pkg.id}
      draggable={canChange}
      onDragStart={(e) => startDrag(e, row.dragged)}
    >
      <input
        type="checkbox"
        checked={row.selected}
        aria-label={t("row.select", { title: pkg.title })}
        onChange={row.toggle}
      />
      <div class="ml-row-main">
        <RowHeading pkg={pkg} />
        <Badges pkg={pkg} model={props.model} />
        {note && !editing ? <p class="ml-note">{note}</p> : null}
        {editing ? (
          <NoteEditor
            id={pkg.id}
            note={note}
            onDone={() => setEditing(false)}
          />
        ) : null}
      </div>
      {canChange ? (
        <IconButton
          icon="note-sticky"
          label={note ? t("row.note") : t("row.noteAdd")}
          onClick={() => setEditing(!editing)}
        />
      ) : null}
    </li>
  );
}
