// Our own check of packages, in the page world (docs/UPDATES-PLAN.md, phase
// 2): Foundry's checkPackage for each unlocked package with a manifest, five
// at a time as Foundry's Update All runs them. Nothing installs. Each answer
// is cut to what the Updates tab judges; the manifest to install from is
// kept here for the install, never sent to the UI.
import type { Need, PackageCheck } from "@stagehand/shared/updates/check";
import type { PackageType } from "../page-package-check.ts";
import type { PageToUi } from "../page-protocol.ts";
import type { PageGlobals } from "./globals.ts";

type Loose = Readonly<Record<string, unknown>>;

interface Collection {
  values(): Iterable<unknown>;
  get?(id: string): unknown;
}

interface CheckGame {
  readonly modules?: Collection;
  readonly systems?: Collection;
  checkPackage?(o: { type: string; id: string }): Promise<unknown>;
  getPackages?(o: { type: string }): Promise<ReadonlyMap<string, unknown>>;
  readonly packageCache?: Record<string, { packages?: unknown } | undefined>;
}

/** Foundry's Update All runs this many checks at once. */
export const CONCURRENCY = 5;
/** Availability codes for another Foundry (7 to 10). */
const CORE_MIN = 7;
const CORE_MAX = 10;
const MAX_ERROR = 300;
const DENIED: ReadonlySet<number> = new Set([401, 403]);

/** The manifest each checked update installs from: `${type}:${id}`. */
const manifests = new Map<string, string>();
export const manifestFor = (
  type: PackageType,
  id: string,
): string | undefined => manifests.get(`${type}:${id}`);

const isObject = (v: unknown): v is Loose =>
  typeof v === "object" && v !== null;
const text = (v: unknown): string | undefined =>
  typeof v === "string" && v.length > 0 && v.length <= 60 ? v : undefined;

function gameOf(page: Pick<PageGlobals, "game">): CheckGame | undefined {
  return page.game;
}

function packagesOf(game: CheckGame | undefined, type: PackageType): Loose[] {
  const c = type === "module" ? game?.modules : game?.systems;
  return [...(c?.values() ?? [])].filter(isObject);
}

/** Every unlocked package with a manifest, as Foundry's Update All picks them. */
export function checkList(
  page: Pick<PageGlobals, "game">,
): { type: PackageType; id: string }[] {
  const game = gameOf(page);
  return (["module", "system"] as const).flatMap((type) =>
    packagesOf(game, type)
      .filter((p) => typeof p.id === "string" && p.manifest && !p.locked)
      .map((p) => ({ type, id: p.id as string })),
  );
}

/** A range with only the known keys that are versions. */
function rangeOf(v: unknown, keys: readonly string[]): Record<string, string> {
  if (!isObject(v)) return {};
  return Object.fromEntries(
    keys.flatMap((k) => {
      const x = text(v[k]);
      return x ? [[k, x]] : [];
    }),
  );
}

function needsOf(v: unknown, type: string): Need[] {
  const list = Array.isArray(v) ? (v as unknown[]) : [];
  return list.flatMap((n) => {
    if (!isObject(n) || typeof n.id !== "string") return [];
    if (n.type !== undefined && n.type !== type) return [];
    return [{ id: n.id, ...rangeOf(n.compatibility, ["minimum", "maximum"]) }];
  });
}

/** Foundry's error, without its "[id] " prefix or any address (it may hold a key). */
function errorText(e: unknown): string {
  const raw = e instanceof Error ? e.message : String(e);
  return raw
    .replace(/^\[[^\]]*\]\s*/, "")
    .replace(/https?:\/\/\S+/g, "its address")
    .slice(0, MAX_ERROR);
}

function failed(
  type: PackageType,
  id: string,
  e: unknown,
  now: number,
): PackageCheck {
  const code = isObject(e) ? e.errorCode : undefined;
  const errorCode =
    typeof code === "number" &&
    Number.isInteger(code) &&
    code >= 100 &&
    code <= 599
      ? code
      : undefined;
  return {
    id,
    type,
    state:
      errorCode !== undefined && DENIED.has(errorCode) ? "denied" : "error",
    ...(errorCode === undefined ? {} : { errorCode }),
    error: errorText(e),
    checkedAt: now,
  };
}

