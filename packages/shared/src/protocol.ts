// Messages between the companion module (page JavaScript), the extension's
// content scripts and its background. Data only: nothing here is executed.

export const NS = "module-library";
export const PROTOCOL_VERSIONS: readonly number[] = [1];

/** Who posted a message: each side ignores its own posts on `window`. */
export type Sender = "module" | "bridge" | "setup-main" | "setup-ui";

export interface Envelope<P = unknown> {
  readonly ns: typeof NS;
  readonly v: number;
  readonly from: Sender;
  readonly type: string;
  readonly requestId?: string | undefined;
  readonly payload: P;
}

export function makeEnvelope<P>(
  from: Sender,
  type: string,
  payload: P,
  requestId?: string,
): Envelope<P> {
  const base = { ns: NS, v: 1, from, type, payload } as const;
  return requestId === undefined ? base : { ...base, requestId };
}

/** True for a message of this protocol, posted by `expected`. */
export function isEnvelope<S extends Sender>(
  value: unknown,
  expected: S,
): value is Envelope & { readonly from: S } {
  if (typeof value !== "object" || value === null) return false;
  const m = value as Record<string, unknown>;
  return (
    m.ns === NS &&
    typeof m.v === "number" &&
    m.from === expected &&
    typeof m.type === "string" &&
    (m.requestId === undefined || typeof m.requestId === "string")
  );
}

/** The highest protocol version both sides list, if any. */
export function negotiateProtocol(
  ours: readonly number[],
  theirs: readonly number[],
): number | undefined {
  const common = ours.filter((v) => theirs.includes(v));
  return common.length > 0 ? Math.max(...common) : undefined;
}
