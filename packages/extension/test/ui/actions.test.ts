import { describe, expect, test, vi } from "vitest";
import { emptyLibrary } from "@module-library/shared/library/schema";
import { BUNDLED_CONFIG } from "../../src/adapters/config.ts";
import type { SetupState } from "../../src/messages.ts";
import {
  createActions,
  newId,
  nextColor,
  PALETTE,
  type Send,
} from "../../src/ui/actions.ts";
import { createTranslator, pickLanguage } from "../../src/ui/i18n.ts";
import { createStore, EMPTY_FILTER, type UiState } from "../../src/ui/store.ts";

const data: SetupState = {
  server: "s",
  adminVerified: true,
  library: emptyLibrary("s"),
  setup: undefined,
  snapshots: {},
  commands: [],
  hellos: {},
  config: BUNDLED_CONFIG,
};

const initial: UiState = {
  data,
  adapter: { status: "safe-mode" },
  view: "organised",
  scope: { kind: "all" },
  filter: EMPTY_FILTER,
  selection: [],
  editingPreset: null,
  draftModules: [],
  applyWorld: null,
  notice: null,
};

const t = createTranslator("en");
const tagOp = {
  op: "tag.create",
  tag: { id: "t", name: "x", color: "#000000" },
} as const;

function setup(reply: (m: { kind: string }) => unknown) {
  const store = createStore(initial);
  const send = vi.fn((m: { kind: string }) =>
    Promise.resolve(reply(m)),
  ) as unknown as Send;
  return { store, actions: createActions(store, send, t), send };
}

describe("actions", () => {
  test("a successful op updates the library", async () => {
    const library = { ...emptyLibrary("s"), revision: 3 };
    const { store, actions } = setup(() => ({ ok: true, library }));
    expect(await actions.op(tagOp)).toBe("ok");
    expect(store.get().data.library.revision).toBe(3);
  });

  test("a revision conflict reloads the state and explains (D-2)", async () => {
    const fresh = { ...data, library: { ...emptyLibrary("s"), revision: 9 } };
    const { store, actions } = setup((m) =>
      m.kind === "get-state"
        ? fresh
        : { ok: false, conflict: { entity: "tag", id: "t", current: {} } },
    );
    expect(await actions.op(tagOp)).toBe("conflict");
    expect(store.get().data.library.revision).toBe(9);
    expect(store.get().notice).toEqual({
      kind: "info",
      text: t("notice.conflict"),
    });
  });

  test("errors from the background become a notice, never a throw", async () => {
    const store = createStore(initial);
    const send = vi.fn(() =>
      Promise.reject(new Error("Not admin-verified")),
    ) as unknown as Send;
    const actions = createActions(store, send, t);
    expect(await actions.op(tagOp)).toBe("error");
    expect(store.get().notice?.text).toContain("Not admin-verified");
  });

  test("a failed import says why", async () => {
    const { store, actions } = setup(() => ({
      ok: false,
      error: "The file is not valid JSON.",
    }));
    await actions.importLibrary("x");
    expect(store.get().notice?.text).toContain("not valid JSON");
  });

  test("queueing refreshes the state", async () => {
    const { actions, send } = setup((m) =>
      m.kind === "get-state" ? data : { queued: "c1" },
    );
    expect(await actions.queueApply("w", "add", ["p"])).toBe(true);
    expect(send).toHaveBeenLastCalledWith({ kind: "get-state" });
  });
});

describe("helpers", () => {
  test("ids are 24 hex characters and differ", () => {
    expect(newId()).toMatch(/^[0-9a-f]{24}$/);
    expect(newId()).not.toBe(newId());
  });

  test("colours cycle through the palette", () => {
    expect(nextColor(PALETTE.length)).toBe(PALETTE[0]);
  });

  test("language: server first, then browser, then English (L-2)", () => {
    expect(pickLanguage("en", "de-DE")).toBe("en");
    expect(pickLanguage("xx", "en-GB")).toBe("en");
    expect(pickLanguage("xx", "yy")).toBe("en");
  });

  test("translations fill parameters and fall back to the key", () => {
    expect(t("list.count", { n: 3 })).toBe("3 modules");
    expect(t("no.such.key")).toBe("no.such.key");
  });
});
