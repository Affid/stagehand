// The Foundry version the live suites run against (Foundry 13 or 14,
// docs/FOUNDRY-13-PLAN.md), read once from the server's public status.
import { loadFoundryEnv } from "../../scripts/foundry/env.ts";

export interface Core {
  /** "14.370" */
  readonly version: string;
  readonly generation: number;
  readonly build: number;
}

async function readCore(): Promise<Core> {
  const res = await fetch(`${loadFoundryEnv().url}/api/status`);
  const { version } = (await res.json()) as { version?: string };
  const [generation = 0, build = 0] = (version ?? "").split(".").map(Number);
  return { version: version ?? "", generation, build };
}

export const CORE: Core = await readCore();

/** Foundry 13: the older generation the compat layer serves. */
export const ON_13 = CORE.generation === 13;
