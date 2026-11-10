// One world's modules on the new world page: on now (the companion's
// snapshot), on after the next launch (every queued change resolved, as the
// companion will), and the one line that says why (SETUP-REDESIGN.md, world
// page cards). Also what flipping one switch queues or undoes.
import type { Plan } from "@stagehand/shared/resolver";
import type { PackageInfo } from "@stagehand/shared/package";
import {
  isCompatibilityRisk,
  parseCoreVersion,
  testAvailability,
} from "@stagehand/shared/version";
import type { Command } from "@stagehand/shared/world";
import type { SetupState } from "../../messages.ts";
import {
  COMPANION_ID,
  type NewChange,
  pendingFor,
  previewApply,
} from "./preview.ts";

export type Why =
  | { readonly kind: "companion" }
  | { readonly kind: "blocked"; readonly ids: readonly string[] }
  | { readonly kind: "needs"; readonly id: string }
  | { readonly kind: "conflict"; readonly id: string }
  | { readonly kind: "neededBy"; readonly ids: readonly string[] }
  | { readonly kind: "preset"; readonly name: string }
  | { readonly kind: "unverified" }
  | { readonly kind: "note"; readonly text: string }
  /** The manifest's description, as the prototype's cards show it. */
  | { readonly kind: "description"; readonly text: string }
  | { readonly kind: "authors"; readonly text: string };

export interface WorldModuleRow {
  readonly pkg: PackageInfo;
  readonly now: boolean;
  readonly next: boolean;
  /** Set when the next launch changes it. */
  readonly delta: "on" | "off" | undefined;
  readonly why: Why;
  /** Worth the GM's attention before launching. */
  readonly problem: boolean;
  /** Foundry would badge it as a compatibility risk (yellow edge). */
  readonly risk: boolean;
}

export interface WorldModules {
  /** False until the companion has reported this world once. */
  readonly tracked: boolean;
  readonly rows: readonly WorldModuleRow[];
  readonly changes: number;
  /** Queued commands, including any that change nothing. */
  readonly queued: number;
  readonly problems: number;
  readonly nowCount: number;
  readonly nextCount: number;
  /** The modules on after the next launch, as the review shows them. */
  readonly next: readonly string[];
}

interface Context {
  readonly state: SetupState;
  readonly worldId: string;
  readonly now: ReadonlySet<string>;
  readonly next: ReadonlySet<string>;
  readonly plan: Plan | undefined;
  readonly byId: ReadonlyMap<string, PackageInfo>;
  readonly pending: readonly Command[];
}

const moduleReqs = (p: PackageInfo | undefined): string[] =>
  (p?.requires ?? []).filter((r) => r.type === "module").map((r) => r.id);

/** Modules on after the launch that need `id`. */
const neededBy = (ctx: Context, id: string): string[] =>
  [...ctx.next].filter((m) => moduleReqs(ctx.byId.get(m)).includes(id));

function blockedWhy(ctx: Context, id: string): Why | undefined {
  const b = ctx.plan?.blocked.find((x) => x.id === id);
  if (b) return { kind: "blocked", ids: b.detail };
  const inc = ctx.plan?.incompatible.find((x) => x.id === id);
  return inc ? { kind: "blocked", ids: [] } : undefined;
}

function problemWhy(ctx: Context, pkg: PackageInfo): Why | undefined {
  const on = ctx.next.has(pkg.id);
  const blocked = blockedWhy(ctx, pkg.id);
  if (blocked) return blocked;
  if (on) {
    const missing = moduleReqs(pkg).find((r) => !ctx.next.has(r));
    if (missing) return { kind: "needs", id: missing };
    const clash = pkg.conflicts.find((c) => ctx.next.has(c.id));
    if (clash) return { kind: "conflict", id: clash.id };
    return undefined;
  }
  const users = neededBy(ctx, pkg.id);
  return users.length ? { kind: "neededBy", ids: users } : undefined;
}

function presetWhy(ctx: Context, id: string): Why | undefined {
  if (ctx.now.has(id) || !ctx.next.has(id)) return undefined;
  const { presets } = ctx.state.library;
  for (const c of ctx.pending) {
    if (c.payload.mode === "remove") continue;
    const p = presets.find(
      (x) => c.payload.presetIds.includes(x.id) && x.modules.includes(id),
    );
    if (p) return { kind: "preset", name: p.name };
  }
  return undefined;
}

