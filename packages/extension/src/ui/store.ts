// A small store for the Setup UI. State survives Setup re-renders, which
// remount the components.
import type { ModuleFilterSpec } from "@module-library/shared/library/schema";
import { useEffect, useState } from "preact/hooks";
import type { SetupState } from "../messages.ts";
import type { Adapter } from "../adapters/config.ts";
import type { AdapterChoice } from "../adapters/select.ts";
import type { Scope } from "./model/modules.ts";
import type { Route } from "./shell/route.ts";

export interface UiState {
  readonly data: SetupState;
  readonly adapter: AdapterChoice;
  /** Setup selectors in use (safe mode borrows the newest known ones). */
  readonly selectors: Adapter["selectors"];
  readonly scope: Scope;
  readonly filter: ModuleFilterSpec;
  readonly selection: readonly string[];
  /** Preset being edited: an id, "new", or null. */
  readonly editingPreset: string | null;
  /** Modules a new preset starts with. */
  readonly draftModules: readonly string[];
  /** Collapsed groups that have no folder record to keep it, as "unfiled". */
  readonly collapsedGroups: readonly string[];
  /** The new Setup page's current page; null until one is chosen. */
  readonly route: Route | null;
}

export const EMPTY_FILTER: ModuleFilterSpec = {
  text: "",
  tags: [],
  tagOp: "and",
  authors: [],
};

export interface Store {
  get(): UiState;
  set(change: Partial<UiState> | ((s: UiState) => Partial<UiState>)): void;
  subscribe(fn: () => void): () => void;
}

export function createStore(initial: UiState): Store {
  let state = initial;
  const listeners = new Set<() => void>();
  return {
    get: () => state,
    set(change) {
      const patch = typeof change === "function" ? change(state) : change;
      state = { ...state, ...patch };
      listeners.forEach((fn) => {
        fn();
      });
    },
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}

export function useStore(store: Store): UiState {
  const [state, setState] = useState(store.get());
  useEffect(
    () =>
      store.subscribe(() => {
        setState(store.get());
      }),
    [store],
  );
  return state;
}
