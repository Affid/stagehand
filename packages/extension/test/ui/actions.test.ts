import { describe, expect, test, vi } from "vitest";
import { emptyLibrary } from "@module-library/shared/library/schema";
import { BUNDLED_CONFIG, V14_SELECTORS } from "../../src/adapters/config.ts";
import type { SetupState } from "../../src/messages.ts";
import {
  createActions,
  newId,
  nextColor,
  PALETTE,
  type Send,
} from "../../src/ui/actions.ts";
import {
  ago,
  createTranslator,
  pickLanguage,
  plural,
} from "../../src/ui/i18n.ts";
import { createStore, EMPTY_FILTER, type UiState } from "../../src/ui/store.ts";
import { fakePage } from "./harness.tsx";

const data: SetupState = {
  server: "s",
  adminVerified: true,
  library: emptyLibrary("s"),
  setup: undefined,
  snapshots: {},
  commands: [],
  hellos: {},
  config: BUNDLED_CONFIG,
  prefs: { newSetupPage: false },
  fresh: [],
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
  selectors: V14_SELECTORS,
  apply: null,
  sheetWorld: null,
  collapsedGroups: [],
  route: null,
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
  const { page } = fakePage();
  return { store, actions: createActions(store, send, t, page), send, page };
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
    const { store, actions, page } = setup((m) =>
      m.kind === "get-state"
        ? fresh
        : { ok: false, conflict: { entity: "tag", id: "t", current: {} } },
    );
    expect(await actions.op(tagOp)).toBe("conflict");
    expect(store.get().data.library.revision).toBe(9);
    expect(page.notify).toHaveBeenCalledWith("info", t("notice.conflict"));
  });

  test("errors from the background become a Foundry notification, never a throw", async () => {
    const store = createStore(initial);
    const send = vi.fn(() =>
      Promise.reject(new Error("Not admin-verified")),
    ) as unknown as Send;
    const { page } = fakePage();
    const actions = createActions(store, send, t, page);
    expect(await actions.op(tagOp)).toBe("error");
    expect(page.notify).toHaveBeenCalledWith(
      "error",
      expect.stringContaining("Not admin-verified"),
    );
  });

  test("a failed import says why", async () => {
    const { actions, page } = setup(() => ({
      ok: false,
      error: "The file is not valid JSON.",
    }));
    await actions.importLibrary("x");
    expect(page.notify).toHaveBeenCalledWith(
      "error",
      expect.stringContaining("not valid JSON"),
    );
  });

  test("queueing refreshes the state", async () => {
    const { actions, send } = setup((m) =>
      m.kind === "get-state" ? data : { queued: "c1" },
    );
    expect(await actions.queueApply("w", "add", ["p"])).toBe(true);
    expect(send).toHaveBeenLastCalledWith({ kind: "get-state" });
  });

  test("modules picked one by one go with the change", async () => {
    const { actions, send } = setup((m) =>
      m.kind === "get-state" ? data : { queued: "c1" },
    );
    await actions.queueApply("w", "remove", [], ["a"]);
    expect(send).toHaveBeenCalledWith({
      kind: "queue-apply",
      worldId: "w",
      mode: "remove",
      presetIds: [],
      modules: ["a"],
    });
  });

  test("a launch hold is sent, and a failure says so", async () => {
    const ok = setup(() => undefined);
    expect(await ok.actions.setLaunchHold("w", true)).toBe(true);
    expect(ok.send).toHaveBeenCalledWith({
      kind: "launch-hold",
      worldId: "w",
      hold: true,
    });
    const bad = setup(() => {
      throw new Error("no");
    });
    expect(await bad.actions.setLaunchHold("w", true)).toBe(false);
    expect(bad.page.notify).toHaveBeenCalled();
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

  test("plurals and ages read naturally", () => {
    expect(plural(t, "worlds.changes", 1)).toBe("1 change");
    expect(plural(t, "worlds.changes", 3)).toBe("3 changes");
    expect(ago(t, { n: 0, unit: "now" })).toBe("just now");
    expect(ago(t, { n: 1, unit: "hours" })).toBe("1 hour ago");
    expect(ago(t, { n: 12, unit: "days" })).toBe("12 days ago");
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
