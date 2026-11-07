// World snapshots, commands and the Setup data they're built from (PRD 9).
import { z } from "zod";
import { MAX_NEWS, NewsItemSchema } from "./news.ts";
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

/** Bounds for names read from manifests (security review, package 2). */
export const MAX_ID = 200;
export const MAX_TITLE = 300;
export const MAX_VERSION = 50;

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
/** Chosen dates or skips past this are not a real schedule. */
const MAX_DATES = 400;

function isTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** The next-session schedule, ours, in the world's flags["module-library"]. */
export const ScheduleSchema = z.object({
  start: z.string().regex(DATE),
  time: z.string().regex(TIME),
  /** A zone the browser knows: a bad one would throw in every date (review). */
  tz: z.string().min(1).max(64).refine(isTimeZone),
  freq: z.enum(["none", "w1", "w2", "m1", "dates"]),
  skips: z.array(z.string().regex(DATE)).max(MAX_DATES).readonly(),
  dates: z
    .record(z.string().regex(DATE), z.string().regex(TIME))
    .refine((d) => Object.keys(d).length <= MAX_DATES)
    .optional(),
});

export type ScheduleData = z.infer<typeof ScheduleSchema>;

export const WorldInfoSchema = z.object({
  id: z.string().min(1).max(MAX_ID),
  title: z.string().max(MAX_TITLE),
  system: z.string().max(MAX_ID),
  systemVersion: z.string().max(MAX_VERSION),
  coreVersion: z.string().max(MAX_VERSION),
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
  /** Foundry's join screen: "default" or "minimal". */
  joinTheme: z.enum(["default", "minimal"]).optional(),
  /** The next launch runs with every module off (one-shot). */
  safeMode: z.boolean().optional(),
  /** Seconds played, as Foundry counts them. */
  playtime: z.number().int().nonnegative().optional(),
  /** The Foundry version the world was checked with (compatibility). */
  verified: z.string().max(MAX_VERSION).optional(),
  /** Our next-session schedule, from the world's flags. */
  schedule: ScheduleSchema.optional(),
});

export type WorldInfo = z.infer<typeof WorldInfoSchema>;

/** A system as Setup reads it: always id, title, version; the rest as a module's. */
export const SystemInfoSchema = PackageInfoSchema.partial().extend({
  id: z.string().max(MAX_ID),
  title: z.string().max(MAX_TITLE),
  version: z.string().max(MAX_VERSION),
});

export type SystemInfo = z.infer<typeof SystemInfoSchema>;

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
  systems: z.array(SystemInfoSchema).max(MAX_PACKAGES),
  worlds: z.array(WorldInfoSchema).max(MAX_PACKAGES),
  /** Whether Foundry has an admin password (never the password itself). */
  passwordSet: z.boolean().optional(),
  /** Foundry's News and Featured Content (news.ts). */
  news: z.array(NewsItemSchema).max(MAX_NEWS).optional(),
  featured: NewsItemSchema.optional(),
  /** Foundry's count of setup warnings (Support and issues). */
  issues: z.number().int().nonnegative().max(1_000_000).optional(),
  /** Foundry's update check: only these three fields, never its download link. */
  coreUpdate: z
    .object({
      hasUpdate: z.boolean(),
      channel: z.string().max(30),
      version: z.string().max(30),
      /** False when Foundry was started with --noupdate. */
      canUpdate: z.boolean().optional(),
      /** False when foundryvtt.com didn't answer the last check. */
      reachable: z.boolean().optional(),
    })
    .optional(),
});

export type SetupData = z.infer<typeof SetupDataSchema>;
