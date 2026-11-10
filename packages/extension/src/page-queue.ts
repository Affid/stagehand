// Writing a world's queue and its launch's intent into the world's own flags
// (docs/COMPANION-WORLD-PROTOCOL.md): the UI asks with SAVE_QUEUE and a
// request id; the page world answers QUEUE_DONE with the server's time of
// the write, or an error. Checked both ways: neither world trusts the other.
import {
  MAX_ACTIVE,
  QueueEntrySchema,
  MAX_QUEUE,
} from "@stagehand/shared/world-flags";
import { z } from "zod";

const Id = z.string().min(1).max(200);
const REQUEST_ID = /^[a-z0-9-]{1,64}$/i;

/** The launch's intent as the UI asks for it; the page stamps its time. */
export const LaunchAskSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("reviewed"),
    id: Id,
    target: z.array(Id).max(MAX_ACTIVE),
  }),
  z.object({ kind: z.literal("hold"), id: Id }),
]);

export type LaunchAsk = z.infer<typeof LaunchAskSchema>;

const SaveQueueSchema = z.object({
  requestId: z.string().regex(REQUEST_ID),
  worldId: Id,
  /** The world's whole queue, replacing what it had. */
  queue: z.array(QueueEntrySchema).max(MAX_QUEUE).optional(),
  /** This launch's intent; null removes any. */
  launch: LaunchAskSchema.nullable().optional(),
});

export type SaveQueue = z.infer<typeof SaveQueueSchema>;

export function parseSaveQueue(p: unknown): SaveQueue | undefined {
  const parsed = SaveQueueSchema.safeParse(p);
  return parsed.success ? parsed.data : undefined;
}

const MAX_ERROR = 2000;

/** What a save came to: the server's time of the write, or an error. */
export interface QueueSaved {
  readonly error?: string;
  readonly written?: string;
}

export const QueueDoneSchema = z.object({
  requestId: z.string().regex(REQUEST_ID),
  error: z.string().max(MAX_ERROR).optional(),
  /** When the queue was written, by the server's clock. */
  written: z.iso.datetime().optional(),
});

export type QueueDone = z.infer<typeof QueueDoneSchema>;

export function parseQueueDone(p: unknown): QueueDone | undefined {
  const parsed = QueueDoneSchema.safeParse(p);
  return parsed.success ? parsed.data : undefined;
}
