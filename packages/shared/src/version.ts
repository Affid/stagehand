// Version comparison and package availability, mirroring Foundry core
// (common/utils/helpers.mjs isNewerVersion, common/packages/base-package.mjs
// testAvailability and testDependencyCompatibility, V14 build 369), so the
// extension can judge compatibility against any world's core version (V-7).

export interface CoreVersion {
  readonly version: string;
  readonly generation: number;
  readonly build: number;
}

export interface CompatibilityRange {
  readonly minimum?: string | undefined;
  readonly verified?: string | undefined;
  readonly maximum?: string | undefined;
}

/** Foundry's PACKAGE_AVAILABILITY_CODES, collapsed to what we report. */
export const Availability = {
  UNKNOWN: "unknown",
  VERIFIED: "verified",
  UNVERIFIED_BUILD: "unverified-build",
  UNVERIFIED_GENERATION: "unverified-generation",
  REQUIRES_CORE_DOWNGRADE: "requires-core-downgrade",
  REQUIRES_CORE_UPGRADE: "requires-core-upgrade",
} as const;

export type Availability = (typeof Availability)[keyof typeof Availability];

const isNumeric = (part: string): boolean =>
  part.trim() !== "" && Number.isFinite(Number(part));

export function isNewerVersion(
  v1: string | undefined | null,
  v0: string | undefined | null,
  { majorOnly = false }: { readonly majorOnly?: boolean } = {},
): boolean {
  if (v1 === null || v1 === undefined) return false;
  if (v0 === null || v0 === undefined) return true;
  const cut = (v: string): string[] =>
    majorOnly ? v.split(".").slice(0, 1) : v.split(".");
  const v1Parts = cut(v1);
  const v0Parts = cut(v0);
  for (const [i, p1] of v1Parts.entries()) {
    const p0 = v0Parts[i];
    if (p0 === undefined) return true;
    if (isNumeric(p0) && isNumeric(p1) && Number(p1) !== Number(p0))
      return Number(p1) > Number(p0);
    if (p1 !== p0) return p1 > p0;
  }
  return false;
}

/** A version without the "v" some packages write before the number. */
export const bareVersion = (v: string): string => v.replace(/^v(?=\d)/i, "");

/** A version as shown: one "v" before the number, never two ("vv1.1.4"). */
export const shownVersion = (v: string): string =>
  !v || /^v\d/i.test(v) ? v : `v${v}`;

export function parseCoreVersion(version: string): CoreVersion {
  const [generation = "0", build = "0"] = version.split(".");
  return { version, generation: Number(generation), build: Number(build) };
}

const isGenerationOnly = (v: string): boolean => Number.isInteger(Number(v));

/**
 * Whether Foundry badges this availability as a risk (a warning or an
 * error). A newer build of the verified generation is neutral in Foundry
 * (UNVERIFIED_BUILD, "verified with 14.369"), so it is not one.
 */
export const isCompatibilityRisk = (a: Availability): boolean =>
  a !== Availability.VERIFIED && a !== Availability.UNVERIFIED_BUILD;

export function testAvailability(
  compatibility: CompatibilityRange,
  core: CoreVersion,
): Availability {
  const { minimum, maximum, verified } = compatibility;
  if (minimum && isNewerVersion(minimum, core.version))
    return Availability.REQUIRES_CORE_UPGRADE;
  if (maximum) {
    const majorOnly = isGenerationOnly(maximum);
    if (isNewerVersion(core.version, maximum, { majorOnly }))
      return Availability.REQUIRES_CORE_DOWNGRADE;
  }
  if (verified) {
    const majorOnly = isGenerationOnly(verified);
    if (!isNewerVersion(core.version, verified, { majorOnly }))
      return Availability.VERIFIED;
    const sameGeneration =
      core.generation === Number(verified.split(".")[0] ?? "");
    return sameGeneration
      ? Availability.UNVERIFIED_BUILD
      : Availability.UNVERIFIED_GENERATION;
  }
  return Availability.UNKNOWN;
}

/** Core refuses to activate packages outside their core version range. */
export function isUsable(availability: Availability): boolean {
  return (
    availability !== Availability.REQUIRES_CORE_DOWNGRADE &&
    availability !== Availability.REQUIRES_CORE_UPGRADE
  );
}

export function testDependencyCompatibility(
  range: CompatibilityRange | undefined,
  version: string,
): boolean {
  if (!range) return true;
  if (range.minimum && isNewerVersion(range.minimum, version)) return false;
  if (range.maximum && isNewerVersion(version, range.maximum)) return false;
  return true;
}
