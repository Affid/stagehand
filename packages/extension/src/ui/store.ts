// A small store for the Setup UI. State survives Setup re-renders, which
// remount the components.
import type { ModuleFilterSpec } from "@module-library/shared/library/schema";
import { useEffect, useState } from "preact/hooks";
import type { SetupState } from "../messages.ts";
import type { AdapterChoice } from "../adapters/select.ts";
import type { Scope } from "./model/modules.ts";

export interface Notice {
  readonly kind: "error" | "info";
  readonly text: string;
}

export interface UiState {
  readonly data: SetupState;
  readonly adapter: AdapterChoice;
  readonly view: "organised" | "core";
  readonly scope: Scope;
  readonly filter: ModuleFilterSpec;
  readonly selection: readonly string[];
  /** Preset being edited: an id, "new", or null. */
  readonly editingPreset: string | null;
  /** Modules a new preset starts with. */
  readonly draftModules: readonly string[];
  readonly applyWorld: string | null;
  readonly notice: Notice | null;
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
