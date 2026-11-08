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
  /** Foundry's setup warnings (Support and issues). */
  readonly issueCount?: { readonly total?: unknown };
  readonly release?: { readonly generation: number; readonly build: number };
  readonly data?: {
    readonly isAdmin?: boolean;
    /** Foundry's News and Featured Content, from its update check. */
    readonly news?: unknown;
    readonly featuredContent?: unknown;
    /** Foundry's server options (the password only as a hash). */
    readonly options?: Readonly<Record<string, unknown>>;
    readonly languages?: readonly {
      readonly id: string;
      readonly label: string;
      readonly modules: readonly {
        readonly id: string;
        readonly label: string;
      }[];
    }[];
  };
  readonly i18n?: {
    readonly lang?: string;
    readonly localize?: (key: string) => string;
    readonly format?: (key: string, data: object) => string;
  };
  /** Foundry's usability checks (window size, browser version). */
  readonly issues?: {
    readonly usabilityIssues?: Readonly<Record<string, unknown>>;
  };
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

export interface PageGlobals {
  readonly game?: SetupGame;
  /** Foundry's constants: setup themes and update channels, as i18n keys. */
  readonly CONST?: {
    readonly CSS_THEMES?: Readonly<Record<string, string>>;
    readonly SOFTWARE_UPDATE_CHANNELS?: Readonly<Record<string, string>>;
  };
  readonly Hooks?: { on(name: string, fn: () => void): number };
  readonly ui?: {
    readonly setupPackages?: unknown;
    readonly notifications?: Partial<
      Record<
        "info" | "warn" | "error",
        (message: string, o?: object) => unknown
      >
    > & { readonly remove?: (id: number) => void };
  };
  readonly foundry?: {
    readonly applications?: {
      /** Foundry's open windows, by id. */
      readonly instances?: ReadonlyMap<string, OpenWindow>;
      /** Foundry's custom elements (prose-mirror and the rest). */
      readonly elements?: Readonly<Record<string, unknown>>;
    };
    readonly utils?: {
      readonly escapeHTML?: (text: string) => string;
      readonly isNewerVersion?: (v1: string, v0: string) => boolean;
      readonly getRoute?: (path: string) => string;
    };
  };
}

/** An open ApplicationV2 window, as far as we move it. */
export interface OpenWindow {
  readonly rendered?: boolean;
  readonly position?: { readonly width?: number | "auto" };
  setPosition(position: { left?: number; top?: number }): unknown;
}

export const pageGlobals = (): PageGlobals =>
  globalThis as unknown as PageGlobals;