/** As Foundry badges it: a newer build of the verified generation is fine. */
const isRisky = (ctx: Context, pkg: PackageInfo): boolean =>
  isCompatibilityRisk(
    testAvailability(
      pkg.compatibility,
      parseCoreVersion(ctx.state.setup?.core.version ?? ""),
    ),
  );

function infoWhy(ctx: Context, pkg: PackageInfo): Why {
  const preset = presetWhy(ctx, pkg.id);
  if (preset) return preset;
  const users = neededBy(ctx, pkg.id);
  if (users.length) return { kind: "neededBy", ids: users };
  if (isRisky(ctx, pkg)) return { kind: "unverified" };
  const note = ctx.state.library.modules[pkg.id]?.note.trim();
  if (note) return { kind: "note", text: note };
  const description = pkg.description?.trim();
  if (description) return { kind: "description", text: description };
  return { kind: "authors", text: pkg.authors.map((a) => a.name).join(", ") };
}

function rowFor(ctx: Context, pkg: PackageInfo): WorldModuleRow {
  const now = ctx.now.has(pkg.id);
  const next = ctx.next.has(pkg.id);
  const delta = now === next ? undefined : next ? "on" : "off";
  if (pkg.id === COMPANION_ID)
    return {
      pkg,
      now,
      next,
      delta,
      why: { kind: "companion" },
      problem: false,
      risk: false,
    };
  const problem = problemWhy(ctx, pkg);
  const why = problem ?? infoWhy(ctx, pkg);
  const risk = isRisky(ctx, pkg);
  return { pkg, now, next, delta, why, problem: problem !== undefined, risk };
}

function context(state: SetupState, worldId: string): Context | undefined {
  const snapshot = state.snapshots[worldId];
  if (!snapshot || !state.setup) return undefined;
  const now = new Set(snapshot.active.map((m) => m.id));
  const { plan } = previewApply(state, { worldId, removeDependents: false });
  return {
    state,
    worldId,
    now,
    next: plan ? new Set(plan.target) : now,
    plan,
    byId: new Map(state.setup.modules.map((m) => [m.id, m])),
    pending: pendingFor(state, worldId),
  };
}

export function worldModules(state: SetupState, worldId: string): WorldModules {
  const ctx = context(state, worldId);
  const queued = pendingFor(state, worldId).length;
  if (!ctx || !state.setup)
    return {
      tracked: false,
      rows: [],
      changes: 0,
      queued,
      problems: 0,
      nowCount: 0,
      nextCount: 0,
      next: [],
    };
  const rows = state.setup.modules.map((m) => rowFor(ctx, m));
  return {
    tracked: true,
    rows,
    changes: rows.filter((r) => r.delta).length,
    queued,
    problems: rows.filter((r) => r.problem).length,
    nowCount: rows.filter((r) => r.now).length,
    nextCount: rows.filter((r) => r.next).length,
    next: rows.filter((r) => r.next).map((r) => r.pkg.id),
  };
}

export interface Flip {
  /** Queued single-module changes to cancel. */
  readonly cancel: readonly string[];
  /** A new change, when cancelling isn't enough. */
  readonly queue?: NewChange;
}

const isSingle = (c: Command, id: string): boolean =>
  c.payload.presetIds.length === 0 &&
  c.payload.modules?.length === 1 &&
  c.payload.modules[0] === id;

/**
 * Flipping a switch undoes this module's own earlier change first, and
 * queues a new one only if the world would still not match the switch.
 */
export function flipModule(
  state: SetupState,
  worldId: string,
  moduleId: string,
  on: boolean,
): Flip {
  const singles = pendingFor(state, worldId).filter((c) =>
    isSingle(c, moduleId),
  );
  const cancel = singles.map((c) => c.id);
  const without: SetupState = {
    ...state,
    commands: state.commands.filter((c) => !cancel.includes(c.id)),
  };
  const ctx = context(without, worldId);
  if (ctx?.next.has(moduleId) === on) return { cancel };
  return {
    cancel,
    queue: { mode: on ? "add" : "remove", presetIds: [], modules: [moduleId] },
  };
}

/**
 * The modules on in a world after its next launch, the companion left out:
 * what "copy this world" copies (queued changes included, as the prototype).
 */
export const nextSet = (state: SetupState, worldId: string): string[] =>
  worldModules(state, worldId)
    .rows.filter((r) => r.next && r.pkg.id !== COMPANION_ID)
    .map((r) => r.pkg.id);
