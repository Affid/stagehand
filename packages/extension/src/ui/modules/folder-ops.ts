// Folder operations, each sent with the revision the UI last saw (D-2).
import type { Folder } from "@module-library/shared/library/schema";
import { newId, nextColor } from "../actions.ts";
import { useUi } from "../context.ts";

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
