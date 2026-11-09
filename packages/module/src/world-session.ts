// One Gamemaster's join, through the world's own flags
// (docs/COMPANION-WORLD-PROTOCOL.md): settle what the last launch applied,
// apply the queue Setup left (or hold it, as Setup chose), and leave a
// report of the world's modules and each change's result for Setup.
import {
  activeKey,
  encodeActive,
  FORMAT,
  fitReport,
  type Launch,
  launchIsFresh,
  type Report,
  type Result,
  readStagehand,
  type StagehandFlags,
  byteSize,
  MAX_QUEUE,
} from "@module-library/shared/world-flags";
import { type ApplyDeps, applyCommands, type Outcome } from "./apply.ts";
import type { FoundryGame } from "./foundry.ts";
import type { ServerClock, WorldIo } from "./world-io.ts";
import {
  activeIds,
  activeModules,
  companionVersion,
  coreVersionOf,
} from "./world-state.ts";

export interface SessionDeps extends Omit<ApplyDeps, "record"> {
  readonly io: WorldIo;
}

export type SessionOutcome = Outcome | "idle" | "newer";

const DIFFERS =
  "After the reload, the world's modules differ from what was applied.";
/** Room in a save for everything besides the report. */
const OVERHEAD = 400;

/** Changes the last launch was applying end as applied or failed. */
export function settle(
  results: readonly Result[],
  active: readonly string[],
): Result[] {
  const key = activeKey(active);
  return results.map((r) => {
    if (r.status !== "applying") return r;
    return r.targetKey === key
      ? { id: r.id, status: "applied" }
      : { id: r.id, status: "failed", error: DIFFERS };
  });
}

interface Moment {
  readonly game: FoundryGame;
  readonly clock: ServerClock | undefined;
  readonly read: StagehandFlags;
  /** The launch's intent, if it belongs to this launch. */
  readonly launch: Launch | undefined;
}

function reportOf(
  m: Moment,
  results: readonly Result[],
  launchId: string | null,
): Report {
  return {
    at: new Date(m.clock?.now ?? Date.now()).toISOString(),
    companion: companionVersion(m.game),
    core: coreVersionOf(m.game),
    system: { id: m.game.system.id, version: m.game.system.version },
    active: encodeActive(activeModules(m.game)),
    versions: true,
    partial: false,
    launchId,
    results: [...results],
  };
}

/** The same report apart from its time: no save needed. */
const sameReport = (a: Report | undefined, b: Report): boolean =>
  a !== undefined &&
  JSON.stringify({ ...a, at: "" }) === JSON.stringify({ ...b, at: "" });

/**
 * Our flags' change: the report fitted beside the rest. It always fits:
 * every queued change is recorded at once, so the queue written back is
 * empty, and results are bounded (50, short reasons).
 */
function changeOf(m: Moment, rest: object, report: Report): object {
  const consumed = m.read.launch ? { "-=launch": null } : {};
  const others = { v: FORMAT, ...rest, ...consumed };
  return {
    ...others,
    report: fitReport(report, byteSize(others) + OVERHEAD),
  };
}

/** No queue to apply (or Setup held it): the report, when it changed. */
async function reportOnly(deps: SessionDeps, m: Moment): Promise<void> {
  const settled = settle(m.read.report?.results ?? [], activeIds(m.game));
  const launchId = m.launch?.id ?? m.read.report?.launchId ?? null;
  const change = changeOf(m, {}, reportOf(m, settled, launchId));
  const report = (change as { report: Report }).report;
  // Compared as it would be saved: a trimmed report too (review).
  if (!m.read.launch && sameReport(m.read.report, report)) return;
  await deps.io.save(change);
}

/** New results first; earlier ones settled and kept, within the limit. */
function withEarlier(m: Moment, results: readonly Result[]): Result[] {
  const ids = new Set(results.map((r) => r.id));
  const earlier = settle(m.read.report?.results ?? [], activeIds(m.game));
  return [...results, ...earlier.filter((r) => !ids.has(r.id))].slice(
    0,
    MAX_QUEUE,
  );
}

async function applyQueue(deps: SessionDeps, m: Moment): Promise<Outcome> {
  const launchId = m.launch?.id ?? null;
  const record = (results: readonly Result[]): Promise<boolean> => {
    const done = new Set(results.map((r) => r.id));
    const queue = m.read.queue.filter((e) => !done.has(e.id));
    const report = reportOf(m, withEarlier(m, results), launchId);
    return deps.io.save(changeOf(m, { queue }, report));
  };
  const reviewed = m.launch?.kind === "reviewed" ? m.launch.target : undefined;
  const outcome = await applyCommands(
    { ...deps, record },
    m.read.queue,
    reviewed,
  );
  // Not now, or blocked: the queue waits; the launch's intent is used up.
  if (outcome === "later" || outcome === "blocked") await reportOnly(deps, m);
  return outcome;
}

export async function runWorldSession(
  deps: SessionDeps,
): Promise<SessionOutcome> {
  const read = readStagehand(deps.io.flags());
  if (read.newer) {
    deps.warn(deps.game.i18n.localize("STAGEHAND.Outdated"));
    return "newer";
  }
  if (read.unreadable) deps.warn(deps.game.i18n.localize("STAGEHAND.BadQueue"));
  const clock = await deps.io.clock();
  // An intent counts once: a quick restart must not use it again (review).
  const fresh =
    read.launch !== undefined &&
    clock !== undefined &&
    read.launch.id !== read.report?.launchId &&
    launchIsFresh(read.launch.at, clock.worldStart);
  const m: Moment = {
    game: deps.game,
    clock,
    read,
    launch: fresh ? read.launch : undefined,
  };
  if (m.launch?.kind === "hold" || read.queue.length === 0) {
    await reportOnly(deps, m);
    return "idle";
  }
  return applyQueue(deps, m);
}
