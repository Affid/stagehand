// The Updates tab's model (docs/UPDATES-PLAN.md): which section each checked
// package goes in, the warnings worked out before anything installs, the
// order to install in, and what a run would still leave broken. Pure: the
// UI and the tests feed it what is installed and what the check found.
import { isNewerVersion } from "../version.ts";
import type { CheckState, Need, PackageCheck } from "./check.ts";

/** A declared relationship of an installed package, as its manifest says. */
export interface Declared {
  readonly id: string;
  readonly type?: string | undefined;
  readonly compatibility?:
    | {
        readonly minimum?: string | undefined;
        readonly maximum?: string | undefined;
      }
    | undefined;
}

export interface InstalledPackage {
  readonly id: string;
  readonly type: "module" | "system";
  readonly title: string;
  readonly version: string;
  readonly locked?: boolean | undefined;
  readonly requires?: readonly Declared[] | undefined;
  readonly systems?: readonly Declared[] | undefined;
}

export interface UpdatesInput {
  readonly installed: readonly InstalledPackage[];
  /** The last check of each package, by id. */
  readonly checks: Readonly<Record<string, PackageCheck>>;
  /** Downloads refused by version (a membership may have ended), by id. */
  readonly refused: Readonly<Record<string, string>>;
}

export type Section = "ready" | "attention" | "blocked" | "noaccess" | "error";

export type Block =
  | { readonly kind: "core"; readonly minimum?: string }
  | { readonly kind: "missing"; readonly id: string }
  | { readonly kind: "denied"; readonly errorCode?: number }
  | { readonly kind: "notOwned" }
  | { readonly kind: "refused"; readonly version: string }
  | {
      readonly kind: "error";
      readonly error?: string;
      readonly errorCode?: number;
    };

export interface Dependent {
  readonly id: string;
  readonly maximum: string;
  /** Its own update, which fits the new version. */
  readonly fix?: string;
}

export type Warning =
  | {
      readonly kind: "needs" | "system";
      readonly id: string;
      readonly minimum?: string;
      readonly maximum?: string;
      readonly have: string;
      /** The update that would meet it. */
      readonly fix?: string;
    }
  | { readonly kind: "impact"; readonly dependents: readonly Dependent[] };

export interface Row {
  readonly id: string;
  readonly type: "module" | "system";
  readonly title: string;
  readonly from: string;
  readonly to?: string;
  readonly section: Section;
  readonly block?: Block;
  readonly check: PackageCheck;
}

const SHOWN: ReadonlySet<CheckState> = new Set([
  "update",
  "core",
  "denied",
  "notOwned",
  "error",
]);

const installedOf = (i: UpdatesInput, id: string) =>
  i.installed.find((p) => p.id === id);

/** An update Foundry would install here, not refused at this version. */
function offered(i: UpdatesInput, id: string): PackageCheck | undefined {
  const c = i.checks[id];
  if (c?.state !== "update" || !c.version) return undefined;
  const have = installedOf(i, id)?.version;
  if (have && !isNewerVersion(c.version, have)) return undefined;
  return i.refused[id] === c.version ? undefined : c;
}

/** The version a package has after a run that installs `chosen`. */
function willHave(
  i: UpdatesInput,
  id: string,
  chosen: ReadonlySet<string>,
): string | undefined {
  const c = offered(i, id);
  if (c?.version && chosen.has(id)) return c.version;
  return installedOf(i, id)?.version;
}

const fits = (
  version: string,
  range: {
    readonly minimum?: string | undefined;
    readonly maximum?: string | undefined;
  },
): boolean =>
  !(range.minimum && isNewerVersion(range.minimum, version)) &&
  !(range.maximum && isNewerVersion(version, range.maximum));

function needWarning(
  i: UpdatesInput,
  kind: "needs" | "system",
  need: Need,
  chosen: ReadonlySet<string>,
): Warning | undefined {
  const have = willHave(i, need.id, chosen);
  if (have === undefined || fits(have, need)) return undefined;
  const fixVersion = offered(i, need.id)?.version;
  const fix = fixVersion && fits(fixVersion, need) ? need.id : undefined;
  return {
    kind,
    id: need.id,
    ...(need.minimum ? { minimum: need.minimum } : {}),
    ...(need.maximum ? { maximum: need.maximum } : {}),
    have,
    ...(fix ? { fix } : {}),
  };
}

/** The range a module's update declares for `target`, if it declares one. */
function updatedRange(
  i: UpdatesInput,
  dependent: string,
  target: InstalledPackage,
): Need | undefined {
  const c = offered(i, dependent);
  const list = target.type === "system" ? c?.systems : c?.requires;
  return list?.find((n) => n.id === target.id);
}

/** Installed modules the new version of `target` puts outside their declared range. */
function dependentsLeft(
  i: UpdatesInput,
  target: InstalledPackage,
  to: string,
  chosen: ReadonlySet<string>,
): Dependent[] {
  const out: Dependent[] = [];
  for (const m of i.installed) {
    if (m.id === target.id || m.type !== "module") continue;
    const list = target.type === "system" ? m.systems : m.requires;
    const maximum = list?.find((d) => d.id === target.id)?.compatibility
      ?.maximum;
    if (!maximum || !isNewerVersion(to, maximum)) continue;
    const range = updatedRange(i, m.id, target);
    const fixFits = range === undefined || fits(to, range);
    if (chosen.has(m.id) && offered(i, m.id) && fixFits) continue;
    out.push({
      id: m.id,
      maximum,
      ...(offered(i, m.id) && fixFits ? { fix: m.id } : {}),
    });
  }
  return out;
}

