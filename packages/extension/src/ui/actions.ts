// UI actions: each one asks the background, then updates the store.
// The background validates and decides; the UI never writes storage.
import type { LibraryOp, OpResult } from "@module-library/shared/library/ops";
import type { Library } from "@module-library/shared/library/schema";
import type { ApplyMode } from "@module-library/shared/resolver";
import type { ExtensionMessage, SetupState } from "../messages.ts";
import type { Translate } from "./i18n.ts";
import { pendingFor } from "./model/preview.ts";
import { flipModule } from "./model/world-modules.ts";
import type { PageBridge } from "./page.ts";
import type { Store } from "./store.ts";

export type Send = <T>(message: ExtensionMessage) => Promise<T>;

/** The background's answer for Foundry's release pages, or what went wrong. */
export type ReleasesAnswer =
  | { readonly permitted: false }
  | { readonly permitted: true; readonly html: string }
  | { readonly error: string };

/** A conflict means the latest library was loaded and nothing was saved. */
export type OpOutcome = "ok" | "conflict" | "error";

export interface Actions {
  /** A Foundry notification (L-1 strings already filled in). */
  notify(kind: "error" | "info", text: string): void;
  op(op: LibraryOp): Promise<OpOutcome>;
  refresh(): Promise<void>;
  queueApply(
    worldId: string,
    mode: ApplyMode,
    presetIds: readonly string[],
    modules?: readonly string[],
  ): Promise<boolean>;
  cancelCommand(id: string): Promise<void>;
  /** A module's switch on the world page: undo its own change, or queue one. */
  flip(worldId: string, moduleId: string, on: boolean): Promise<void>;
  /** Cancels every change queued for the world. */
  discard(worldId: string): Promise<void>;
  /**
   * `hold`: "Launch without changes", the next launch gets none, once.
   * `reviewed`: Apply and launch, the modules on after it as reviewed.
   */
  setLaunchHold(
    worldId: string,
    hold: boolean,
    reviewed?: readonly string[],
  ): Promise<boolean>;
  exportLibrary(): Promise<string | undefined>;
  importLibrary(text: string): Promise<void>;
  /** Intake: these modules are sorted and no longer "new". */
  markSorted(ids: readonly string[]): Promise<void>;
  /** News: these articles were opened and are no longer "New". */
  newsSeen(urls: readonly string[]): Promise<void>;
  /** Foundry's public release list, or one release's page (Release history). */
  releases(version?: string): Promise<ReleasesAnswer>;
  /** Opens the options page, where reading foundryvtt.com can be allowed. */
  askFoundryvtt(): Promise<void>;
}

type Imported =
  | { readonly ok: true; readonly library: Library }
  | { readonly ok: false; readonly error: string };

const message = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

/** What every action shares: the store, the background and messages. */
function base(store: Store, send: Send, t: Translate, page: PageBridge) {
  const notify = (kind: "error" | "info", text: string): void => {
    page.notify(kind, text);
  };
  const fail = (error: unknown): void => {
    notify("error", t("notice.failed", { error: message(error) }));
  };
  const guarded = async <T>(fn: () => Promise<T>): Promise<T | undefined> => {
    try {
      return await fn();
    } catch (error: unknown) {
      fail(error);
      return undefined;
    }
  };
  const refresh = async (): Promise<void> => {
    await guarded(async () => {
      store.set({ data: await send<SetupState>({ kind: "get-state" }) });
    });
  };
  const setLibrary = (library: Library): void => {
    store.set((s) => ({ data: { ...s.data, library } }));
  };
  return { notify, fail, guarded, refresh, setLibrary };
}

type Base = ReturnType<typeof base>;

async function runOp(
  b: Base,
  send: Send,
  t: Translate,
  op: LibraryOp,
): Promise<OpOutcome> {
  const result = await b.guarded(() =>
    send<OpResult>({ kind: "library-op", op }),
  );
  if (!result) return "error";
  if (result.ok) {
    b.setLibrary(result.library);
    return "ok";
  }
  if ("conflict" in result) {
    // D-2: never overwrite; load the latest and let the admin redo it.
    await b.refresh();
    b.notify("info", t("notice.conflict"));
    return "conflict";
  }
  b.fail(new Error(result.error));
  return "error";
}

async function runImport(
  b: Base,
  send: Send,
  t: Translate,
  text: string,
): Promise<void> {
  const r = await b.guarded(() =>
    send<Imported>({ kind: "library-import", text }),
  );
  if (!r) return;
  if (!r.ok) {
    b.notify("error", t("notice.importFailed", { error: r.error }));
    return;
  }
  b.setLibrary(r.library);
  b.notify("info", t("notice.imported"));
}

