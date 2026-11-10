// What Setup learns from each world's own flags when it opens
// (docs/COMPANION-WORLD-PROTOCOL.md): the companion's report becomes the
// world's snapshot (its modules, as the world page shows them), and the
// queue and results bring this browser's view of the changes up to date.
import {
  type SetupData,
  type Snapshot,
  type WorldInfo,
} from "@stagehand/shared/world";
import { decodeActive, type Report } from "@stagehand/shared/world-flags";
import { syncFromWorld } from "./commands.ts";
import type { ServerId } from "./servers.ts";
import type { ServerState } from "./state.ts";

/** The report as the snapshot the UI already knows (C-2). */
export function snapshotOf(world: WorldInfo, report: Report): Snapshot {
  return {
    worldId: world.id,
    title: world.title,
    system: report.system,
    coreVersion: report.core,
    active: decodeActive(report.active).map((m) => ({
      id: m.id,
      version: m.version.slice(0, 100),
    })),
    companionVersion: report.companion,
    takenAt: report.at,
  };
}

const withFlags = (data: SetupData) =>
  data.worlds.flatMap((w) => (w.stagehand ? [{ w, flags: w.stagehand }] : []));

export async function syncWorlds(
  state: ServerState,
  server: ServerId,
  data: SetupData,
  now: string,
): Promise<void> {
  const worlds = withFlags(data);
  if (worlds.length === 0) return;
  const stored = await state.snapshots(server);
  for (const { w, flags } of worlds) {
    const report = flags.report;
    if (!report || stored[w.id]?.takenAt === report.at) continue;
    await state.putSnapshot(server, snapshotOf(w, report));
  }
  await state.updateCommands(server, (list) =>
    worlds.reduce(
      (acc, { w, flags }) => syncFromWorld(acc, w.id, flags, now),
      list,
    ),
  );
}
