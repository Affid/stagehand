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
    /** Modules picked one by one, besides (or instead of) presets. */
    modules: z.array(z.string()).optional(),
  }),
  createdAt: z.string(),
  baseSnapshotAt: z.string().nullable(),
  status: CommandStatusSchema,
  targetKey: z.string().optional(),
  error: z.string().optional(),
});

export type Command = z.infer<typeof CommandSchema>;

/** At most this many modules picked one by one in a single change. */
export const MAX_PICKED = 500;

/** The modules a change names: its presets' plus any picked one by one. */
export function changeModules(
  presets: readonly {
    readonly id: string;
    readonly modules: readonly string[];
  }[],
  payload: Pick<Command["payload"], "presetIds" | "modules">,
): string[] {
  const fromPresets = presets
    .filter((p) => payload.presetIds.includes(p.id))
    .flatMap((p) => p.modules);
  return [...new Set([...fromPresets, ...(payload.modules ?? [])])];
}
export type CommandStatus = z.infer<typeof CommandStatusSchema>;

/** A command as the module receives it: presets expanded to module ids. */
export const WorldCommandSchema = z.object({
  id: z.string().min(1),
  mode: ApplyModeSchema,
  presets: z.array(z.object({ id: z.string(), name: z.string() })),
  modules: z.array(z.string()),
});

export type WorldCommand = z.infer<typeof WorldCommandSchema>;

/** Longer world descriptions are cut when Setup is read. */
export const MAX_DESCRIPTION = 20000;

export const WorldInfoSchema = z.object({
  id: z.string().min(1),
  title: z.string(),
  system: z.string(),
  systemVersion: z.string(),
  coreVersion: z.string(),
  lastPlayed: z.string().optional(),
  /** Foundry's own favourite star (core.setupPackageFavorites). */
  favorite: z.boolean().optional(),
  /** Locked in Foundry: no launch, edit, update or delete. */
  locked: z.boolean().optional(),
  /** The world's background image path, as Foundry stores it. */
  background: z.string().max(2000).optional(),
  /** Foundry's world description: HTML, shown only after cleaning. */
  description: z.string().max(MAX_DESCRIPTION).optional(),
  /** The next session as Foundry stores it (one UTC time). */
  nextSession: z.string().max(64).optional(),
});

export type WorldInfo = z.infer<typeof WorldInfoSchema>;

/** More packages of one kind than this is not a real server. */
export const MAX_PACKAGES = 5000;

export const SetupDataSchema = z.object({
  core: z.object({
    version: z.string(),
    generation: z.number(),
    build: z.number(),
  }),
  isAdmin: z.boolean(),
  lang: z.string(),
  modules: z.array(PackageInfoSchema).max(MAX_PACKAGES),
  systems: z.array(
    z.object({ id: z.string(), title: z.string(), version: z.string() }),
  ),
  worlds: z.array(WorldInfoSchema),
  /** Foundry's update check: only these three fields, never its download link. */
  coreUpdate: z
    .object({
      hasUpdate: z.boolean(),
      channel: z.string().max(30),
      version: z.string().max(30),
    })
    .optional(),
});

export type SetupData = z.infer<typeof SetupDataSchema>;
