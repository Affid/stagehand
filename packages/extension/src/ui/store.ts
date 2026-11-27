// A small store for the Setup UI. State survives Setup re-renders, which
// remount the components.
import type { Launching } from "./launching.ts";
import type { SyncStatus } from "./library-sync.ts";
import type { ModuleFilterSpec } from "@stagehand/shared/library/schema";
import { useEffect, useState } from "preact/hooks";
import type { SetupState } from "../messages.ts";
import type { Lock, Progress } from "../page-progress.ts";
import type { Updates } from "../page-updates.ts";
import type { PackageCheck } from "@stagehand/shared/updates/check";
import type { ItemState } from "../page-package-install.ts";
import type { Adapter } from "../adapters/config.ts";
import type { AdapterChoice } from "../adapters/select.ts";
import type { WorldView } from "@stagehand/ui/context.ts";
import type { Scope } from "@stagehand/ui/model/modules.ts";
import type { PhoneNav } from "./shell/phone/nav.ts";
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
  /** Newer versions Foundry would install, by package id. */
  readonly updates: Updates;
  /** Our own check of the server's packages while it runs (package-check.ts). */
  readonly check: CheckView;
  /** Installing the ticked updates: the run, the last one, the ticks (package-install.ts). */
  readonly install: InstallView;
  /** The module panel opens on this tab once (the update chip opens Package). */
  readonly panelTab?: {
    readonly tab: "library" | "package";
    readonly n: number;
  };
  /** The phone and tablet layouts' place: home, and the trail Back retraces. */
  readonly phone: PhoneNav;
  /** The world whose Next launch sheet is open (phone and tablet layouts). */
  readonly nextLaunch: string | null;
  /** The world being launched, from the tap until Foundry leaves Setup. */
  readonly launching: Launching | null;
  /** Foundry stopped and sent the browser nowhere (Foundry 13's quit). */
  readonly serverStopped?: boolean;
  /** Library sync with the server; unset until it first runs (library-sync.ts). */
  readonly librarySync?: SyncStatus;
}

/** The Library's side panels; tags and presets remember the one chosen. */
export type SidePanel =
  | { readonly kind: "tags" | "presets"; readonly id?: string }
  | { readonly kind: "intake" }
  | { readonly kind: "system"; readonly id: string };

/** A check of the library while it runs: its id and how far it got. */
export interface CheckRun {
  readonly requestId: string;
  readonly done: number;
  readonly total: number;
  /** The package being checked now. */
  readonly current?: string;
}

export interface CheckView {
  readonly running: CheckRun | null;
  /** Packages checked on their own: request id to package id. */
  readonly one: Readonly<Record<string, string>>;
  /** Results that came in and aren't saved yet, by package id. */
  readonly live: Readonly<Record<string, PackageCheck>>;
  /** Checks of one package that found no answer, in a row (Try again). */
  readonly tries?: Readonly<Record<string, number>>;
}

export const NO_CHECK: CheckView = { running: null, one: {}, live: {} };

export type RunState = "queued" | ItemState;

export interface InstallRun {
  readonly requestId: string;
  /** The packages, in install order. */
  readonly ids: readonly string[];
  readonly backup: boolean;
  readonly states: Readonly<Record<string, RunState>>;
  /** From and to, as the run started, for the summary. */
  readonly versions: Readonly<Record<string, { from: string; to: string }>>;
  readonly errors: Readonly<
    Record<string, { error?: string; errorCode?: number }>
  >;
}

export interface InstallSummary {
  readonly ok: readonly {
    id: string;
    title: string;
    from: string;
    to: string;
    type: "module" | "system";
  }[];
  readonly failed: readonly {
    id: string;
    error?: string;
    errorCode?: number;
  }[];
  readonly backups: boolean;
}

export interface InstallView {
  readonly running: InstallRun | null;
  readonly last: InstallSummary | null;
  /** The ticked rows; null until the owner ticks: every Ready update. */
  readonly ticks: readonly string[] | null;
  /** Back up first: Foundry's own backup of each package before its install. */
  readonly backup: boolean;
  /** A run that may break something, waiting for the owner's answer. */
  readonly asking?: readonly string[] | undefined;
}

export const NO_INSTALL: InstallView = {
  running: null,
  last: null,
  ticks: null,
  backup: true,
};

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
