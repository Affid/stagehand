// Our own check of packages (docs/UPDATES-PLAN.md, phase 2): the UI asks
// with PACKAGE_CHECK (the library, one package, or stop); the page world
// runs Foundry's checkPackage for each, five at a time, and answers with
// PACKAGE_CHECK events: progress, one result per package, the end. The
// manifest to install from stays in the page world. Checked both ways, by
// hand: the page world stays free of Zod.
import type {
  CheckState,
  Need,
  PackageCheck,
} from "@stagehand/shared/updates/check";

type Loose = Readonly<Record<string, unknown>>;
export type PackageType = "module" | "system";

export type CheckRequest =
  | { readonly requestId: string; readonly op: "all" }
  | {
      readonly requestId: string;
      readonly op: "one";
      readonly type: PackageType;
      readonly id: string;
    }
  | { readonly requestId: string; readonly op: "stop" };

export type CheckEvent =
  | {
      readonly requestId: string;
      readonly kind: "tick";
      readonly done: number;
      readonly total: number;
      readonly current?: string;
    }
  | {
      readonly requestId: string;
      readonly kind: "result";
      readonly result: PackageCheck;
    }
  | {
      readonly requestId: string;
      readonly kind: "done";
      readonly stopped?: true;
      readonly error?: string;
    };

const REQUEST_ID = /^[a-z0-9-]{1,64}$/i;
const ID = /^[A-Za-z0-9_-]{1,200}$/;
const MAX_VERSION = 60;
const MAX_ERROR = 500;
const MAX_NEEDS = 100;
const MAX_COUNT = 10_000;
const STATES: readonly CheckState[] = [
  "current",
  "update",
  "core",
  "denied",
  "notOwned",
  "error",
];

const isObject = (v: unknown): v is Loose =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const isId = (v: unknown): v is string => typeof v === "string" && ID.test(v);
const isType = (v: unknown): v is PackageType =>
  v === "module" || v === "system";
const isVersion = (v: unknown): v is string =>
  typeof v === "string" && v.length > 0 && v.length <= MAX_VERSION;
const isCount = (v: unknown, max = MAX_COUNT): v is number =>
  typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= max;

export function parseCheckRequest(p: Loose): CheckRequest | undefined {
  const { requestId, op, type, id } = p;
  if (typeof requestId !== "string" || !REQUEST_ID.test(requestId))
    return undefined;
  if (op === "all" || op === "stop")
    return Object.keys(p).length === 2 ? { requestId, op } : undefined;
  if (op === "one" && isType(type) && isId(id))
    return { requestId, op, type, id };
  return undefined;
}

/** A version range with only the known keys, each a version. */
function range(
  v: unknown,
  keys: readonly ("minimum" | "verified" | "maximum")[],
): Record<string, string> | undefined {
  if (v === undefined) return {};
  if (!isObject(v)) return undefined;
  const out: Record<string, string> = {};
  for (const k of keys) {
    const x = v[k];
    if (x === undefined) continue;
    if (!isVersion(x)) return undefined;
    out[k] = x;
  }
  return out;
}

function needs(v: unknown): Need[] | undefined {
  if (!Array.isArray(v) || v.length > MAX_NEEDS) return undefined;
  const out: Need[] = [];
  for (const n of v as unknown[]) {
    if (!isObject(n) || !isId(n.id)) return undefined;
    const r = range(n, ["minimum", "maximum"]);
    if (!r) return undefined;
    out.push({ id: n.id, ...r });
  }
  return out;
}

/** One package's result, checked; undefined when anything is off. */
export function parseCheckResult(v: unknown): PackageCheck | undefined {
  if (!isObject(v) || !isId(v.id) || !isType(v.type)) return undefined;
  const { state, version, availability, errorCode, error, checkedAt } = v;
  if (!(STATES as readonly unknown[]).includes(state)) return undefined;
  if (version !== undefined && !isVersion(version)) return undefined;
  if (availability !== undefined && !isCount(availability, 20))
    return undefined;
  if (errorCode !== undefined && !(isCount(errorCode, 599) && errorCode >= 100))
    return undefined;
  if (
    error !== undefined &&
    !(typeof error === "string" && error.length <= MAX_ERROR)
  )
    return undefined;
  if (typeof checkedAt !== "number" || checkedAt < 0) return undefined;
  const compatibility =
    v.compatibility === undefined
      ? undefined
      : range(v.compatibility, ["minimum", "verified", "maximum"]);
  if (v.compatibility !== undefined && !compatibility) return undefined;
  const requires = v.requires === undefined ? undefined : needs(v.requires);
  const systems = v.systems === undefined ? undefined : needs(v.systems);
  if (
    (v.requires !== undefined && !requires) ||
    (v.systems !== undefined && !systems)
  )
    return undefined;
  return {
    id: v.id,
    type: v.type,
    state: state as CheckState,
    ...(version === undefined ? {} : { version }),
    ...(availability === undefined ? {} : { availability }),
    ...(compatibility ? { compatibility } : {}),
    ...(requires ? { requires } : {}),
    ...(systems ? { systems } : {}),
    ...(errorCode === undefined ? {} : { errorCode }),
    ...(error === undefined ? {} : { error }),
    checkedAt,
  };
}

export function parseCheckEvent(p: Loose): CheckEvent | undefined {
  const { requestId, kind } = p;
  if (typeof requestId !== "string" || !REQUEST_ID.test(requestId))
    return undefined;
  if (kind === "tick") {
    const { done, total, current } = p;
    if (!isCount(done) || !isCount(total) || done > total) return undefined;
    if (current !== undefined && !isId(current)) return undefined;
    return {
      requestId,
      kind,
      done,
      total,
      ...(current === undefined ? {} : { current }),
    };
  }
  if (kind === "result") {
    const result = parseCheckResult(p.result);
    return result ? { requestId, kind, result } : undefined;
  }
  if (kind === "done") {
    const { stopped, error } = p;
    if (stopped !== undefined && stopped !== true) return undefined;
    if (
      error !== undefined &&
      !(typeof error === "string" && error.length <= MAX_ERROR)
    )
      return undefined;
    return {
      requestId,
      kind,
      ...(stopped ? { stopped } : {}),
      ...(error === undefined ? {} : { error }),
    };
  }
  return undefined;
}
