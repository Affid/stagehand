// Messages from the extension's pages and content scripts to its background.
// Validated with Zod in the background: content scripts run on web pages.
import { LibraryOpSchema } from "@module-library/shared/library/ops";
import type { Library } from "@module-library/shared/library/schema";
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
  /** "Launch without changes": the world's next pull gets none, once. */
  z.object({ kind: z.literal("launch-hold"), worldId: Id, hold: z.boolean() }),
  z.object({
    kind: z.literal("set-pref"),
    key: z.literal("newSetupPage"),
    value: z.boolean(),
  }),
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
  /** This browser's choices for this server. */
  readonly prefs: Prefs;
}

/** Per-server preferences, stored in this browser. */
export interface Prefs {
  /** Show the new Setup page instead of Foundry's own layout. */
  readonly newSetupPage: boolean;
}

export const DEFAULT_PREFS: Prefs = { newSetupPage: false };
