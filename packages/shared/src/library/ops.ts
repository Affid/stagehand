// Applies a library operation, returning a new library (never mutating).
import { definedChanges, type EntityResult, updateEntity } from "./entities.ts";
import type { LibraryOp } from "./op-schema.ts";
import {
  EMPTY_META,
  type Folder,
  type Library,
  type ModuleMeta,
  type Preset,
  type Tag,
} from "./schema.ts";

export type { LibraryOp } from "./op-schema.ts";
export { LibraryOpSchema } from "./op-schema.ts";

export type OpResult =
  | { readonly ok: true; readonly library: Library }
  | {
      readonly ok: false;
      readonly conflict: {
        readonly entity: string;
        readonly id: string;
        readonly current: unknown;
      };
    }
  | { readonly ok: false; readonly error: string };

const MAX_FOLDER_DEPTH = 2;

const fail = (error: string): OpResult => ({ ok: false, error });

const done = (lib: Library, changes: Partial<Library>): OpResult => ({
  ok: true,
  library: { ...lib, ...changes, revision: lib.revision + 1 },
});

function fromEntity<T>(
  lib: Library,
  key: "folders" | "tags" | "presets",
  result: EntityResult<T>,
  extra: Partial<Library> = {},
): OpResult {
  if (!result.ok) return result;
  return done(lib, { [key]: result.list, ...extra });
}

function depthOf(folders: readonly Folder[], parentId: string | null): number {
  let depth = 1;
  for (let p = parentId; p !== null; depth++)
    p = folders.find((f) => f.id === p)?.parentId ?? null;
  return depth;
}

const renumber = (folders: readonly Folder[]): Folder[] =>
  folders.map((f, order) => (f.order === order ? f : { ...f, order }));

function mapModules(
  lib: Library,
  ids: readonly string[],
  fn: (meta: ModuleMeta) => ModuleMeta,
): Record<string, ModuleMeta> {
  const updated = ids.map((id): [string, ModuleMeta] => [
    id,
    fn(lib.modules[id] ?? EMPTY_META),
  ]);
  return { ...lib.modules, ...Object.fromEntries(updated) };
}

function allModules(
  lib: Library,
  fn: (meta: ModuleMeta) => ModuleMeta,
): Record<string, ModuleMeta> {
  return mapModules(lib, Object.keys(lib.modules), fn);
}

function createFolder(
  lib: Library,
  op: Extract<LibraryOp, { op: "folder.create" }>,
): OpResult {
  const { folder } = op;
  if (lib.folders.some((f) => f.id === folder.id))
    return fail(`folder ${folder.id} exists`);
  if (
    folder.parentId !== null &&
    !lib.folders.some((f) => f.id === folder.parentId)
  )
    return fail(`parent folder ${folder.parentId} not found`);
  if (depthOf(lib.folders, folder.parentId) > MAX_FOLDER_DEPTH)
    return fail(`folders nest to depth ${MAX_FOLDER_DEPTH} at most`);
  const created: Folder = {
    ...folder,
    order: lib.folders.length,
    collapsed: false,
    revision: 1,
  };
  return done(lib, { folders: [...lib.folders, created] });
}

function moveFolder(
  lib: Library,
  op: Extract<LibraryOp, { op: "folder.move" }>,
): OpResult {
  const result = updateEntity(
    "folder",
    lib.folders,
    op.id,
    op.baseRevision,
    (f) => f,
  );
  if (!result.ok) return result;
  const moving = result.list.find((f) => f.id === op.id);
  if (!moving) return fail(`folder ${op.id} not found`);
  const rest = result.list.filter((f) => f.id !== op.id);
  const at = Math.min(op.order, rest.length);
  return done(lib, {
    folders: renumber([...rest.slice(0, at), moving, ...rest.slice(at)]),
  });
}

function deleteFolder(
  lib: Library,
  op: Extract<LibraryOp, { op: "folder.delete" }>,
): OpResult {
  const result = updateEntity(
    "folder",
    lib.folders,
    op.id,
    op.baseRevision,
    () => null,
  );
  if (!result.ok) return result;
  const folders = renumber(
    result.list.map((f) =>
      f.parentId === op.id ? { ...f, parentId: null } : f,
    ),
  );
  const modules = allModules(lib, (m) =>
    m.folderId === op.id ? { ...m, folderId: null } : m,
  );
  return done(lib, { folders, modules });
}

const nameTaken = (
  tags: readonly Tag[],
  name: string,
  except?: string,
): boolean =>
  tags.some(
    (t) => t.id !== except && t.name.toLowerCase() === name.toLowerCase(),
  );

