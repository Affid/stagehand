// Folders in the sidebar (S-1, S-2): select, create, rename, colour,
// reorder, delete, and drop modules onto them.
import type { Folder } from "@module-library/shared/library/schema";
import type { TargetedDragEvent } from "preact";
import { useState } from "preact/hooks";
import { newId, nextColor, PALETTE } from "../actions.ts";
import { Dot, IconButton, InlineInput } from "../common/widgets.tsx";
import { useUi } from "../context.ts";
import { orderedFolders } from "../model/modules.ts";
import { draggedIds, isModuleDrag } from "./drag.ts";

type FolderChanges = Partial<Pick<Folder, "name" | "color" | "collapsed">>;

/** Folder operations, each sent with the revision the UI last saw (D-2). */
export function useFolderOps() {
  const { actions, t } = useUi();
  return {
    update(f: Folder, changes: FolderChanges): void {
      void actions.op({
        op: "folder.update",
        id: f.id,
        baseRevision: f.revision,
        changes,
      });
    },
    move(f: Folder, order: number): void {
      void actions.op({
        op: "folder.move",
        id: f.id,
        baseRevision: f.revision,
        order: Math.max(0, order),
      });
    },
    remove(f: Folder): void {
      if (window.confirm(t("folder.deleteConfirm", { name: f.name })))
        void actions.op({
          op: "folder.delete",
          id: f.id,
          baseRevision: f.revision,
        });
    },
    assign(ids: readonly string[], folderId: string | null): void {
      if (ids.length > 0)
        void actions.op({
          op: "module.setFolder",
          moduleIds: [...ids],
          folderId,
        });
    },
    create(name: string, used: number): void {
      const folder = {
        id: newId(),
        name,
        color: nextColor(used),
        parentId: null,
      };
      void actions.op({ op: "folder.create", folder });
    },
  };
}

/** Drag-over highlighting and drop handling for module drags. */
function useModuleDrop(enabled: boolean, onDrop: (ids: string[]) => void) {
  const [over, setOver] = useState(false);
  return {
    over,
    onDragOver: (e: TargetedDragEvent<HTMLElement>): void => {
      if (!enabled || !isModuleDrag(e)) return;
      e.preventDefault();
      setOver(true);
    },
    onDragLeave: (): void => {
      setOver(false);
    },
    onDrop: (e: TargetedDragEvent<HTMLElement>): void => {
      e.preventDefault();
      setOver(false);
      onDrop(draggedIds(e));
    },
  };
}

interface ItemProps {
  readonly folder: Folder | null;
  readonly count: number;
  readonly index: number;
  readonly total: number;
}

function FolderMenu(
  props: ItemProps & { readonly folder: Folder; readonly onRename: () => void },
) {
  const { t } = useUi();
  const ops = useFolderOps();
  const { folder, index } = props;
  const nextColour =
    PALETTE[(PALETTE.indexOf(folder.color) + 1) % PALETTE.length] ??
    folder.color;
  return (
    <span class="ml-item-tools">
      <IconButton
        icon="pen"
        label={t("folder.rename")}
        onClick={props.onRename}
      />
      <IconButton
        icon="palette"
        label={t("folder.color")}
        onClick={() => ops.update(folder, { color: nextColour })}
      />
      <IconButton
        icon="arrow-up"
        label={t("folder.moveUp")}
        disabled={index === 0}
        onClick={() => ops.move(folder, index - 1)}
      />
      <IconButton
        icon="arrow-down"
        label={t("folder.moveDown")}
        disabled={index >= props.total - 1}
        onClick={() => ops.move(folder, index + 1)}
      />
      <IconButton
        icon="trash"
        label={t("folder.delete")}
        onClick={() => ops.remove(folder)}
      />
    </span>
  );
}

function RenameFolder(props: {
  readonly folder: Folder;
  readonly onDone: () => void;
}) {
  const { t } = useUi();
  const ops = useFolderOps();
  return (
    <li>
      <InlineInput
        initial={props.folder.name}
        label={t("folder.namePrompt")}
        onCancel={props.onDone}
        onCommit={(name) => {
          props.onDone();
          ops.update(props.folder, { name });
        }}
      />
    </li>
  );
}

function FolderItem(props: ItemProps) {
  const { state, store, t, canChange } = useUi();
  const ops = useFolderOps();
  const [renaming, setRenaming] = useState(false);
  const { folder } = props;
  const id = folder?.id ?? null;
  const drop = useModuleDrop(canChange, (ids) => ops.assign(ids, id));
  const active = state.scope.kind === "folder" && state.scope.id === id;
  if (renaming && folder)
    return <RenameFolder folder={folder} onDone={() => setRenaming(false)} />;
  const classes = `ml-side-item${active ? " ml-on" : ""}${drop.over ? " ml-drop" : ""}${folder?.parentId ? " ml-child" : ""}`;
  return (
    <li
      class={classes}
      onDragOver={drop.onDragOver}
      onDragLeave={drop.onDragLeave}
      onDrop={drop.onDrop}
    >
      <button
        type="button"
        class="ml-side-label"
        data-folder={id ?? ""}
        onClick={() =>
          store.set({ scope: { kind: "folder", id }, selection: [] })
        }
      >
        {folder ? <Dot color={folder.color} /> : null}
        <span>{folder ? folder.name : t("sidebar.unfiled")}</span>
        <span class="ml-count">{props.count}</span>
      </button>
      {folder && canChange ? (
        <FolderMenu
          {...props}
          folder={folder}
          onRename={() => setRenaming(true)}
        />
      ) : null}
    </li>
  );
}

function AllModules(props: { readonly total: number }) {
  const { state, store, t } = useUi();
  return (
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
  );
}

export function FolderList(props: {
  readonly counts: Readonly<Record<string, number>>;
  readonly total: number;
  readonly unfiled: number;
}) {
  const { state, t, canChange } = useUi();
  const ops = useFolderOps();
  const [creating, setCreating] = useState(false);
  const folders = orderedFolders(state.data.library);
  return (
    <section class="ml-side-section" aria-label={t("sidebar.folders")}>
      <h3>{t("sidebar.folders")}</h3>
      <ul>
        <AllModules total={props.total} />
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
              onCommit={(name) => {
                setCreating(false);
                ops.create(name, folders.length);
              }}
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
