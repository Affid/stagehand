// Renders the Setup UI roots against a fake background for component tests.
import { render } from "@testing-library/preact";
import {
  emptyLibrary,
  type Library,
} from "@module-library/shared/library/schema";
import type { PackageInfo } from "@module-library/shared/package";
import { vi } from "vitest";
import { BUNDLED_CONFIG, V14_SELECTORS } from "../../src/adapters/config.ts";
import type { AdapterChoice } from "../../src/adapters/select.ts";
import type { ExtensionMessage, SetupState } from "../../src/messages.ts";
import { type PageToUi, windowHostId } from "../../src/page-protocol.ts";
import { createActions, type Send } from "../../src/ui/actions.ts";
import {
  ModulesRoot,
  OverlayRoot,
  ShellRoot,
  WorldsRoot,
} from "../../src/ui/App.tsx";
import { createTranslator } from "../../src/ui/i18n.ts";
import type { PageBridge } from "../../src/ui/page.ts";
import { createStore, EMPTY_FILTER, type UiState } from "../../src/ui/store.ts";

export const pkg = (
  id: string,
  over: Partial<PackageInfo> = {},
): PackageInfo => ({
  id,
  title: `Title ${id}`,
  version: "1.0.0",
  authors: [{ name: "Ann", url: "https://ann.example" }],
  library: false,
  hasPacks: false,
  hasCode: true,
  compatibility: { minimum: "13", verified: "14" },
  requires: [],
  recommends: [],
  conflicts: [],
  systems: [],
  ...over,
});

export const LIBRARY: Library = {
  ...emptyLibrary("s"),
  folders: [
    {
      id: "f1",
      name: "Combat",
      color: "#c94c4c",
      parentId: null,
      order: 0,
      collapsed: false,
      revision: 2,
    },
  ],
  tags: [{ id: "t1", name: "visual", color: "#3c8dc9", revision: 1 }],
  modules: { a: { folderId: "f1", tags: ["t1"], note: "for Strahd" } },
  presets: [
    {
      id: "p1",
      name: "QoL",
      description: "",
      modules: ["a", "c"],
      source: "user",
      revision: 3,
    },
  ],
};

export function setupState(over: Partial<SetupState> = {}): SetupState {
  return {
    server: "s",
    adminVerified: true,
    library: LIBRARY,
    setup: {
      core: { version: "14.369", generation: 14, build: 369 },
      isAdmin: true,
      lang: "en",
      modules: [
        pkg("a"),
        pkg("b", { compatibility: { minimum: "12", verified: "13" } }),
        pkg("c", { requires: [{ id: "lib", type: "module" }] }),
        pkg("lib", { library: true }),
        pkg("module-library"),
      ],
      systems: [],
      worlds: [
        {
          id: "w1",
          title: "Strahd",
          system: "dnd5e",
          systemVersion: "5",
          coreVersion: "14.369",
        },
      ],
      seenAt: "t",
    },
    snapshots: {},
    commands: [],
    hellos: {},
    config: BUNDLED_CONFIG,
    prefs: { newSetupPage: false },
    fresh: [],
    ...over,
  };
}

/**
 * A stand-in for the page world: opens "Foundry windows" as plain elements
 * (unless `windows` is false, as when Foundry can't), and records the rest.
 */
export function fakePage(windows = true) {
  const listeners = new Set<(e: PageToUi) => void>();
  const hosts = new Map<string, HTMLElement>();
  const emit = (e: PageToUi): void => {
    listeners.forEach((fn) => {
      fn(e);
    });
  };
  const page = {
    notify: vi.fn(),
    setMenu: vi.fn(),
    setShell: vi.fn(),
    foundryAction: vi.fn(),
    saveWorld: vi.fn(() => Promise.resolve<string | undefined>(undefined)),
    openWindow: vi.fn((spec: { id: string }) => {
      if (!windows) return;
      const frame = document.createElement("div");
      frame.className = "application ml-window";
      const host = document.createElement("div");
      host.id = windowHostId(spec.id);
      frame.append(host);
      document.body.append(frame);
      hosts.set(spec.id, host);
      queueMicrotask(() => {
        emit({ type: "WINDOW_READY", payload: { id: spec.id } });
      });
    }),
    closeWindow: vi.fn((id: string) => {
      hosts.get(id)?.parentElement?.remove();
      hosts.delete(id);
    }),
    windowHost: (id: string) => hosts.get(id) ?? null,
    subscribe(fn: (e: PageToUi) => void) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  } satisfies PageBridge;
  /** Closes the newest window as Foundry's close button would. */
  const closeTopWindow = (): void => {
    const id = [...hosts.keys()].at(-1);
    if (id) emit({ type: "WINDOW_CLOSED", payload: { id } });
  };
  return { page, emit, closeTopWindow };
}

const SUPPORTED: AdapterChoice = {
  status: "supported",
  adapter: BUNDLED_CONFIG.adapters[0]!,
};

/** A complete UI state for tests, from the sample Setup data. */
export const uiState = (over: Partial<UiState> = {}): UiState => ({
  data: setupState(),
  adapter: SUPPORTED,
  selectors: V14_SELECTORS,
  view: "organised",
  scope: { kind: "all" },
  filter: EMPTY_FILTER,
  selection: [],
  editingPreset: null,
  draftModules: [],
  apply: null,
  sheetWorld: null,
  collapsedGroups: [],
  route: null,
  ...over,
});

export function renderUi(
  root: "modules" | "worlds" | "overlay" | "shell",
  options: {
    state?: Partial<UiState>;
    data?: Partial<SetupState>;
    reply?: (m: ExtensionMessage) => unknown;
    windows?: boolean;
  } = {},
) {
  const data = setupState(options.data);
  const store = createStore(uiState({ data, ...options.state }));
  const reply =
    options.reply ??
    ((m: ExtensionMessage) =>
      m.kind === "get-state" ? data : { ok: true, library: data.library });
  const send = vi.fn((m: ExtensionMessage) => Promise.resolve(reply(m)));
  const t = createTranslator("en");
  const fake = fakePage(options.windows ?? true);
  const deps = {
    store,
    actions: createActions(store, send as unknown as Send, t, fake.page),
    t,
    page: fake.page,
  };
  const Root = {
    modules: ModulesRoot,
    worlds: WorldsRoot,
    overlay: OverlayRoot,
    shell: ShellRoot,
  }[root];
  const view = render(<Root deps={deps} />);
  return { ...view, store, send, ...fake };
}

/** The element matching `selector`, or a failing test. */
export function el(container: ParentNode, selector: string): HTMLElement {
  const found = container.querySelector<HTMLElement>(selector);
  if (!found) throw new Error(`No element for ${selector}`);
  return found;
}

/** The messages the UI sent to the background, in order. */
export const sent = (send: ReturnType<typeof vi.fn>): unknown[] =>
  send.mock.calls.map((c): unknown => c[0]);
