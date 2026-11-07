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
import { type PageToUi } from "../../src/page-protocol.ts";
import type { BackupInfo } from "../../src/page-backups.ts";
import { createActions, type Send } from "../../src/ui/actions.ts";
import { ShellRoot } from "../../src/ui/App.tsx";
import { createTranslator } from "../../src/ui/i18n.ts";
import { NO_UPDATES } from "../../src/page-updates.ts";
import { trackProgress, UNLOCKED } from "../../src/ui/tasks.ts";
import type {
  BackupsResult,
  ConfigResult,
  UpdateAsk,
  UpdateResult,
  PageBridge,
  ServerBackupsResult,
} from "../../src/ui/page.ts";
import {
  createStore,
  DEFAULT_WORLD_VIEW,
  EMPTY_FILTER,
  type UiState,
} from "../../src/ui/store.ts";

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
      systems: [
        {
          id: "dnd5e",
          title: "Dungeons & Dragons Fifth Edition",
          version: "5.1",
        },
      ],
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
    fresh: [],
    newsUnread: [],
    ...over,
  };
}

/** A stand-in for the page world: records what the UI asks for. */
export function fakePage() {
  const listeners = new Set<(e: PageToUi) => void>();
  const emit = (e: PageToUi): void => {
    listeners.forEach((fn) => {
      fn(e);
    });
  };
  const page = {
    notify: vi.fn(),
    setShell: vi.fn(),
    foundryAction: vi.fn(),
    checkUpdates: vi.fn(),
    saveWorld: vi.fn(() => Promise.resolve<string | undefined>(undefined)),
    editorOpen: vi.fn(),
    editorClose: vi.fn(),
    editorSave: vi.fn(() => Promise.resolve<string | undefined>(undefined)),
    config: vi.fn(() => Promise.resolve<ConfigResult>({})),
    update: vi.fn((_ask: UpdateAsk) =>
      Promise.resolve<UpdateResult>({ info: "SETUP.UpdateNotAvailable" }),
    ),
    serverBackups: vi.fn(() =>
      Promise.resolve<ServerBackupsResult>({
        listing: { snapshots: [], packages: [] },
      }),
    ),
    backups: vi.fn(() => Promise.resolve<BackupsResult>({ backups: [] })),
    subscribe(fn: (e: PageToUi) => void) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  } satisfies PageBridge;
  return { page, emit };
}

export const SUPPORTED: AdapterChoice = {
  status: "supported",
  adapter: BUNDLED_CONFIG.adapters[0]!,
};

/** A complete UI state for tests, from the sample Setup data. */
export const uiState = (over: Partial<UiState> = {}): UiState => ({
  data: setupState(),
  adapter: SUPPORTED,
  selectors: V14_SELECTORS,
  scope: { kind: "all" },
  filter: EMPTY_FILTER,
  selection: [],
  collapsedGroups: [],
  route: null,
  panel: null,
  side: null,
  worldView: DEFAULT_WORLD_VIEW,
  tasks: [],
  lock: UNLOCKED,
  updates: NO_UPDATES,
  ...over,
});

export function renderUi(
  _root: "shell",
  options: {
    state?: Partial<UiState>;
    data?: Partial<SetupState>;
    reply?: (m: ExtensionMessage) => unknown;
    /** Foundry's backups of every world, as the page world answers. */
    backups?: readonly BackupInfo[];
    /** Or Foundry's error, as the page world answers it. */
    backupsError?: string;
    /** Answers the page world gives, set before the first render. */
    answers?: (page: ReturnType<typeof fakePage>["page"]) => void;
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
  const fake = fakePage();
  if (options.backups)
    fake.page.backups.mockResolvedValue({ backups: [...options.backups] });
  if (options.backupsError)
    fake.page.backups.mockResolvedValue({ error: options.backupsError });
  options.answers?.(fake.page);
  trackProgress(store, fake.page);
  const deps = {
    store,
    actions: createActions(store, send as unknown as Send, t, fake.page),
    t,
    page: fake.page,
  };
  const view = render(<ShellRoot deps={deps} />);
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
