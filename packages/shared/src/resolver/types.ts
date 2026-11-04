import type { PackageInfo } from "../package.ts";
import type { Availability, CoreVersion } from "../version.ts";

export type ApplyMode = "replace" | "add" | "remove";

export interface ApplySpec {
  readonly mode: ApplyMode;
  readonly modules: readonly string[];
}

export interface ResolveInput {
  /** Commands in queue order; presets already expanded to module ids. */
  readonly commands: readonly ApplySpec[];
  readonly current: readonly string[];
  readonly installed: readonly PackageInfo[];
  /** The world's core version, not necessarily the running Setup's (V-7). */
  readonly core: CoreVersion;
  readonly system?:
    { readonly id: string; readonly version: string } | undefined;
  readonly companionId: string;
  /** Remove safety (8.5 step 5): also disable modules that need a removed one. */
  readonly removeDependents?: boolean;
}

export interface BlockedModule {
  readonly id: string;
  readonly reason: "missing-requirement" | "incompatible-requirement";
  readonly detail: readonly string[];
}

export interface IncompatibleModule {
  readonly id: string;
  readonly reason: "core" | "system";
  readonly availability?: Availability;
}

export interface Conflict {
  readonly id: string;
  readonly with: string;
  readonly reason?: string;
}

export interface Dependent {
  readonly id: string;
  readonly requiredBy: readonly string[];
}

export interface Plan {
  readonly start: readonly string[];
  readonly target: readonly string[];
  readonly enable: readonly string[];
  readonly disable: readonly string[];
  readonly changed: boolean;
  readonly dependencyAdditions: readonly string[];
  readonly missing: readonly string[];
  readonly blocked: readonly BlockedModule[];
  readonly incompatible: readonly IncompatibleModule[];
  readonly conflicts: readonly Conflict[];
  readonly dependents: readonly Dependent[];
}
