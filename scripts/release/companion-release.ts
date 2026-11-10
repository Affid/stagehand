// The companion module's releases (CONTRIBUTING.md, Releases): tags, the
// manifest's URLs, the version bump, the changelog check, and the request to
// Foundry's package release API. Pure, so the release command and the
// workflow share it and tests cover it.
// The scheme follows ModularAV's (docs/RELEASING.md there): a tag per part,
// and a fixed manifest URL on a `manifests` branch instead of GitHub's
// "releases/latest", which in one repository with several parts would be
// whichever part released last.

export const REPOSITORY = "Affid/stagehand";
export const MODULE_ID = "stagehand";
const GITHUB = `https://github.com/${REPOSITORY}`;

/** Where Foundry checks for updates: the manifests branch, never a release. */
export const MANIFEST_URL = `https://raw.githubusercontent.com/${REPOSITORY}/manifests/${MODULE_ID}/module.json`;

export const tagFor = (version: string): string => `${MODULE_ID}-v${version}`;

const downloadFor = (version: string): string =>
  `${GITHUB}/releases/download/${tagFor(version)}/${MODULE_ID}.zip`;

/** This version's own manifest, attached to its GitHub release. */
export const releaseManifestFor = (version: string): string =>
  `${GITHUB}/releases/download/${tagFor(version)}/module.json`;

type Json = Readonly<Record<string, unknown>>;

const isJson = (v: unknown): v is Json =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/** The manifest for `version`: a new object, the rest kept as it is. */
export function bumpManifest(manifest: Json, version: string): Json {
  return { ...manifest, version, download: downloadFor(version) };
}

const SEMVER = /^(\d+)\.(\d+)\.(\d+)$/;

const parts = (v: string): readonly number[] =>
  (SEMVER.exec(v) ?? []).slice(1).map(Number);

/** Why `next` can't follow `current`, or undefined when it can. */
export function newerVersion(
  next: string,
  current: string,
): string | undefined {
  // Foundry compares versions without pre-release labels.
  if (!SEMVER.test(next)) return `${next} is not plain semver (1.2.3)`;
  const a = parts(next);
  const b = parts(current);
  for (let i = 0; i < 3; i++) {
    const d = (a[i] ?? 0) - (b[i] ?? 0);
    if (d !== 0)
      return d > 0 ? undefined : `${next} is not newer than ${current}`;
  }
  return `${next} is not newer than ${current}`;
}

const escapeRegExp = (s: string): string =>
  s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** CHANGELOG.md has a "Companion module <version>" heading. */
export function changelogHas(text: string, version: string): boolean {
  return new RegExp(
    `^#+ Companion module ${escapeRegExp(version)}\\s*$`,
    "m",
  ).test(text);
}

export interface ListingRequest {
  readonly id: string;
  readonly "dry-run": boolean;
  readonly release: {
    readonly version: string;
    readonly manifest: string;
    readonly notes: string;
    readonly compatibility: {
      readonly minimum: string;
      readonly verified: string;
      readonly maximum: string;
    };
  };
}

const text = (o: Json, key: string): string =>
  typeof o[key] === "string" ? o[key] : "";

/** The request for Foundry's package release API, from a built manifest. */
export function listingRequest(
  manifest: Json,
  dryRun: boolean,
): ListingRequest {
  const version = text(manifest, "version");
  const compatibility = isJson(manifest.compatibility)
    ? manifest.compatibility
    : {};
  return {
    id: text(manifest, "id"),
    "dry-run": dryRun,
    release: {
      version,
      manifest: releaseManifestFor(version),
      notes: `${GITHUB}/blob/${tagFor(version)}/CHANGELOG.md`,
      compatibility: {
        minimum: text(compatibility, "minimum"),
        verified: text(compatibility, "verified"),
        maximum: text(compatibility, "maximum"),
      },
    },
  };
}

export type ListingOutcome =
  | { readonly kind: "saved" | "checked"; readonly page: string }
  | { readonly kind: "exists" };

function fieldErrors(errors: Json): string[] {
  return Object.entries(errors).flatMap(([field, list]) =>
    (Array.isArray(list) ? (list as unknown[]) : []).map((entry) =>
      isJson(entry) && typeof entry.message === "string"
        ? `${field}: ${entry.message}`
        : `${field}: refused`,
    ),
  );
}

const isDuplicate = (errors: Json): boolean =>
  Array.isArray(errors.__all__) &&
  (errors.__all__ as unknown[]).some(
    (e) => isJson(e) && e.code === "unique_together",
  );

/**
 * Foundry's answer. A version it already has counts as done, so a release
 * that failed later can be run again; too fast (one a minute) says how long
 * to wait.
 */
export function listingOutcome(
  status: number,
  body: unknown,
  dryRun: boolean,
  retryAfter = "60",
): ListingOutcome {
  const json = isJson(body) ? body : {};
  if (status === 429)
    throw new Error(
      `foundryvtt.com limits releases: try again in ${retryAfter} seconds`,
    );
  if (status >= 200 && status < 300 && typeof json.page === "string")
    return { kind: dryRun ? "checked" : "saved", page: json.page };
  const errors = isJson(json.errors) ? json.errors : {};
  if (status === 400 && isDuplicate(errors)) return { kind: "exists" };
  const details = fieldErrors(errors);
  throw new Error(
    `foundryvtt.com answered ${String(status)}${details.length > 0 ? `: ${details.join("; ")}` : ""}`,
  );
}
