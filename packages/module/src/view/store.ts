// One Module Management window's view state: the changes not saved yet, the
// filter, the open module, and the user's Group by and folded sections,
// which are kept for next time (Prefs). It lives as long as the window, so
// Foundry redrawing the window keeps the changes.
import type { Command } from "@stagehand/shared/world";
import { GROUP_BYS, type GroupBy } from "@stagehand/ui/model/library-groups.ts";
import type { Show } from "@stagehand/ui/world/ModulesTab.tsx";
import { useEffect, useState } from "preact/hooks";

export interface SavedPrefs {
  readonly by?: unknown;
  readonly folded?: unknown;
}

export interface Prefs {
  /** Untrusted: whatever was stored, if anything. */
  load(): SavedPrefs;
  save(prefs: {
    readonly by: GroupBy;
    readonly folded: readonly string[];
  }): void;
}

export interface ViewState {
  readonly changes: readonly Command[];
  readonly show: Show;
  readonly text: string;
  readonly by: GroupBy;
  readonly panel: string | null;
  readonly folded: ReadonlySet<string>;
}

export interface ViewStore {
  get(): ViewState;
  set(patch: Partial<ViewState>): void;
  toggleFold(key: string): void;
  subscribe(listener: () => void): () => void;
}

/** Far more sections than a library has. */
const MAX_FOLDED = 500;

const groupBy = (v: unknown): GroupBy =>
  GROUP_BYS.find((b) => b === v) ?? "folder";

/** A section's key: a folder, tag or author id with its prefix. */
const MAX_KEY = 250;

const folds = (v: unknown): ReadonlySet<string> =>
  new Set(
    Array.isArray(v)
      ? v
          .filter(
            (k): k is string => typeof k === "string" && k.length <= MAX_KEY,
          )
          .slice(0, MAX_FOLDED)
      : [],
  );

export function createViewStore(prefs: Prefs): ViewStore {
  const saved = prefs.load();
  let state: ViewState = {
    changes: [],
    show: "all",
    text: "",
    by: groupBy(saved.by),
    panel: null,
    folded: folds(saved.folded),
  };
  const listeners = new Set<() => void>();
  const set = (patch: Partial<ViewState>): void => {
    state = { ...state, ...patch };
    if ("by" in patch || "folded" in patch)
      prefs.save({ by: state.by, folded: [...state.folded] });
    for (const listener of listeners) listener();
  };
  return {
    get: () => state,
    set,
    toggleFold: (key) => {
      const next = new Set(state.folded);
      if (!next.delete(key)) next.add(key);
      set({ folded: next });
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

export function useViewState(store: ViewStore): ViewState {
  const [, setTick] = useState(0);
  useEffect(
    () =>
      store.subscribe(() => {
        setTick((n) => n + 1);
      }),
    [store],
  );
  return store.get();
}
