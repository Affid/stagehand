// The parts of Foundry's client API this module uses, typed narrowly, and
// the one place that reads Foundry's globals.

export const MODULE_ID = "stagehand";

export interface FoundryModule {
  readonly id: string;
  readonly title: string;
  readonly active: boolean;
  readonly version: string | null;
}

/** The running world's own document: its flags and a local update. */
export interface FoundryWorld {
  readonly id: string;
  readonly title: string;
  readonly flags?: Readonly<Record<string, unknown>>;
  updateSource?(data: object): unknown;
}

export interface FoundryUser {
  readonly id: string;
  readonly role: number;
  readonly active: boolean;
}

export interface FoundryGame {
  readonly user: { readonly id: string; readonly role: number } | null;
  readonly users: Iterable<FoundryUser>;
  readonly world: FoundryWorld;
  readonly system: { readonly id: string; readonly version: string };
  readonly release: { readonly generation: number; readonly build: number };
  readonly modules: ReadonlyMap<string, FoundryModule>;
  readonly settings: {
    get(ns: string, key: string): unknown;
    set(ns: string, key: string, value: unknown): Promise<unknown>;
    register(ns: string, key: string, config: object): void;
  };
  readonly i18n: {
    localize(key: string): string;
    format(key: string, data: Record<string, string | number>): string;
  };
}

export interface DialogButton {
  readonly action: string;
  readonly label: string;
  readonly icon?: string;
  readonly default?: boolean;
  readonly callback?: (event: Event, button: HTMLButtonElement) => unknown;
}

export interface DialogV2 {
  wait(options: {
    readonly window: { readonly title: string };
    readonly content: string;
    readonly buttons: readonly DialogButton[];
    readonly rejectClose: boolean;
    readonly modal: boolean;
  }): Promise<unknown>;
}

export interface FoundryGlobals {
  readonly game: FoundryGame;
  readonly CONST: { readonly USER_ROLES: { readonly GAMEMASTER: number } };
  readonly Hooks: {
    once(name: string, fn: () => void): number;
    callAll(name: string, ...args: unknown[]): boolean;
  };
  readonly ui: {
    readonly notifications: {
      info(message: string): void;
      warn(message: string): void;
    };
  };
  readonly foundry: {
    readonly applications: { readonly api: { readonly DialogV2: DialogV2 } };
    readonly utils: {
      debouncedReload(): void;
      /** A path on this server, with Foundry's route prefix if it has one. */
      getRoute(path: string): string;
    };
  };
}

export const foundryGlobals = (): FoundryGlobals =>
  globalThis as unknown as FoundryGlobals;
