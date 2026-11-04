// Library operations: the only way the library changes. Validated with Zod
// where they cross from the Setup page to the background.
import { z } from "zod";
import {
  ColorSchema,
  IdSchema,
  MAX_NOTE,
  NameSchema,
  PresetSchema,
} from "./schema.ts";

const Base = z.number().int().nonnegative();

export const LibraryOpSchema = z.discriminatedUnion("op", [
  z.object({
    op: z.literal("folder.create"),
    folder: z.object({
      id: IdSchema,
      name: NameSchema,
      color: ColorSchema,
      parentId: IdSchema.nullable(),
    }),
  }),
  z.object({
    op: z.literal("folder.update"),
    id: IdSchema,
    baseRevision: Base,
    changes: z.object({
      name: NameSchema.optional(),
      color: ColorSchema.optional(),
      collapsed: z.boolean().optional(),
    }),
  }),
  z.object({
    op: z.literal("folder.move"),
    id: IdSchema,
    baseRevision: Base,
    order: z.number().int().nonnegative(),
  }),
  z.object({
    op: z.literal("folder.delete"),
    id: IdSchema,
    baseRevision: Base,
  }),
  z.object({
    op: z.literal("tag.create"),
    tag: z.object({ id: IdSchema, name: NameSchema, color: ColorSchema }),
  }),
  z.object({
    op: z.literal("tag.update"),
    id: IdSchema,
    baseRevision: Base,
    changes: z.object({
      name: NameSchema.optional(),
      color: ColorSchema.optional(),
    }),
  }),
  z.object({ op: z.literal("tag.delete"), id: IdSchema, baseRevision: Base }),
  z.object({
    op: z.literal("module.setFolder"),
    moduleIds: z.array(IdSchema).min(1),
    folderId: IdSchema.nullable(),
  }),
  z.object({
    op: z.literal("module.setTags"),
    moduleIds: z.array(IdSchema).min(1),
    add: z.array(IdSchema),
    remove: z.array(IdSchema),
  }),
  z.object({
    op: z.literal("module.setNote"),
    moduleId: IdSchema,
    note: z.string().max(MAX_NOTE),
  }),
  z.object({
    op: z.literal("preset.create"),
    preset: PresetSchema.omit({ revision: true }),
  }),
  z.object({
    op: z.literal("preset.update"),
    id: IdSchema,
    baseRevision: Base,
    changes: PresetSchema.pick({
      name: true,
      description: true,
      modules: true,
    }).partial(),
  }),
  z.object({
    op: z.literal("preset.delete"),
    id: IdSchema,
    baseRevision: Base,
  }),
]);

export type LibraryOp = z.infer<typeof LibraryOpSchema>;
