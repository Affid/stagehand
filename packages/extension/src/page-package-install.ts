// Installing the ticked updates (docs/UPDATES-PLAN.md, phase 3): the UI asks
// with PACKAGE_INSTALL (packages in install order, and whether to back them
// up first); the page world runs Foundry's own backup and install for each
// and answers with PACKAGE_INSTALL events: each package's state, the end.
// The download's percentage comes as Foundry's installPackage progress.
// Checked both ways, by hand.
import type { PackageType } from "./page-package-check.ts";

type Loose = Readonly<Record<string, unknown>>;

export interface InstallRequest {
  readonly requestId: string;
  readonly items: readonly {
    readonly type: PackageType;
    readonly id: string;
  }[];
  readonly backup: boolean;
}

/** "backedUp": its backup made, waiting for its install. */
export const ITEM_STATES = [
  "backup",
  "backedUp",
  "installing",
  "done",
  "failed",
] as const;
export type ItemState = (typeof ITEM_STATES)[number];

export type InstallEvent =
  | {
      readonly requestId: string;
      readonly kind: "item";
      readonly id: string;
      readonly state: ItemState;
      readonly errorCode?: number;
      readonly error?: string;
    }
  | { readonly requestId: string; readonly kind: "done" };

const REQUEST_ID = /^[a-z0-9-]{1,64}$/i;
const ID = /^[A-Za-z0-9_-]{1,200}$/;
const MAX_ITEMS = 500;
const MAX_ERROR = 500;

const isObject = (v: unknown): v is Loose =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const isRequestId = (v: unknown): v is string =>
  typeof v === "string" && REQUEST_ID.test(v);

export function parseInstallRequest(p: Loose): InstallRequest | undefined {
  const { requestId, items, backup } = p;
  if (!isRequestId(requestId) || typeof backup !== "boolean") return undefined;
  if (!Array.isArray(items) || items.length === 0 || items.length > MAX_ITEMS)
    return undefined;
  const out: { type: PackageType; id: string }[] = [];
  for (const item of items as unknown[]) {
    if (!isObject(item)) return undefined;
    const { type, id } = item;
    if (
      (type !== "module" && type !== "system") ||
      typeof id !== "string" ||
      !ID.test(id)
    )
      return undefined;
    out.push({ type, id });
  }
  return { requestId, items: out, backup };
}

export function parseInstallEvent(p: Loose): InstallEvent | undefined {
  const { requestId, kind } = p;
  if (!isRequestId(requestId)) return undefined;
  if (kind === "done") return { requestId, kind };
  if (kind !== "item") return undefined;
  const { id, state, errorCode, error } = p;
  if (typeof id !== "string" || !ID.test(id)) return undefined;
  if (!(ITEM_STATES as readonly unknown[]).includes(state)) return undefined;
  if (
    errorCode !== undefined &&
    !(
      typeof errorCode === "number" &&
      Number.isInteger(errorCode) &&
      errorCode >= 100 &&
      errorCode <= 599
    )
  )
    return undefined;
  if (
    error !== undefined &&
    !(typeof error === "string" && error.length <= MAX_ERROR)
  )
    return undefined;
  return {
    requestId,
    kind,
    id,
    state: state as ItemState,
    ...(errorCode === undefined ? {} : { errorCode }),
    ...(error === undefined ? {} : { error }),
  };
}
