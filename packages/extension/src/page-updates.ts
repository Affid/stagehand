// Package updates Foundry would install, from its own package list
// (game.getPackages, as its installer uses): the page world posts UPDATES
// once per Setup load with the newer version of each installed module or
// system. Checked on receipt.
type Loose = Readonly<Record<string, unknown>>;

export interface Updates {
  /** Package id to the newer version. */
  readonly module: Readonly<Record<string, string>>;
  readonly system: Readonly<Record<string, string>>;
}

export const NO_UPDATES: Updates = { module: {}, system: {} };

const ID = /^[A-Za-z0-9_-]{1,200}$/;
const VERSION = /^[0-9A-Za-z][0-9A-Za-z.+_-]{0,39}$/;
const MAX = 5000;

function versions(v: unknown): Record<string, string> | undefined {
  if (typeof v !== "object" || v === null || Array.isArray(v)) return undefined;
  const entries = Object.entries(v as Loose);
  if (entries.length > MAX) return undefined;
  const ok = entries.every(
    ([k, x]) => ID.test(k) && typeof x === "string" && VERSION.test(x),
  );
  // A plain object without a prototype: ids like "constructor" are just ids.
  return ok
    ? Object.assign(
        Object.create(null) as Record<string, string>,
        Object.fromEntries(entries),
      )
    : undefined;
}

export function parseUpdates(p: Loose): Updates | undefined {
  const module = versions(p.module);
  const system = versions(p.system);
  return module && system ? { module, system } : undefined;
}
