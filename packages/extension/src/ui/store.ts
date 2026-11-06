// A small store for the Setup UI. State survives Setup re-renders, which
// remount the components.
import type { ModuleFilterSpec } from "@module-library/shared/library/schema";
import { useEffect, useState } from "preact/hooks";
import type { SetupState } from "../messages.ts";
import type { Lock, Progress } from "../page-progress.ts";
import type { Adapter } from "../adapters/config.ts";
import type { AdapterChoice } from "../adapters/select.ts";
import type { GroupBy } from "./model/library-groups.ts";
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
  /** Collapsed groups that have no folder record to keep it, as "unfiled". */
  readonly collapsedGroups: readonly string[];
  /** The new Setup page's current page; null until one is chosen. */
  readonly route: Route | null;
  /** The module whose details show beside the Library or a world's page. */
  readonly panel: string | null;
  /** The Library's other panel in that column (Tags, Presets, New modules). */
  readonly side: SidePanel | null;
  /** A world page's View options: how its modules are grouped and laid out. */
  readonly worldView: WorldView;
  /** Foundry's running backups, restores and updates (tasks.ts). */
  readonly tasks: readonly Progress[];
  /** Foundry's busy lock: on while a backup or restore runs. */
  readonly lock: Lock;
}

/** The Library's side panels; tags and presets remember the one chosen. */
export type SidePanel =
  | { readonly kind: "tags" | "presets"; readonly id?: string }
  | { readonly kind: "intake" }
  | { readonly kind: "system"; readonly id: string };

export interface WorldView {
  readonly by: GroupBy;
  readonly layout: "cards" | "list";
}

export const DEFAULT_WORLD_VIEW: WorldView = { by: "folder", layout: "cards" };

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
