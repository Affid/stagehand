// Folders in the sidebar (S-1, S-2): select, create, rename, colour,
// reorder, delete, and drop modules onto them.
import type { Folder } from "@module-library/shared/library/schema";
import { useState } from "preact/hooks";
import { newId, nextColor, PALETTE } from "../actions.ts";
import { Dot, IconButton, InlineInput } from "../common/widgets.tsx";
import { useUi } from "../context.ts";
import { orderedFolders } from "../model/modules.ts";
import { draggedIds, isModuleDrag } from "./drag.ts";

function FolderItem(props: {
  readonly folder: Folder | null;
  readonly count: number;
  readonly index: number;
  readonly total: number;
}) {
  const { state, store, actions, t, canChange } = useUi();
  const [renaming, setRenaming] = useState(false);
  const [over, setOver] = useState(false);
  const { folder } = props;
  const id = folder?.id ?? null;
  const active = state.scope.kind === "folder" && state.scope.id === id;
  const select = (): void => {
    store.set({ scope: { kind: "folder", id }, selection: [] });
  };
  const drop = (ids: string[]): void => {
    if (ids.length > 0)
      void actions.op({ op: "module.setFolder", moduleIds: ids, folderId: id });
  };
  if (renaming && folder)
    return (
      <li>
        <InlineInput
          initial={folder.name}
          label={t("folder.namePrompt")}
          onCancel={() => setRenaming(false)}
          onCommit={(name) => {
            setRenaming(false);
            void actions.op({
              op: "folder.update",
              id: folder.id,
              baseRevision: folder.revision,
              changes: { name },
            });
          }}
        />
      </li>
    );
  return (
    <li
      class={`ml-side-item${active ? " ml-on" : ""}${over ? " ml-drop" : ""}${folder?.parentId ? " ml-child" : ""}`}
      onDragOver={(e) => {
        if (!canChange || !isModuleDrag(e)) return;
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        drop(draggedIds(e));
      }}
    >
      <button
        type="button"
        class="ml-side-label"
        onClick={select}
        data-folder={id ?? ""}
      >
        {folder ? <Dot color={folder.color} /> : null}
        <span>{folder ? folder.name : t("sidebar.unfiled")}</span>
        <span class="ml-count">{props.count}</span>
      </button>
      {folder && canChange ? (
        <FolderMenu
          folder={folder}
          index={props.index}
          total={props.total}
          onRename={() => setRenaming(true)}
        />
      ) : null}
    </li>
  );
}

function FolderMenu(props: {
  readonly folder: Folder;
  readonly index: number;
  readonly total: number;
  readonly onRename: () => void;
}) {
  const { actions, t } = useUi();
  const { folder } = props;
  const recolor = (): void => {
    const next =
      PALETTE[(PALETTE.indexOf(folder.color) + 1) % PALETTE.length] ??
      folder.color;
    void actions.op({
      op: "folder.update",
      id: folder.id,
      baseRevision: folder.revision,
      changes: { color: next },
    });
  };
  const move = (delta: number): void => {
    void actions.op({
      op: "folder.move",
      id: folder.id,
      baseRevision: folder.revision,
      order: Math.max(0, props.index + delta),
    });
  };
  const remove = (): void => {
    if (window.confirm(t("folder.deleteConfirm", { name: folder.name })))
      void actions.op({
        op: "folder.delete",
        id: folder.id,
        baseRevision: folder.revision,
      });
  };
  return (
    <span class="ml-item-tools">
      <IconButton
        icon="pen"
        label={t("folder.rename")}
        onClick={props.onRename}
      />
      <IconButton icon="palette" label={t("folder.color")} onClick={recolor} />
      <IconButton
        icon="arrow-up"
        label={t("folder.moveUp")}
        disabled={props.index === 0}
        onClick={() => move(-1)}
      />
      <IconButton
        icon="arrow-down"
        label={t("folder.moveDown")}
        disabled={props.index >= props.total - 1}
        onClick={() => move(1)}
      />
      <IconButton icon="trash" label={t("folder.delete")} onClick={remove} />
    </span>
  );
}

export function FolderList(props: {
  readonly counts: Readonly<Record<string, number>>;
  readonly total: number;
  readonly unfiled: number;
}) {
  const { state, store, actions, t, canChange } = useUi();
  const [creating, setCreating] = useState(false);
  const folders = orderedFolders(state.data.library);
  const create = (name: string): void => {
    setCreating(false);
    void actions.op({
      op: "folder.create",
      folder: {
        id: newId(),
        name,
        color: nextColor(folders.length),
        parentId: null,
      },
    });
  };
  return (
    <section class="ml-side-section" aria-label={t("sidebar.folders")}>
      <h3>{t("sidebar.folders")}</h3>
      <ul>
        <li class={`ml-side-item${state.scope.kind === "all" ? " ml-on" : ""}`}>
          <button
            type="button"
            class="ml-side-label"
            onClick={() => store.set({ scope: { kind: "all" }, selection: [] })}
          >
            <span>{t("sidebar.allModules")}</span>
            <span class="ml-count">{props.total}</span>
          </button>
        </li>
        {folders.map((f, i) => (
          <FolderItem
            key={f.id}
            folder={f}
            count={props.counts[f.id] ?? 0}
            index={i}
            total={folders.length}
          />
        ))}
        <FolderItem folder={null} count={props.unfiled} index={-1} total={0} />
        {creating ? (
          <li>
            <InlineInput
              initial=""
              label={t("folder.namePrompt")}
              onCommit={create}
              onCancel={() => setCreating(false)}
            />
          </li>
        ) : null}
      </ul>
      {canChange ? (
        <button type="button" class="ml-link" onClick={() => setCreating(true)}>
          + {t("folder.new")}
        </button>
      ) : null}
    </section>
  );
}