function tagOp(
  lib: Library,
  op: Extract<LibraryOp, { op: `tag.${string}` }>,
): OpResult {
  if (op.op === "tag.create") {
    if (lib.tags.some((t) => t.id === op.tag.id))
      return fail(`tag ${op.tag.id} exists`);
    if (nameTaken(lib.tags, op.tag.name))
      return fail(`tag ${op.tag.name} exists`);
    return done(lib, { tags: [...lib.tags, { ...op.tag, revision: 1 }] });
  }
  if (op.op === "tag.update") {
    // A stale edit is a conflict first, whatever else is wrong with it (D-2).
    const current = lib.tags.find((t) => t.id === op.id);
    if (current && current.revision !== op.baseRevision)
      return { ok: false, conflict: { entity: "tag", id: op.id, current } };
    if (op.changes.name && nameTaken(lib.tags, op.changes.name, op.id))
      return fail(`tag ${op.changes.name} exists`);
    const changes = definedChanges(op.changes);
    return fromEntity(
      lib,
      "tags",
      updateEntity("tag", lib.tags, op.id, op.baseRevision, (t) => ({
        ...t,
        ...changes,
      })),
    );
  }
  const modules = allModules(lib, (m) => ({
    ...m,
    tags: m.tags.filter((t) => t !== op.id),
  }));
  return fromEntity(
    lib,
    "tags",
    updateEntity("tag", lib.tags, op.id, op.baseRevision, () => null),
    { modules },
  );
}

function moduleOp(
  lib: Library,
  op: Extract<LibraryOp, { op: `module.${string}` }>,
): OpResult {
  if (op.op === "module.setFolder") {
    if (op.folderId !== null && !lib.folders.some((f) => f.id === op.folderId))
      return fail(`folder ${op.folderId} not found`);
    return done(lib, {
      modules: mapModules(lib, op.moduleIds, (m) => ({
        ...m,
        folderId: op.folderId,
      })),
    });
  }
  if (op.op === "module.setTags") {
    const unknown = op.add.filter((t) => !lib.tags.some((tag) => tag.id === t));
    if (unknown.length > 0) return fail(`tag ${unknown.join(", ")} not found`);
    const update = (m: ModuleMeta): ModuleMeta => ({
      ...m,
      tags: [...new Set([...m.tags, ...op.add])].filter(
        (t) => !op.remove.includes(t),
      ),
    });
    return done(lib, { modules: mapModules(lib, op.moduleIds, update) });
  }
  const note = op.note.trim();
  return done(lib, {
    modules: mapModules(lib, [op.moduleId], (m) => ({ ...m, note })),
  });
}

function presetOp(
  lib: Library,
  op: Extract<LibraryOp, { op: `preset.${string}` }>,
): OpResult {
  const unique = (ids: readonly string[]): string[] => [...new Set(ids)];
  if (op.op === "preset.create") {
    if (lib.presets.some((p) => p.id === op.preset.id))
      return fail(`preset ${op.preset.id} exists`);
    const preset: Preset = {
      ...op.preset,
      modules: unique(op.preset.modules),
      revision: 1,
    };
    return done(lib, { presets: [...lib.presets, preset] });
  }
  if (op.op === "preset.update") {
    const { modules, ...rest } = definedChanges(op.changes);
    const changes = modules ? { ...rest, modules: unique(modules) } : rest;
    return fromEntity(
      lib,
      "presets",
      updateEntity("preset", lib.presets, op.id, op.baseRevision, (p) => ({
        ...p,
        ...changes,
      })),
    );
  }
  return fromEntity(
    lib,
    "presets",
    updateEntity("preset", lib.presets, op.id, op.baseRevision, () => null),
  );
}

export function applyOp(lib: Library, op: LibraryOp): OpResult {
  switch (op.op) {
    case "folder.create":
      return createFolder(lib, op);
    case "folder.update": {
      const changes = definedChanges(op.changes);
      return fromEntity(
        lib,
        "folders",
        updateEntity("folder", lib.folders, op.id, op.baseRevision, (f) => ({
          ...f,
          ...changes,
        })),
      );
    }
    case "folder.move":
      return moveFolder(lib, op);
    case "folder.delete":
      return deleteFolder(lib, op);
    case "tag.create":
    case "tag.update":
    case "tag.delete":
      return tagOp(lib, op);
    case "module.setFolder":
    case "module.setTags":
    case "module.setNote":
      return moduleOp(lib, op);
    default:
      return presetOp(lib, op);
  }
}
