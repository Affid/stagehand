// UI actions: each one asks the background, then updates the store.
// The background validates and decides; the UI never writes storage.
import type { LibraryOp, OpResult } from "@module-library/shared/library/ops";
import type { Library } from "@module-library/shared/library/schema";
import type { ApplyMode } from "@module-library/shared/resolver";
import type { ExtensionMessage, SetupState } from "../messages.ts";
import type { Translate } from "./i18n.ts";
import type { Store } from "./store.ts";

export type Send = <T>(message: ExtensionMessage) => Promise<T>;

export interface Actions {
  op(op: LibraryOp): Promise<boolean>;
  refresh(): Promise<void>;
  queueApply(
    worldId: string,
    mode: ApplyMode,
    presetIds: readonly string[],
  ): Promise<boolean>;
  cancelCommand(id: string): Promise<void>;
  exportLibrary(): Promise<string | undefined>;
  importLibrary(text: string): Promise<void>;
}

const message = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

export function createActions(store: Store, send: Send, t: Translate): Actions {
  const fail = (error: unknown): void => {
    store.set({
      notice: {
        kind: "error",
        text: t("notice.failed", { error: message(error) }),
      },
    });
  };
  const setLibrary = (library: Library): void => {
    store.set((s) => ({ data: { ...s.data, library } }));
  };
  const refresh = async (): Promise<void> => {
    const data = await send<SetupState>({ kind: "get-state" });
    store.set({ data });
  };
  const guarded = async <T>(fn: () => Promise<T>): Promise<T | undefined> => {
    try {
      return await fn();
    } catch (error: unknown) {
      fail(error);
      return undefined;
    }
  };
  return {
    refresh: () => guarded(refresh).then(() => undefined),
    async op(op) {
      const result = await guarded(() =>
        send<OpResult>({ kind: "library-op", op }),
      );
      if (!result) return false;
      if (result.ok) {
        setLibrary(result.library);
        return true;
      }
      if ("conflict" in result) {
        // D-2: never overwrite; load the latest and let the admin redo it.
        await guarded(refresh);
        store.set({ notice: { kind: "info", text: t("notice.conflict") } });
      } else fail(new Error(result.error));
      return false;
    },
    async queueApply(worldId, mode, presetIds) {
      const queued = await guarded(() =>
        send({ kind: "queue-apply", worldId, mode, presetIds: [...presetIds] }),
      );
      if (queued) await guarded(refresh);
      return queued !== undefined;
    },
    async cancelCommand(id) {
      await guarded(() => send({ kind: "cancel-command", id }));
      await guarded(refresh);
    },
    async exportLibrary() {
      const r = await guarded(() =>
        send<{ text: string }>({ kind: "library-export" }),
      );
      return r?.text;
    },
    async importLibrary(text) {
      type Imported =
        { ok: true; library: Library } | { ok: false; error: string };
      const r = await guarded(() =>
        send<Imported>({ kind: "library-import", text }),
      );
      if (!r) return;
      if (!r.ok) {
        store.set({
          notice: {
            kind: "error",
            text: t("notice.importFailed", { error: r.error }),
          },
        });
        return;
      }
      setLibrary(r.library);
      store.set({ notice: { kind: "info", text: t("notice.imported") } });
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

export const nextColor = (used: number): string =>
  PALETTE[used % PALETTE.length] ?? "#7d7d7d";