/** What a package's update would leave unmet, if `chosen` is what installs. */
export function warningsOf(
  i: UpdatesInput,
  id: string,
  chosen: ReadonlySet<string>,
): Warning[] {
  const c = offered(i, id);
  const target = installedOf(i, id);
  if (!c?.version || !target) return [];
  const out: Warning[] = [];
  for (const need of c.requires ?? []) {
    const w = needWarning(i, "needs", need, chosen);
    if (w) out.push(w);
  }
  for (const need of c.systems ?? []) {
    const w = needWarning(i, "system", need, chosen);
    if (w) out.push(w);
  }
  const left = dependentsLeft(i, target, c.version, chosen);
  if (left.length) out.push({ kind: "impact", dependents: left });
  return out;
}

function blockOf(i: UpdatesInput, c: PackageCheck): Block | undefined {
  if (c.state === "core")
    return {
      kind: "core",
      ...(c.compatibility?.minimum ? { minimum: c.compatibility.minimum } : {}),
    };
  if (c.state === "denied")
    return {
      kind: "denied",
      ...(c.errorCode ? { errorCode: c.errorCode } : {}),
    };
  if (c.state === "notOwned") return { kind: "notOwned" };
  if (c.state === "error")
    return {
      kind: "error",
      ...(c.error ? { error: c.error } : {}),
      ...(c.errorCode ? { errorCode: c.errorCode } : {}),
    };
  if (c.version && i.refused[c.id] === c.version)
    return { kind: "refused", version: c.version };
  const missing = (c.requires ?? []).find((n) => !installedOf(i, n.id));
  return missing ? { kind: "missing", id: missing.id } : undefined;
}

const SECTION_OF: Readonly<Record<Block["kind"], Section>> = {
  core: "blocked",
  missing: "blocked",
  denied: "noaccess",
  notOwned: "noaccess",
  refused: "noaccess",
  error: "error",
};

/** The packages with something to show, in the order they were installed. */
function candidates(
  i: UpdatesInput,
): { pkg: InstalledPackage; check: PackageCheck }[] {
  return i.installed.flatMap((pkg) => {
    const check = i.checks[pkg.id];
    if (!check || pkg.locked || !SHOWN.has(check.state)) return [];
    // Installed since the check (ours just now, or Foundry's own): current.
    const behind = check.version && isNewerVersion(check.version, pkg.version);
    if ((check.state === "update" || check.state === "notOwned") && !behind)
      return [];
    return [{ pkg, check }];
  });
}

/**
 * Ready grows until it settles: a row whose need another Ready row meets
 * (a module and its library) is Ready too, so ticking doesn't move rows.
 */
function settledReady(i: UpdatesInput, open: readonly string[]): Set<string> {
  let ready = new Set<string>();
  for (let pass = 0; pass <= open.length; pass++) {
    const next = new Set(
      open.filter(
        (id) => warningsOf(i, id, new Set([...ready, id])).length === 0,
      ),
    );
    if (next.size === ready.size) return next;
    ready = next;
  }
  return ready;
}

export function rowsOf(i: UpdatesInput): Row[] {
  const list = candidates(i).map(({ pkg, check }) => ({
    pkg,
    check,
    block: blockOf(i, check),
  }));
  const open = list.filter((x) => !x.block).map((x) => x.pkg.id);
  const ready = settledReady(i, open);
  return list.map(({ pkg, check, block }) => ({
    id: pkg.id,
    type: pkg.type,
    title: pkg.title,
    from: pkg.version,
    ...(check.version && check.state !== "denied" && check.state !== "error"
      ? { to: check.version }
      : {}),
    section: block
      ? SECTION_OF[block.kind]
      : ready.has(pkg.id)
        ? "ready"
        : "attention",
    ...(block ? { block } : {}),
    check,
  }));
}

/** The rows ticked at first: every Ready update. */
export const readyIds = (i: UpdatesInput): string[] =>
  rowsOf(i)
    .filter((r) => r.section === "ready")
    .map((r) => r.id);

/** Systems first, then what others in the run need, then the rest in order. */
export function installOrder(
  i: UpdatesInput,
  ids: readonly string[],
): string[] {
  const needed = new Set(
    ids.flatMap((id) => {
      const c = i.checks[id];
      return [...(c?.requires ?? []), ...(c?.systems ?? [])].map((n) => n.id);
    }),
  );
  const rank = (id: string): number =>
    installedOf(i, id)?.type === "system" ? 0 : needed.has(id) ? 1 : 2;
  return ids
    .map((id, at) => ({ id, at }))
    .sort((a, b) => rank(a.id) - rank(b.id) || a.at - b.at)
    .map((x) => x.id);
}

/** What each package in a run would still leave unmet, judged on that run alone. */
export function risksOf(
  i: UpdatesInput,
  ids: readonly string[],
): { readonly id: string; readonly warnings: readonly Warning[] }[] {
  const run = new Set(ids);
  return ids.flatMap((id) => {
    const warnings = warningsOf(i, id, run);
    return warnings.length ? [{ id, warnings }] : [];
  });
}