/** One package's answer (or error) as the Updates tab reads it. */
export function normalise(
  type: PackageType,
  id: string,
  got: {
    readonly answer?: unknown;
    readonly error?: unknown;
    readonly owned?: boolean;
  },
  now: number,
): PackageCheck {
  if (got.error !== undefined || !isObject(got.answer))
    return failed(type, id, got.error ?? "No answer", now);
  const a = got.answer;
  const remote = isObject(a.remote) ? a.remote : undefined;
  if (!remote) return failed(type, id, a.error ?? "No answer", now);
  const version = text(remote.version);
  const availability =
    typeof a.availability === "number" && Number.isInteger(a.availability)
      ? a.availability
      : undefined;
  const rel = isObject(remote.relationships) ? remote.relationships : {};
  const compatibility = rangeOf(remote.compatibility, [
    "minimum",
    "verified",
    "maximum",
  ]);
  const requires = needsOf(rel.requires, "module");
  const systems = needsOf(rel.systems, "system");
  const upgrade = a.isUpgrade === true && version !== undefined;
  const state = !upgrade
    ? "current"
    : got.owned === false
      ? "notOwned"
      : availability !== undefined &&
          availability >= CORE_MIN &&
          availability <= CORE_MAX
        ? "core"
        : "update";
  return {
    id,
    type,
    state,
    ...(version ? { version } : {}),
    ...(availability === undefined ? {} : { availability }),
    ...(Object.keys(compatibility).length ? { compatibility } : {}),
    ...(requires.length ? { requires } : {}),
    ...(systems.length ? { systems } : {}),
    checkedAt: now,
  };
}

/** Premium packages this license doesn't own, from Foundry's package list. */
async function notOwned(
  game: CheckGame | undefined,
  list: readonly { type: PackageType; id: string }[],
): Promise<Set<string>> {
  const out = new Set<string>();
  for (const type of ["module", "system"] as const) {
    const protectedIds = new Set(
      packagesOf(game, type)
        .filter((p) => p.protected === true)
        .map((p) => p.id),
    );
    if (!list.some((x) => x.type === type && protectedIds.has(x.id))) continue;
    // A purchase since the page opened shows: Foundry's page keeps the list.
    const cache = game?.packageCache?.[type];
    if (cache && "packages" in cache) cache.packages = undefined;
    const listed = await game?.getPackages?.({ type }).catch(() => undefined);
    for (const id of protectedIds) {
      const entry = listed?.get(id as string);
      if (isObject(entry) && entry.owned === false)
        out.add(`${type}:${String(id)}`);
    }
  }
  return out;
}

export interface CheckRun {
  readonly requestId: string;
  readonly post: (m: PageToUi) => void;
  /** Stop asked: no new check starts. */
  readonly stopped: () => boolean;
  readonly now?: () => number;
}

async function checkOne(
  game: CheckGame | undefined,
  item: { type: PackageType; id: string },
  owned: Set<string>,
  now: number,
): Promise<PackageCheck> {
  if (!game?.checkPackage)
    return failed(item.type, item.id, "Foundry's check is missing", now);
  try {
    const answer = await game.checkPackage({ type: item.type, id: item.id });
    const manifest = isObject(answer) ? answer.manifest : undefined;
    if (typeof manifest === "string")
      manifests.set(`${item.type}:${item.id}`, manifest);
    const isOwned = !owned.has(`${item.type}:${item.id}`);
    return normalise(
      item.type,
      item.id,
      { answer, ...(isOwned ? {} : { owned: false }) },
      now,
    );
  } catch (e: unknown) {
    return failed(item.type, item.id, e, now);
  }
}

/** Checks each package, posting progress, each result and the end. */
export async function runCheck(
  page: Pick<PageGlobals, "game">,
  list: readonly { type: PackageType; id: string }[],
  run: CheckRun,
): Promise<void> {
  const game = gameOf(page);
  const now = run.now ?? Date.now;
  const { requestId, post } = run;
  const owned = await notOwned(game, list);
  const total = list.length;
  let next = 0;
  let done = 0;
  const worker = async (): Promise<void> => {
    while (next < total && !run.stopped()) {
      const item = list[next++];
      if (!item) return;
      post({
        type: "PACKAGE_CHECK",
        payload: { requestId, kind: "tick", done, total, current: item.id },
      });
      const result = await checkOne(game, item, owned, now());
      done++;
      post({
        type: "PACKAGE_CHECK",
        payload: { requestId, kind: "result", result },
      });
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, total) }, worker),
  );
  post({
    type: "PACKAGE_CHECK",
    payload: {
      requestId,
      kind: "done",
      ...(run.stopped() && done < total ? { stopped: true } : {}),
    },
  });
}
