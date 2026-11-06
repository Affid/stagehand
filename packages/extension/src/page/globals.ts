// The Setup page's own globals, typed loosely: only what the page world uses.
// Everything is optional so a Foundry change degrades instead of throwing.

export interface Collection {
  values(): Iterable<unknown>;
  get?(id: string): unknown;
}

/** Foundry's client settings, as far as the new Setup page uses them. */
export interface ClientSettings {
  get(namespace: string, key: string): unknown;
  set(namespace: string, key: string, value: unknown): Promise<unknown>;
}

export interface SetupGame {
  readonly view?: string;
  readonly release?: { readonly generation: number; readonly build: number };
  readonly data?: { readonly isAdmin?: boolean };
  readonly i18n?: { readonly lang?: string };
  readonly modules?: Collection;
  readonly worlds?: Collection;
  readonly systems?: Collection;
  readonly settings?: ClientSettings;
  /** Foundry's own POST to the Setup route; resolves with the server's answer. */
  readonly post?: (data: object) => Promise<unknown>;
  /** Resolves once the backup is done: true if it was created. */
  readonly createBackup?: (
    pkg: unknown,
    options?: { readonly note?: string },
  ) => Promise<boolean>;
}

export interface MenuEntry {
  readonly label: string;
  readonly icon: string;
  readonly group?: string;
  readonly onClick: () => void;
}

export interface ContextMenuLike {
  menuItems: MenuEntry[];
  render: (
    this: ContextMenuLike,
    target: HTMLElement,
    options?: unknown,
  ) => Promise<unknown>;
}

export interface AppInstance {
  readonly element?: HTMLElement;
  render(options: { force: boolean }): Promise<unknown>;
  close(options?: unknown): Promise<unknown>;
  bringToFront?(): void;
}

export type AppClass = abstract new (options?: object) => AppInstance;

export interface PageGlobals {
  readonly game?: SetupGame;
  readonly Hooks?: { on(name: string, fn: () => void): number };
  readonly ui?: {
    readonly setupPackages?: unknown;
    readonly notifications?: Partial<
      Record<
        "info" | "warn" | "error",
        (message: string, o?: object) => unknown
      >
    >;
  };
  readonly foundry?: {
    readonly applications?: {
      readonly api?: { readonly ApplicationV2?: AppClass };
      readonly ux?: {
        readonly ContextMenu?: { readonly prototype: ContextMenuLike };
      };
      /** Foundry's World Configuration window (public class). */
      readonly sidebar?: {
        readonly apps?: {
          readonly WorldConfig?: new (options: { world: unknown }) => {
            render(options: { force: boolean }): unknown;
          };
        };
      };
    };
    readonly utils?: { readonly escapeHTML?: (text: string) => string };
  };
}

export const pageGlobals = (): PageGlobals =>
  globalThis as unknown as PageGlobals;
