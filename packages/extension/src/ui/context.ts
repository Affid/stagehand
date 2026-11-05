// Shared access to the store, actions and translations for all components.
import { createContext } from "preact";
import { useContext } from "preact/hooks";
import { allowsChanges } from "../adapters/select.ts";
import type { Actions } from "./actions.ts";
import type { Translate } from "./i18n.ts";
import { type Store, type UiState, useStore } from "./store.ts";

export interface UiDeps {
  readonly store: Store;
  readonly actions: Actions;
  readonly t: Translate;
}

export const UiContext = createContext<UiDeps | null>(null);

export interface Ui extends UiDeps {
  readonly state: UiState;
  /** Admin-verified and on a supported version (PR-2, V-3). */
  readonly canChange: boolean;
}

export function useUi(): Ui {
  const deps = useContext(UiContext);
  if (!deps) throw new Error("Module Library UI used outside its provider");
  const state = useStore(deps.store);
  const canChange = state.data.adminVerified && allowsChanges(state.adapter);
  return { ...deps, state, canChange };
}
