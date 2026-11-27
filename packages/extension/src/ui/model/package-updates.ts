// The Updates tab's data from the store (updates plan): what is installed,
// the last check (saved per server) with results still coming in on top,
// and refused downloads, fed to the shared model. The marks on cards and the
// counts follow the check once one has run; until then Foundry's package
// list (page/updates.ts) gives them.
import type { PackageCheck } from "@stagehand/shared/updates/check";
import {
  type InstalledPackage,
  type Row,
  rowsOf,
  type UpdatesInput,
} from "@stagehand/shared/updates/model";
import type { UiState } from "../store.ts";
import { updateCount, updateFor } from "./updates.ts";

/** A check older than this is checked again when the tab opens. */
export const STALE_MS = 60 * 60 * 1000;

export function checksOf(
  state: Pick<UiState, "data" | "check">,
): Record<string, PackageCheck> {
  const saved = Object.fromEntries(
    state.data.updatesCheck.results.map((r) => [r.id, r]),
  );
  return { ...saved, ...state.check.live };
}

function installedOf(state: Pick<UiState, "data">): InstalledPackage[] {
  const setup = state.data.setup;
  const modules = (setup?.modules ?? []).map((m) => ({
    id: m.id,
    type: "module" as const,
    title: m.title,
    version: m.version,
    locked: m.locked,
    requires: m.requires,
    systems: m.systems,
  }));
  const systems = (setup?.systems ?? []).map((s) => ({
    id: s.id,
    type: "system" as const,
    title: s.title,
    version: s.version,
    locked: s.locked,
    requires: s.requires,
    systems: s.systems,
  }));
  return [...modules, ...systems];
}

export function updatesInput(
  state: Pick<UiState, "data" | "check">,
): UpdatesInput {
  return {
    installed: installedOf(state),
    checks: checksOf(state),
    refused: state.data.updatesCheck.refused,
  };
}

let memo: { key: readonly unknown[]; rows: Row[] } | undefined;

/** The tab's rows; worked out once per change of what they depend on. */
export function rowsFor(state: Pick<UiState, "data" | "check">): Row[] {
  const key = [state.data.setup, state.data.updatesCheck, state.check.live];
  if (memo?.key.every((k, i) => k === key[i])) return memo.rows;
  const rows = rowsOf(updatesInput(state));
  memo = { key, rows };
  return rows;
}

/** Whether a check of this server has ever run (or is giving results now). */
export const hasChecked = (state: Pick<UiState, "data" | "check">): boolean =>
  state.data.updatesCheck.checkedAt !== null ||
  state.data.updatesCheck.results.length > 0 ||
  Object.keys(state.check.live).length > 0;

const canAct = (r: Row): boolean =>
  r.section === "ready" || r.section === "attention";

/** The version a card's chip offers: the check's, else Foundry's list's. */
export function markFor(
  state: Pick<UiState, "data" | "check" | "updates">,
  kind: "module" | "system",
  pkg: {
    readonly id: string;
    readonly version: string;
    readonly locked?: boolean | undefined;
  },
): string | null {
  if (checksOf(state)[pkg.id]) {
    const row = rowsFor(state).find((r) => r.id === pkg.id);
    return row && canAct(row) ? (row.to ?? null) : null;
  }
  return updateFor(state.updates[kind], pkg);
}

/** Updates the owner can act on: the tab's count, the rail's, the phone's. */
export function updatesCount(
  state: Pick<UiState, "data" | "check" | "updates">,
): number {
  if (!hasChecked(state)) {
    const setup = state.data.setup;
    return updateCount(
      state.updates,
      setup?.modules ?? [],
      setup?.systems ?? [],
    );
  }
  return rowsFor(state).filter(canAct).length;
}

/** The last full check is missing or over an hour old. */
export const isStale = (state: Pick<UiState, "data">, now: number): boolean => {
  const at = state.data.updatesCheck.checkedAt;
  return at === null || now - at > STALE_MS;
};
