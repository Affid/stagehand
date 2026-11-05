// The parts of Foundry's client API this module uses, typed narrowly, and
// the one place that reads Foundry's globals.

export const MODULE_ID = "module-library";

export interface FoundryModule {
  readonly id: string;
  readonly title: string;
  readonly active: boolean;
  readonly version: string | null;
}

export interface FoundryGame {
  readonly user: { readonly role: number } | null;
  readonly world: { readonly id: string; readonly title: string };
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
  };
  readonly ui: {
    readonly notifications: {
      info(message: string): void;
      warn(message: string): void;
    };
  };
  readonly foundry: {
    readonly applications: { readonly api: { readonly DialogV2: DialogV2 } };
    readonly utils: { debouncedReload(): void };
  };
}

export const foundryGlobals = (): FoundryGlobals =>
  globalThis as unknown as FoundryGlobals;