async function runFlip(
  b: Base,
  send: Send,
  store: Store,
  f: { worldId: string; moduleId: string; on: boolean },
): Promise<void> {
  const plan = flipModule(store.get().data, f.worldId, f.moduleId, f.on);
  await b.guarded(async () => {
    for (const id of plan.cancel) await send({ kind: "cancel-command", id });
    if (plan.queue)
      await send({
        kind: "queue-apply",
        worldId: f.worldId,
        mode: plan.queue.mode,
        presetIds: [...plan.queue.presetIds],
        modules: [...(plan.queue.modules ?? [])],
      });
  });
  await b.refresh();
}

/** Flips on their way to the background, by world and module. */
const flipping = new Set<string>();

/**
 * A flip is planned from the stored state: a second one before the first
 * lands would repeat it (review). Ignore it until then.
 */
async function onceAtATime(
  key: string,
  run: () => Promise<void>,
): Promise<void> {
  if (flipping.has(key)) return;
  flipping.add(key);
  try {
    await run();
  } finally {
    flipping.delete(key);
  }
}

/** Changes queued for worlds, and how their next launch goes. */
async function sendLaunchHold(
  b: Base,
  send: Send,
  h: {
    worldId: string;
    hold: boolean;
    reviewed: readonly string[] | undefined;
  },
): Promise<boolean> {
  const done = await b.guarded(async () => {
    await send({
      kind: "launch-hold",
      worldId: h.worldId,
      hold: h.hold,
      ...(h.reviewed ? { reviewed: [...h.reviewed] } : {}),
    });
    return true;
  });
  return done === true;
}

function worldActions(
  b: Base,
  send: Send,
  store: Store,
): Pick<
  Actions,
  "queueApply" | "cancelCommand" | "flip" | "discard" | "setLaunchHold"
> {
  return {
    async queueApply(worldId, mode, presetIds, modules) {
      const queued = await b.guarded(() =>
        send({
          kind: "queue-apply",
          worldId,
          mode,
          presetIds: [...presetIds],
          ...(modules?.length ? { modules: [...modules] } : {}),
        }),
      );
      if (queued) await b.refresh();
      return queued !== undefined;
    },
    flip: (worldId, moduleId, on) =>
      onceAtATime(`${worldId}\u0000${moduleId}`, () =>
        runFlip(b, send, store, { worldId, moduleId, on }),
      ),
    async discard(worldId) {
      const ids = pendingFor(store.get().data, worldId).map((c) => c.id);
      await b.guarded(async () => {
        for (const id of ids) await send({ kind: "cancel-command", id });
      });
      await b.refresh();
    },
    setLaunchHold: (worldId, hold, reviewed) =>
      sendLaunchHold(b, send, { worldId, hold, reviewed }),
    async cancelCommand(id) {
      await b.guarded(() => send({ kind: "cancel-command", id }));
      await b.refresh();
    },
  };
}

export function createActions(
  store: Store,
  send: Send,
  t: Translate,
  page: PageBridge,
): Actions {
  const b = base(store, send, t, page);
  return {
    notify: b.notify,
    refresh: b.refresh,
    op: (op) => runOp(b, send, t, op),
    ...worldActions(b, send, store),
    async exportLibrary() {
      const r = await b.guarded(() =>
        send<{ text: string }>({ kind: "library-export" }),
      );
      return r?.text;
    },
    importLibrary: (text) => runImport(b, send, t, text),
    async markSorted(ids) {
      await b.guarded(() => send({ kind: "modules-sorted", ids: [...ids] }));
      await b.refresh();
    },
    async newsSeen(urls) {
      const next = await b.guarded(() =>
        send<SetupState>({ kind: "news-seen", urls: [...urls] }),
      );
      if (next)
        store.set((s) => ({
          data: { ...s.data, newsUnread: next.newsUnread },
        }));
    },
    // Errors come back as answers: the history says what went wrong itself.
    releases: (version) =>
      send<ReleasesAnswer>({
        kind: "foundry-releases",
        ...(version ? { version } : {}),
      }).catch((e: unknown) => ({
        error: e instanceof Error ? e.message : String(e),
      })),
    async askFoundryvtt() {
      await b.guarded(() => send({ kind: "ask-foundryvtt" }));
    },
  };
}

/** Random ids that also work outside secure contexts (LAN servers). */
export function newId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export const PALETTE = [
  "#c97b3c",
  "#3c8dc9",
  "#5aa469",
  "#a45aa4",
  "#c9b03c",
  "#c94c4c",
  "#4cc9b0",
  "#7d7d7d",
];

/** i18n keys (`color.*`) naming PALETTE's colours, in the same order. */
export const PALETTE_NAMES = [
  "amber",
  "blue",
  "green",
  "purple",
  "yellow",
  "red",
  "teal",
  "grey",
] as const;

export const nextColor = (used: number): string =>
  PALETTE[used % PALETTE.length] ?? "#7d7d7d";
