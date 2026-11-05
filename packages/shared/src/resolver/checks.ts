// Compatibility, conflict and remove-safety checks (PRD 8.5 steps 5-7).
import type { PackageInfo } from "../package.ts";
import {
  type CoreVersion,
  isUsable,
  testAvailability,
  testDependencyCompatibility,
} from "../version.ts";
import { directRequirements } from "./requirements.ts";
import type { Conflict, Dependent, IncompatibleModule } from "./types.ts";

export function incompatibility(
  pkg: PackageInfo,
  core: CoreVersion,
  system: { readonly id: string; readonly version: string } | undefined,
): IncompatibleModule | undefined {
  const availability = testAvailability(pkg.compatibility, core);
  if (!isUsable(availability))
    return { id: pkg.id, reason: "core", availability };
  const systems = pkg.systems.filter((s) => s.type === "system");
  if (systems.length === 0 || !system) return undefined;
  const supported = systems.some(
    (s) =>
      s.id === system.id &&
      testDependencyCompatibility(s.compatibility, system.version),
  );
  return supported ? undefined : { id: pkg.id, reason: "system" };
}

export function findConflicts(
  target: readonly string[],
  byId: ReadonlyMap<string, PackageInfo>,
): Conflict[] {
  const inTarget = new Set(target);
  const seen = new Set<string>();
  const once = (c: Conflict): boolean => {
    const key = [c.id, c.with].sort().join("\n");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  };
  const all = target.flatMap((id) =>
    (byId.get(id)?.conflicts ?? [])
      .filter((c) => c.type === "module" && inTarget.has(c.id))
      .filter((c) => {
        const other = byId.get(c.id);
        return (
          other !== undefined &&
          testDependencyCompatibility(c.compatibility, other.version)
        );
      })
      .map((c) =>
        c.reason === undefined
          ? { id, with: c.id }
          : { id, with: c.id, reason: c.reason },
      ),
  );
  return all.filter(once);
}

/** Staying modules that need a module being turned off. */
export function findDependents(
  target: readonly string[],
  removed: readonly string[],
  byId: ReadonlyMap<string, PackageInfo>,
): Dependent[] {
  return removed
    .map((id) => ({
      id,
      requiredBy: target.filter((t) =>
        directRequirements(byId.get(t)).includes(id),
      ),
    }))
    .filter((d) => d.requiredBy.length > 0);
}

/** Drops staying modules that need a turned-off one, until none is left. */
export function withoutDependents(
  target: readonly string[],
  start: readonly string[],
  byId: ReadonlyMap<string, PackageInfo>,
  companionId: string,
): string[] {
  let kept = [...target];
  for (;;) {
    const off = new Set(start.filter((id) => !kept.includes(id)));
    const next = kept.filter(
      (id) =>
        id === companionId ||
        !directRequirements(byId.get(id)).some((r) => off.has(r)),
    );
    if (next.length === kept.length) return kept;
    kept = next;
  }
}
