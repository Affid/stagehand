// Your packages on a release, as the prototype (_update.js compatData):
// Foundry's preview rates the newest version of each installed system and
// module, and each world by its system; we add where each one is used and,
// for a world, which of its modules need a look.
import { isNewerVersion } from "@module-library/shared/version";
import type { WorldInfo } from "@module-library/shared/world";
import type { SetupState } from "../../../../messages.ts";
import type { CompatEntry, Preview } from "../../../../page-compat.ts";
import { worldsUsing } from "../../../model/systems.ts";
import { nextSet, worldModules } from "../../../model/world-modules.ts";

/** Compatible, unverified, risk, incompatible, missing dependency. */
export type Status = "ok" | "unv" | "risk" | "bad" | "dep";
export type Kind = "system" | "module" | "world";

/** Foundry's PACKAGE_AVAILABILITY_CODES, as its checker groups them. */
const BY_CODE: ReadonlyMap<number, Status> = new Map([
  [1, "ok"],
  [2, "unv"],
  [3, "unv"],
  [4, "risk"],
  [5, "dep"],
  [6, "dep"],
  [7, "bad"],
  [8, "bad"],
  [9, "bad"],
  [10, "bad"],
  [11, "dep"],
]);

/** Unknown (0) and any code Foundry adds later: worth a look. */
export const statusOf = (code: number): Status => BY_CODE.get(code) ?? "risk";

export interface CompatRow {
  readonly kind: Kind;
  readonly id: string;
  readonly title: string;
  readonly status: Status;
  readonly installed: string | null;
  readonly latest: string | null;
  readonly verified: string | null;
  readonly maximum: string | null;
  /** The newest version is newer than the one installed. */
  readonly needsUpdate: boolean;
  /** Where it is used: worlds with it on at their next launch, or on its system. */
  readonly worlds: readonly WorldInfo[];
  /** The required package that isn't compatible. */
  readonly dep?: string;
  readonly url?: string;
  readonly changelog?: string;
  /** A world: its system's row, its modules, and those to check. */
  readonly sys?: CompatRow;
  readonly mine?: readonly CompatRow[];
  readonly off?: readonly CompatRow[];
  /** A world without the companion: its modules are unknown. */
  readonly unknown?: boolean;
}

export interface CompatData {
  readonly system: readonly CompatRow[];
  readonly module: readonly CompatRow[];
  readonly world: readonly CompatRow[];
}

const newer = (latest: string | null, installed: string | null): boolean =>
  latest !== null && installed !== null && isNewerVersion(latest, installed);

function packageRow(
  kind: Kind,
  e: CompatEntry,
  installed: string | null,
  worlds: readonly WorldInfo[],
): CompatRow {
  return {
    kind,
    id: e.id,
    title: e.title,
    status: statusOf(e.availability),
    installed,
    latest: e.version,
    verified: e.verified,
    maximum: e.maximum,
    needsUpdate: newer(e.version, installed),
    worlds,
    ...(e.url ? { url: e.url } : {}),
    ...(e.changelog ? { changelog: e.changelog } : {}),
  };
}

/** A missing dependency names the required package that isn't compatible. */
function withDep(
  row: CompatRow,
  e: CompatEntry,
  all: readonly CompatRow[],
): CompatRow {
  if (row.status !== "dep") return row;
  const bad = e.requires.find((id) => {
    const r = all.find((x) => x.id === id);
    return r?.status !== "ok";
  });
  if (!bad) return row;
  return { ...row, dep: all.find((x) => x.id === bad)?.title ?? bad };
}

function moduleRows(state: SetupState, p: Preview): CompatRow[] {
  const worlds = state.setup?.worlds ?? [];
  const sets = new Map(
    worlds.map((w) => [w.id, new Set(nextSet(state, w.id))]),
  );
  const version = (id: string): string | null =>
    state.setup?.modules.find((m) => m.id === id)?.version ?? null;
  const pairs = p.module.map((e) => ({
    e,
    row: packageRow(
      "module",
      e,
      version(e.id),
      worlds.filter((w) => sets.get(w.id)?.has(e.id)),
    ),
  }));
  const rows = pairs.map((x) => x.row);
  return pairs.map(({ e, row }) => withDep(row, e, rows));
}

function systemRows(state: SetupState, p: Preview): CompatRow[] {
  const worlds = state.setup?.worlds ?? [];
  const version = (id: string): string | null =>
    state.setup?.systems.find((s) => s.id === id)?.version ?? null;
  return p.system.map((e) =>
    packageRow("system", e, version(e.id), worldsUsing(worlds, e.id)),
  );
}

function worldRows(
  state: SetupState,
  p: Preview,
  systems: readonly CompatRow[],
  modules: readonly CompatRow[],
): CompatRow[] {
  return p.world.map((e) => {
    const sys = systems.find((s) => s.id === e.system);
    const tracked = worldModules(state, e.id).tracked;
    const on = new Set(tracked ? nextSet(state, e.id) : []);
    const mine = modules.filter((m) => on.has(m.id));
    const base = packageRow("world", e, null, []);
    return {
      ...base,
      // As Foundry's checker: a world is as compatible as its system.
      status: sys?.status ?? base.status,
      ...(sys ? { sys } : {}),
      mine,
      off: mine.filter((m) => m.status !== "ok"),
      unknown: !tracked,
    };
  });
}

export function compatData(state: SetupState, p: Preview): CompatData {
  const system = systemRows(state, p);
  const module = moduleRows(state, p);
  return { system, module, world: worldRows(state, p, system, module) };
}

/** A row that needs a look: not compatible, or a world with modules to check. */
export const toCheck = (x: CompatRow): boolean =>
  x.status !== "ok" ||
  (x.kind === "world" && (x.unknown === true || (x.off?.length ?? 0) > 0));

const ORDER: Readonly<Record<Status, number>> = {
  bad: 0,
  dep: 1,
  risk: 2,
  unv: 3,
  ok: 4,
};

/** Worst first; then the most used; then by name. */
export const byConcern = (a: CompatRow, b: CompatRow): number =>
  ORDER[a.status] - ORDER[b.status] ||
  b.worlds.length - a.worlds.length ||
  a.title.localeCompare(b.title);

/** Systems and modules that only work on the release once updated too. */
export const updatesNeeded = (d: CompatData): number =>
  [...d.system, ...d.module].filter((x) => x.needsUpdate && x.status !== "bad")
    .length;
