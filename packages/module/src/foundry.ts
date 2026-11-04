// The parts of Foundry's client API this module uses, typed narrowly.

export interface FoundryModule {
  readonly id: string;
  readonly title: string;
  readonly active: boolean;
  readonly version: string | null;
  readonly relationships: {
    readonly requires: Iterable<{ readonly id: string; readonly type: string }>;
  };
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
  };
  readonly i18n: { localize(key: string): string };
}

interface DialogV2 {
  confirm(options: {
    window: { title: string };
    content: string;
    rejectClose: boolean;
    modal: boolean;
  }): Promise<boolean | null>;
}

interface FoundryGlobals {
  readonly game: FoundryGame;
  readonly CONST: { readonly USER_ROLES: { readonly GAMEMASTER: number } };
  readonly Hooks: { once(name: string, fn: () => void): number };
  readonly foundry: {
    readonly applications: { readonly api: { readonly DialogV2: DialogV2 } };
    readonly utils: { debouncedReload(): void };
  };
}

export const foundryGlobals = (): FoundryGlobals =>
  globalThis as unknown as FoundryGlobals;

export const MODULE_ID = "module-library";
