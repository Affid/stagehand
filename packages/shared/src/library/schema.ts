// The library document (PRD section 9), one per server. Version-independent:
// no core or module versions here (V-7).
import { z } from "zod";

export const SCHEMA_VERSION = 1;
export const MAX_NAME = 80;
export const MAX_NOTE = 4000;

export const IdSchema = z.string().min(1).max(200);
export const ColorSchema = z.string().regex(/^#[0-9a-f]{6}$/i);
export const NameSchema = z.string().trim().min(1).max(MAX_NAME);
const Revision = z.number().int().nonnegative();

export const FolderSchema = z.object({
  id: IdSchema,
  name: NameSchema,
  color: ColorSchema,
  parentId: IdSchema.nullable(),
  order: z.number().int().nonnegative(),
  collapsed: z.boolean(),
  revision: Revision,
});

export const TagSchema = z.object({
  id: IdSchema,
  name: NameSchema,
  color: ColorSchema,
  revision: Revision,
});

export const ModuleMetaSchema = z.object({
  folderId: IdSchema.nullable(),
  tags: z.array(IdSchema),
  note: z.string().max(MAX_NOTE),
});

export const FilterSchema = z.object({
  text: z.string().max(200),
  tags: z.array(IdSchema),
  tagOp: z.enum(["and", "or"]),
  authors: z.array(z.string()),
});

export const ViewSchema = z.object({
  id: IdSchema,
  name: NameSchema,
  filter: FilterSchema,
});

export const PresetSchema = z.object({
  id: IdSchema,
  name: NameSchema,
  description: z.string().max(MAX_NOTE),
  modules: z.array(IdSchema),
  source: z.enum(["user", "import", "snapshot"]),
  revision: Revision,
});

export const LibrarySchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  serverId: z.string(),
  revision: Revision,
  folders: z.array(FolderSchema),
  tags: z.array(TagSchema),
  modules: z.record(IdSchema, ModuleMetaSchema),
  views: z.array(ViewSchema),
  presets: z.array(PresetSchema),
});

export type Folder = z.infer<typeof FolderSchema>;
export type Tag = z.infer<typeof TagSchema>;
export type ModuleMeta = z.infer<typeof ModuleMetaSchema>;
export type ModuleFilterSpec = z.infer<typeof FilterSchema>;
export type SavedView = z.infer<typeof ViewSchema>;
export type Preset = z.infer<typeof PresetSchema>;
export type Library = z.infer<typeof LibrarySchema>;

export const emptyLibrary = (serverId: string): Library => ({
  schemaVersion: SCHEMA_VERSION,
  serverId,
  revision: 0,
  folders: [],
  tags: [],
  modules: {},
  views: [],
  presets: [],
});

export const EMPTY_META: ModuleMeta = { folderId: null, tags: [], note: "" };
