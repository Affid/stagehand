// Writes a world's queue and its launch's intent into the world's flags, the
// way save-world.ts saves its details: Foundry's world edit ("editWorld",
// behind the same remote flag), then the answer applied to Setup's copy and
// Setup re-rendered. The intent is stamped with the server's clock (the
// Date of Foundry's /api/status answer): the companion judges it by the
// same clock, so device clocks never matter.
import {
  byteSize,
  FORMAT,
  MAX_QUEUE_BYTES,
  MAX_SAVE_BYTES,
} from "@stagehand/shared/world-flags";
import { logError } from "@stagehand/shared/log";
import { FLAGS_KEY } from "@stagehand/shared/world";
import type { QueueSaved, SaveQueue } from "../page-queue.ts";
import type { PageGlobals } from "./globals.ts";
import { redrawSetup } from "./redraw.ts";

export type QueueGlobals = Pick<PageGlobals, "game" | "ui" | "foundry">;

export interface QueueDeps {
  readonly page: QueueGlobals;
  readonly fetch: typeof fetch;
}

interface Editable {
  updateSource(data: object): void;
}

const message = (e: unknown): string =>
  e instanceof Error ? e.message : String(e);

/** The server's time, or undefined when Foundry didn't say. */
async function serverNow(deps: QueueDeps): Promise<number | undefined> {
  const route = deps.page.foundry?.utils?.getRoute?.("api/status");
  try {
    const res = await deps.fetch(route ?? "/api/status", { cache: "no-store" });
    const now = Date.parse(res.headers.get("Date") ?? "");
    return Number.isFinite(now) ? now : undefined;
  } catch {
    return undefined;
  }
}

const NO_CLOCK =
  "Foundry didn't say its time, so this launch's choice couldn't be saved. Try again.";

/**
 * Our flags' change: the queue stamped with the server's time of the write
 * (it tells a later write by someone else from an older read), and the
 * intent with the same time. An intent needs the server's clock.
 */
function changeOf(
  req: SaveQueue,
  now: number | undefined,
): { change: object; written?: string } | { error: string } {
  const at = now === undefined ? undefined : new Date(now).toISOString();
  if (req.launch && at === undefined) return { error: NO_CLOCK };
  const queue = req.queue
    ? { queue: req.queue, ...(at === undefined ? {} : { written: at }) }
    : {};
  const launch =
    req.launch === undefined
      ? {}
      : req.launch === null
        ? { "-=launch": null }
        : { launch: { ...req.launch, at } };
  return {
    change: { v: FORMAT, ...queue, ...launch },
    ...(req.queue && at !== undefined ? { written: at } : {}),
  };
}

function tooBig(req: SaveQueue, change: object): string | undefined {
  if (req.queue && byteSize(req.queue) > MAX_QUEUE_BYTES)
    return "Too many changes are queued for this world. Cancel some first.";
  if (byteSize(change) > MAX_SAVE_BYTES)
    return "These changes are too large to save in the world.";
  return undefined;
}

async function post(
  page: QueueGlobals,
  world: Editable,
  worldId: string,
  change: object,
): Promise<void> {
  const flags = { [FLAGS_KEY]: change };
  const game = page.game;
  if (!game?.post) throw new Error("Foundry's Setup can't save worlds here.");
  await game.post({ action: "editWorld", id: worldId, flags });
  await refreshSetup(page, world, flags);
}

/**
 * Saved on the server: Setup's copy and its redraw are a courtesy. Foundry's
 * own Setup can fail to redraw (on WebViews older than it supports it throws
 * on `RegExp.escape`), and that must not read as an unsaved queue.
 */
async function refreshSetup(
  page: QueueGlobals,
  world: Editable,
  flags: object,
): Promise<void> {
  try {
    world.updateSource({ flags });
  } catch (error: unknown) {
    logError("queue copy", error);
  }
  await redrawSetup(page, "queue");
}

/** Saves the queue (and intent); the time of the write, or an error. */
export async function saveQueue(
  deps: QueueDeps,
  req: SaveQueue,
): Promise<QueueSaved> {
  const world = deps.page.game?.worlds?.get?.(req.worldId) as
    Editable | undefined;
  if (!world) return { error: `No world ${req.worldId}` };
  const now = req.queue || req.launch ? await serverNow(deps) : undefined;
  const built = changeOf(req, now);
  if ("error" in built) return { error: built.error };
  const big = tooBig(req, built.change);
  if (big) return { error: big };
  try {
    await post(deps.page, world, req.worldId, built.change);
    return built.written === undefined ? {} : { written: built.written };
  } catch (e: unknown) {
    return { error: message(e) };
  }
}
