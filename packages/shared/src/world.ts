// World snapshots, commands and the Setup data they're built from (PRD 9).
import { z } from "zod";
import { PackageInfoSchema } from "./package.ts";

/** Page scripts can post snapshots: every field is bounded (security review). */
export const MAX_ACTIVE = 2000;
const Short = z.string().max(100);

export const SnapshotSchema = z.object({
  worldId: z.string().min(1).max(200),
  title: z.string().max(300),
  system: z.object({ id: Short, version: Short }),
  coreVersion: Short,
  active: z
    .array(z.object({ id: z.string().min(1).max(200), version: Short }))
    .max(MAX_ACTIVE),
  companionVersion: Short,
  takenAt: z.iso.datetime(),
});

export type Snapshot = z.infer<typeof SnapshotSchema>;

export const ApplyModeSchema = z.enum(["replace", "add", "remove"]);

export const CommandStatusSchema = z.enum([
  "pending",
  "applying",
  "applied",
  "failed",
  "declined",
  "cancelled",
]);

export const CommandSchema = z.object({
  id: z.string().min(1),
  scope: z.literal("world"),
  worldId: z.string().min(1),
  type: z.literal("preset.apply"),
  payload: z.object({
    mode: ApplyModeSchema,
    presetIds: z.array(z.string()),
  }),
  createdAt: z.string(),
  baseSnapshotAt: z.string().nullable(),
  status: CommandStatusSchema,
  targetKey: z.string().optional(),
  error: z.string().optional(),
});

export type Command = z.infer<typeof CommandSchema>;
export type CommandStatus = z.infer<typeof CommandStatusSchema>;

/** A command as the module receives it: presets expanded to module ids. */
export const WorldCommandSchema = z.object({
  id: z.string().min(1),
  mode: ApplyModeSchema,
  presets: z.array(z.object({ id: z.string(), name: z.string() })),
  modules: z.array(z.string()),
});

export type WorldCommand = z.infer<typeof WorldCommandSchema>;

export const WorldInfoSchema = z.object({
  id: z.string().min(1),
  title: z.string(),
  system: z.string(),
  systemVersion: z.string(),
  coreVersion: z.string(),
  lastPlayed: z.string().optional(),
});

export type WorldInfo = z.infer<typeof WorldInfoSchema>;

export const SetupDataSchema = z.object({
  core: z.object({
    version: z.string(),
    generation: z.number(),
    build: z.number(),
  }),
  isAdmin: z.boolean(),
  lang: z.string(),
  modules: z.array(PackageInfoSchema),
  systems: z.array(
    z.object({ id: z.string(), title: z.string(), version: z.string() }),
  ),
  worlds: z.array(WorldInfoSchema),
});

export type SetupData = z.infer<typeof SetupDataSchema>;
