// Messages from the extension's pages and content scripts to its background.
// Validated with Zod in the background: content scripts run on web pages.
import { LibraryOpSchema } from "@module-library/shared/library/ops";
import type { Library } from "@module-library/shared/library/schema";
import { MAX_NEWS, MAX_NEWS_URL } from "@module-library/shared/news";
import { NS } from "@module-library/shared/protocol";
import {
  ApplyModeSchema,
  type Command,
  MAX_PICKED,
  SetupDataSchema,
  type Snapshot,
} from "@module-library/shared/world";
import { z } from "zod";
import type { SetupConfig } from "./adapters/config.ts";
import type { HelloRecord, StoredSetup } from "./background/state.ts";

export const MAX_IMPORT_BYTES = 5_000_000;

export const EnvelopeSchema = z.object({
  ns: z.literal(NS),
  v: z.number(),
  from: z.enum(["module", "bridge", "setup-main"]),
  type: z.string().min(1).max(64),
  requestId: z.string().max(100).optional(),
  payload: z.unknown(),
});

const Id = z.string().min(1).max(200);
/** More installed modules than this is not a real server. */
const MAX_SORTED = 5000;
/** More presets than anyone combines in one change. */
const MAX_PRESETS = 100;

export const ExtensionMessageSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("register-server"), server: z.string().max(500) }),
  z.object({ kind: z.literal("setup-seen"), data: SetupDataSchema }),
  z.object({ kind: z.literal("get-state") }),
  z.object({ kind: z.literal("library-op"), op: LibraryOpSchema }),
  z.object({
    kind: z.literal("library-import"),
    text: z.string().max(MAX_IMPORT_BYTES),
  }),
  z.object({ kind: z.literal("library-export") }),
  z
    .object({
      kind: z.literal("queue-apply"),
      worldId: Id,
      mode: ApplyModeSchema,
      presetIds: z.array(Id).max(MAX_PRESETS),
      modules: z.array(Id).max(MAX_PICKED).optional(),
    })
    .refine((m) => m.presetIds.length + (m.modules?.length ?? 0) > 0, {
      message: "Choose presets or modules to apply",
    }),
  z.object({ kind: z.literal("cancel-command"), id: Id }),
  /** Intake: these modules have been sorted (no longer "new"). */
  z.object({
    kind: z.literal("modules-sorted"),
    ids: z.array(Id).max(MAX_SORTED),
  }),
  /** News: these articles have been opened (no longer "New"). */
  z.object({
    kind: z.literal("news-seen"),
    urls: z.array(z.string().max(MAX_NEWS_URL)).max(MAX_NEWS + 5),
  }),
  /** "Launch without changes": the world's next pull gets none, once. */
  z.object({
    kind: z.literal("launch-hold"),
    worldId: Id,
    hold: z.boolean(),
    /** Apply and launch: the modules on after it, as reviewed (one confirmation). */
    reviewed: z.array(Id).max(5000).optional(),
  }),
  /** Foundry's public release list, or one release's page (Release history). */
  z.object({
    kind: z.literal("foundry-releases"),
    version: z
      .string()
      .regex(/^\d{1,4}\.\d{1,6}$/)
      .optional(),
  }),
  /** Opens the options page to allow reading foundryvtt.com. */
  z.object({ kind: z.literal("ask-foundryvtt") }),
  z.object({ kind: z.literal("bridge-init") }),
  z.object({ kind: z.literal("relay"), msg: EnvelopeSchema }),
]);

export type ExtensionMessage = z.infer<typeof ExtensionMessageSchema>;

/** Everything the Setup UI renders from. */
export interface SetupState {
  readonly server: string;
  readonly adminVerified: boolean;
  readonly library: Library;
  readonly setup: StoredSetup | undefined;
  readonly snapshots: Readonly<Record<string, Snapshot>>;
  readonly commands: readonly Command[];
  readonly hellos: Readonly<Record<string, HelloRecord>>;
  readonly config: SetupConfig;
  /** Installed modules not sorted yet (installed since the first visit). */
  readonly fresh: readonly string[];
  /** Links of Foundry's news articles not opened yet (none on a first visit). */
  readonly newsUnread: readonly string[];
}
