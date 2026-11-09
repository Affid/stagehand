// What Setup and the companion leave each other in the world's own flags
// (docs/COMPANION-WORLD-PROTOCOL.md): Setup writes the queue and the launch's
// intent while the world is stopped; the companion writes its report while
// it runs. Anyone with a Gamemaster's rights can write these flags, so both
// sides read them as untrusted: every field is checked and bounded. Foundry
// merges a save into the stored object, so the report's fields are always
// all present: a field left out would keep its old value.
import { z } from "zod";

export const ApplyModeSchema = z.enum(["replace", "add", "remove"]);
/** Page scripts can post these lists: every one is bounded (security review). */
export const MAX_ACTIVE = 2000;

/** The format's version: a side that sees a newer one leaves it alone. */
export const FORMAT = 1;
/** Changes waiting for one world; more is a bug, not a use. */
export const MAX_QUEUE = 50;
/**
 * Foundry refuses a request body over 100 KB (HTTP 413, measured on 13.351
 * and 14.370): every save stays under this, with room for the request.
 */
export const MAX_SAVE_BYTES = 90_000;
/** The queue's share of a save: a bigger one is left unread (security review). */
export const MAX_QUEUE_BYTES = 60_000;
/** A launch's intent counts when written this long before the world started... */
export const LAUNCH_BEFORE_MS = 10 * 60 * 1000;
/** ...or this little after it (both times are the server's, in whole seconds). */
export const LAUNCH_AFTER_MS = 5 * 1000;

const Id = z.string().min(1).max(200);
const Short = z.string().max(100);
const Time = z.iso.datetime();

export const QueueEntrySchema = z.object({
  id: Id,
  mode: ApplyModeSchema,
  /** The presets it came from, by name, for the companion's dialog. */
  presets: z.array(z.object({ id: Id, name: z.string().max(100) })).max(20),
  modules: z.array(Id).max(MAX_ACTIVE),
  queuedAt: Time,
});

export type QueueEntry = z.infer<typeof QueueEntrySchema>;

export const LaunchSchema = z.discriminatedUnion("kind", [
  /** Apply and launch: the modules on after it, as reviewed on Setup. */
  z.object({
    kind: z.literal("reviewed"),
    id: Id,
    at: Time,
    target: z.array(Id).max(MAX_ACTIVE),
  }),
  /** Launch without changes: this launch leaves the queue alone. */
  z.object({ kind: z.literal("hold"), id: Id, at: Time }),
]);

export type Launch = z.infer<typeof LaunchSchema>;

export const ResultSchema = z.object({
  id: Id,
  status: z.enum(["applying", "applied", "failed", "declined"]),
  /** While applying: the key (activeKey) of the modules it should leave on. */
  targetKey: z.string().max(32).optional(),
  error: z.string().max(500).optional(),
});

export type Result = z.infer<typeof ResultSchema>;

export const ReportSchema = z.object({
  at: Time,
  companion: Short,
  core: Short,
  system: z.object({ id: Short, version: Short }),
  /** The active modules as "id@version" (versions false: ids alone). */
  active: z.array(z.string().min(1).max(320)).max(MAX_ACTIVE),
  versions: z.boolean(),
  /** More were active than one save holds. */
  partial: z.boolean(),
  /** The launch intent this report answered, by its id. */
  launchId: Id.nullable(),
  results: z.array(ResultSchema).max(MAX_QUEUE),
});

export type Report = z.infer<typeof ReportSchema>;

export interface StagehandFlags {
  /** Written by a newer Stagehand: nothing else was read. */
  readonly newer: boolean;
  readonly queue: readonly QueueEntry[];
  /** When Setup last wrote the queue (the server's clock). */
  readonly written?: string | undefined;
  /** A queue was there but didn't pass: it is never applied (said). */
  readonly unreadable?: true | undefined;
  readonly launch?: Launch | undefined;
  readonly report?: Report | undefined;
}

/** Our flags as Setup passes them on, already read (readStagehand). */
export const StagehandFlagsSchema = z.object({
  newer: z.boolean(),
  queue: z
    .array(QueueEntrySchema)
    .max(MAX_QUEUE)
    .refine((q) => byteSize(q) <= MAX_QUEUE_BYTES),
  written: Time.optional(),
  unreadable: z.literal(true).optional(),
  launch: LaunchSchema.optional(),
  report: ReportSchema.optional(),
});

type Loose = Readonly<Record<string, unknown>>;

const isObject = (v: unknown): v is Loose =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/** Our flags, field by field: a bad field is left out, never the rest. */
export function readStagehand(raw: unknown): StagehandFlags {
  if (!isObject(raw)) return { newer: false, queue: [] };
  if (typeof raw.v === "number" && raw.v > FORMAT)
    return { newer: true, queue: [] };
  const queue = z
    .array(QueueEntrySchema)
    .max(MAX_QUEUE)
    .refine((q) => byteSize(q) <= MAX_QUEUE_BYTES)
    .safeParse(raw.queue);
  const launch = LaunchSchema.safeParse(raw.launch);
  const report = ReportSchema.safeParse(raw.report);
  const written = Time.safeParse(raw.written);
  return {
    newer: false,
    queue: queue.success ? queue.data : [],
    ...(raw.queue !== undefined && !queue.success
      ? { unreadable: true as const }
      : {}),
    ...(written.success ? { written: written.data } : {}),
    ...(launch.success ? { launch: launch.data } : {}),
    ...(report.success ? { report: report.data } : {}),
  };
}

/**
 * A short key for a set of module ids, to tell after a reload whether the
 * world got what was applied (cyrb53: no crypto, the same in every browser).
 */
export function activeKey(ids: readonly string[]): string {
  const text = [...ids].sort().join("\n");
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 2654435761);
    h2 = Math.imul(h2 ^ c, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

export interface ActiveModule {
  readonly id: string;
  readonly version: string;
}

/** Package ids never hold an "@"; a version may. */
export const encodeActive = (active: readonly ActiveModule[]): string[] =>
  active.map((m) => (m.version ? `${m.id}@${m.version}` : m.id));

export const decodeActive = (active: readonly string[]): ActiveModule[] =>
  active.map((s) => {
    const at = s.indexOf("@");
    return at < 0
      ? { id: s, version: "" }
      : { id: s.slice(0, at), version: s.slice(at + 1) };
  });

/** A value's size as JSON, in bytes. */
export const byteSize = (value: unknown): number =>
  new TextEncoder().encode(JSON.stringify(value)).length;

/**
 * The report made to fit one save beside `others` bytes of the same save:
 * versions go first, then modules from the end (said in `partial`).
 */
export function fitReport(report: Report, others: number): Report {
  const budget = MAX_SAVE_BYTES - others;
  if (byteSize(report) <= budget) return report;
  const ids = decodeActive(report.active).map((m) => m.id);
  const bare: Report = { ...report, active: ids, versions: false };
  if (byteSize(bare) <= budget) return bare;
  const room = budget - byteSize({ ...bare, active: [], partial: true });
  const kept: string[] = [];
  let used = 0;
  for (const id of ids) {
    used += byteSize(id) + 1;
    if (used > room) break;
    kept.push(id);
  }
  return { ...bare, active: kept, partial: true };
}

/** The launch's intent belongs to the launch that just started the world. */
export function launchIsFresh(at: string, worldStartMs: number): boolean {
  const written = Date.parse(at);
  if (!Number.isFinite(written)) return false;
  return (
    written >= worldStartMs - LAUNCH_BEFORE_MS &&
    written <= worldStartMs + LAUNCH_AFTER_MS
  );
}
