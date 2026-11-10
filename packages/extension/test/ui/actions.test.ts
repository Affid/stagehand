import { describe, expect, test, vi } from "vitest";
import { emptyLibrary } from "@stagehand/shared/library/schema";
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
import { START_NAV } from "../../src/ui/shell/phone/nav.ts";

const data: SetupState = {
  server: "s",
  adminVerified: true,
  library: emptyLibrary("s"),
  setup: undefined,
  snapshots: {},
  commands: [],
  config: BUNDLED_CONFIG,
  fresh: [],
  newsUnread: [],
};

const initial: UiState = {
  data,
  adapter: { status: "safe-mode" },
  scope: { kind: "all" },
  filter: EMPTY_FILTER,
  selection: [],
  selectors: V14_SELECTORS,
  collapsedGroups: [],
  route: null,
  phone: START_NAV,
  nextLaunch: null,
  panel: null,
  worldView: { by: "folder", layout: "cards" },
  tasks: [],
  updates: { module: {}, system: {} },
  side: null,
  lock: { locked: false },
  launching: null,
};

const t = createTranslator("en");
const QUEUED = {
  id: "c1",
  mode: "add" as const,
  presets: [],
  modules: ["a"],
  queuedAt: "2026-11-09T12:00:00.000Z",
};

const COMMAND = {
  id: "c1",
  scope: "world" as const,
  worldId: "w",
  type: "preset.apply" as const,
  payload: { mode: "add" as const, presetIds: [], modules: ["a"] },
  createdAt: "2026-11-09T12:00:00.000Z",
  baseSnapshotAt: null,
  status: "pending" as const,
};

const tagOp = {
  op: "tag.create",
  tag: { id: "t", name: "x", color: "#000000" },
} as const;

/** What the background answers when a test doesn't say. */
const defaults = (m: { kind: string }): unknown => {
  if (m.kind === "get-state") return initial.data;
  if (m.kind === "world-queue") return { queue: [] };
  return undefined;
};

function setup(reply: (m: { kind: string }) => unknown) {
  const store = createStore(initial);
  // get-state answers a state unless the test says otherwise, as the
  // background always does.
  const send = vi.fn((m: { kind: string }) =>
    Promise.resolve(reply(m) ?? defaults(m)),
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
    const { actions, send, page } = setup((m) =>
      m.kind === "get-state"
        ? data
        : m.kind === "world-queue"
          ? { queue: [QUEUED] }
          : { queued: "c1" },
    );
    expect(await actions.queueApply("w", "add", ["p"])).toBe(true);
    // Written into the world, marked, then the state reloaded.
    expect(page.saveQueue).toHaveBeenCalledWith("w", [QUEUED], undefined);
    expect(send).toHaveBeenCalledWith({
      kind: "queue-written",
      worldId: "w",
      ids: ["c1"],
      at: "2026-11-09T20:00:00.000Z",
    });
    expect(send).toHaveBeenLastCalledWith({ kind: "get-state" });
  });

  test("a change the world refused stays here, said, and isn't marked written", async () => {
    const { actions, send, page } = setup((m) =>
      m.kind === "world-queue" ? { queue: [QUEUED] } : undefined,
    );
    vi.mocked(page.saveQueue).mockResolvedValueOnce({
      error: "Foundry said no",
    });
    await actions.queueApply("w", "add", ["p"]);
    expect(page.notify).toHaveBeenCalledWith(
      "error",
      expect.stringContaining("Foundry said no"),
    );
    expect(send).not.toHaveBeenCalledWith(
      expect.objectContaining({ kind: "queue-written" }),
    );
  });

  test("cancelling writes that world's queue again", async () => {
    const { actions, store, page } = setup(() => undefined);
    store.set((st) => ({
      data: {
        ...st.data,
        commands: [{ ...COMMAND, id: "c7", worldId: "w9" }],
      },
    }));
    await actions.cancelCommand("c7");
    expect(page.saveQueue).toHaveBeenCalledWith("w9", [], undefined);
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

  test("a second flip of the same module while the first is saving is ignored", async () => {
    const ok = setup(() => undefined);
    await Promise.all([
      ok.actions.flip("w", "a", false),
      ok.actions.flip("w", "a", false),
    ]);
    const kinds = vi
      .mocked(ok.send)
      .mock.calls.map((c) => (c[0] as { kind: string }).kind);
    const changes = kinds.filter(
      (k) => k === "queue-apply" || k === "cancel-command",
    );
    expect(changes).toHaveLength(1);
  });

  test("two changes to one world write its queue one after the other", async () => {
    const order: string[] = [];
    let release: () => void = () => undefined;
    const { actions, page } = setup(() => undefined);
    vi.mocked(page.saveQueue)
      .mockImplementationOnce(
        () =>
          new Promise((r) => {
            order.push("first starts");
            release = () => {
              order.push("first ends");
              r({});
            };
          }),
      )
      .mockImplementationOnce(() => {
        order.push("second starts");
        return Promise.resolve({});
      });
    const a = actions.queueApply("w", "add", ["p"]);
    const b = actions.queueApply("w", "add", ["q"]);
    await vi.waitFor(() => {
      expect(order).toEqual(["first starts"]);
    });
    release();
    await Promise.all([a, b]);
    expect(order).toEqual(["first starts", "first ends", "second starts"]);
  });

  test("before a launch the queue and the intent go into the world", async () => {
    const ok = setup((m) =>
      m.kind === "world-queue" ? { queue: [QUEUED] } : undefined,
    );
    const held = await ok.actions.setLaunchHold("w", true);
    expect(held).toEqual({
      launchId: expect.any(String) as unknown,
      ids: ["c1"],
    });
    expect(ok.page.saveQueue).toHaveBeenCalledWith("w", [QUEUED], {
      kind: "hold",
      id: held?.launchId,
    });
    const reviewed = await ok.actions.setLaunchHold("w", false, ["a"]);
    expect(ok.page.saveQueue).toHaveBeenLastCalledWith("w", [QUEUED], {
      kind: "reviewed",
      id: reviewed?.launchId,
      target: ["a"],
    });
    expect(await ok.actions.setLaunchHold("w", false)).toEqual({
      launchId: null,
      ids: ["c1"],
    });
    expect(ok.page.saveQueue).toHaveBeenLastCalledWith("w", [QUEUED], null);
  });

  test("a launch whose intent couldn't be written says so, and doesn't go", async () => {
    const bad = setup(() => {
      throw new Error("no");
    });
    expect(await bad.actions.setLaunchHold("w", true)).toBeUndefined();
    expect(bad.page.notify).toHaveBeenCalled();
    const refused = setup(() => undefined);
    vi.mocked(refused.page.saveQueue).mockResolvedValueOnce({
      error: "Too large",
    });
    expect(await refused.actions.setLaunchHold("w", true)).toBeUndefined();
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
    expect(plural(t, "bk.count", 1)).toBe("1 backup");
    expect(plural(t, "bk.count", 3)).toBe("3 backups");
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
    expect(t("lr.presets", { names: "QoL" })).toContain("QoL");
    expect(t("no.such.key")).toBe("no.such.key");
  });
});
