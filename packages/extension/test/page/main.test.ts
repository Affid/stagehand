// @vitest-environment happy-dom
import { afterEach, describe, expect, test, vi } from "vitest";
import {
  type ChannelListener,
  localChannelPair,
} from "../../src/page-channel.ts";
import type { PageGlobals } from "../../src/page/globals.ts";
import { startSetupMain } from "../../src/page/main.ts";

afterEach(() => {
  vi.useRealTimers();
  document.body.replaceChildren();
});

const empty = { values: () => [].values() };

function foundry(isAdmin: boolean) {
  const hooks: Record<string, () => void> = {};
  const notifications = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
  const page = {
    game: {
      view: "setup",
      release: { generation: 14, build: 370 },
      data: { isAdmin },
      modules: empty,
      worlds: empty,
      systems: empty,
    },
    ui: { setupPackages: {}, notifications },
    Hooks: {
      on(name: string, fn: () => void) {
        hooks[name] = fn;
        return 1;
      },
    },
    foundry: { utils: { escapeHTML: (s: string) => s.replace(/</g, "&lt;") } },
  } satisfies PageGlobals;
  return { page, hooks, notifications };
}

/** setup-main on one end of a private channel; the test is the UI. */
function start(page: PageGlobals) {
  const [main, ui] = localChannelPair();
  const heard: [string, unknown][] = [];
  const listener: ChannelListener = (type, payload) =>
    heard.push([type, payload]);
  ui.listen(listener);
  startSetupMain({ channel: main, page, doc: document });
  return { ui, heard };
}

const types = (heard: [string, unknown][]): string[] => heard.map((h) => h[0]);

describe("setup-main: Foundry's half of the Setup page", () => {
  test("waits for Foundry's Setup, then sends its data, again on each render", async () => {
    vi.useFakeTimers();
    const f = foundry(true);
    const later: PageGlobals = { ...f.page };
    Reflect.deleteProperty(later, "game");
    const s = start(later);
    await vi.advanceTimersByTimeAsync(250);
    expect(s.heard).toEqual([]);
    Object.assign(later, { game: f.page.game });
    await vi.advanceTimersByTimeAsync(150);
    expect(types(s.heard)).toEqual(["SETUP_DATA"]);
    expect(s.heard[0]?.[1]).toMatchObject({ isAdmin: true });
    f.hooks.renderSetupPackages?.();
    await vi.advanceTimersByTimeAsync(1);
    expect(types(s.heard)).toEqual(["SETUP_DATA", "SETUP_DATA"]);
  });

  test("gives up when Setup never comes", async () => {
    vi.useFakeTimers();
    const s = start({});
    await vi.advanceTimersByTimeAsync(60_000);
    expect(s.heard).toEqual([]);
    expect(vi.getTimerCount()).toBe(0);
  });

  test("answers SHELL with the shell's state", async () => {
    vi.useFakeTimers();
    const s = start(foundry(true).page);
    await vi.advanceTimersByTimeAsync(1);
    s.ui.send("SHELL", { on: true });
    await vi.advanceTimersByTimeAsync(1);
    // No #setup on this bare page: the shell refuses and says why.
    expect(s.heard.at(-1)).toEqual([
      "SHELL_STATE",
      { on: false, error: expect.any(String) as unknown },
    ]);
  });

  test("COMPACT takes Foundry's window-size notice away until it is off", async () => {
    vi.useFakeTimers();
    const f = foundry(true);
    const remove = vi.fn();
    const page = {
      ...f.page,
      game: {
        ...f.page.game,
        issues: {
          usabilityIssues: { resolutionTooLow: { message: "K", params: {} } },
        },
        i18n: { format: () => "Too small" },
      },
      ui: { ...f.page.ui, notifications: { ...f.notifications, remove } },
    } satisfies PageGlobals;
    const ol = document.createElement("ol");
    ol.id = "notifications";
    document.body.append(ol);
    const notice = (id: number): void => {
      const li = document.createElement("li");
      li.className = "notification error permanent";
      li.dataset.id = String(id);
      li.textContent = "Too small";
      ol.append(li);
    };
    notice(2);
    const s = start(page);
    await vi.advanceTimersByTimeAsync(1);
    s.ui.send("COMPACT", { on: true });
    s.ui.send("COMPACT", { on: true });
    await vi.advanceTimersByTimeAsync(1);
    expect(remove.mock.calls).toEqual([[2]]);
    s.ui.send("COMPACT", { on: false });
    await vi.advanceTimersByTimeAsync(1);
    notice(3);
    await vi.advanceTimersByTimeAsync(1);
    expect(remove.mock.calls).toEqual([[2]]);
  });

  test("shows the UI's notices through Foundry's, escaped", async () => {
    vi.useFakeTimers();
    const f = foundry(true);
    const s = start(f.page);
    await vi.advanceTimersByTimeAsync(1);
    s.ui.send("NOTIFY", { kind: "warning", text: "<b>Careful</b>" });
    await vi.advanceTimersByTimeAsync(1);
    expect(f.notifications.warn).toHaveBeenCalledWith("&lt;b>Careful&lt;/b>", {
      console: false,
    });
  });

  test("refuses writes unless Setup is the administrator's", async () => {
    vi.useFakeTimers();
    const f = foundry(false);
    const s = start(f.page);
    await vi.advanceTimersByTimeAsync(1);
    s.ui.send("FOUNDRY_ACTION", { action: "shutdown" });
    await vi.advanceTimersByTimeAsync(1);
    expect(f.notifications.error).toHaveBeenCalledWith(
      expect.stringContaining("only the administrator"),
      { console: false },
    );
  });

  test("a launch that fails on our side tells the launching screen why (review)", async () => {
    vi.useFakeTimers();
    const f = foundry(true);
    const s = start(f.page);
    await vi.advanceTimersByTimeAsync(1);
    // No world tile on this page: Foundry's launch control is missing.
    s.ui.send("FOUNDRY_ACTION", { action: "launch", worldId: "strahd" });
    await vi.advanceTimersByTimeAsync(1);
    expect(s.heard).toContainEqual([
      "PROGRESS",
      expect.objectContaining({
        action: "launchWorld",
        id: "strahd",
        step: "error",
        error: expect.stringContaining("strahd") as unknown,
      }),
    ]);
  });

  test("ignores messages it doesn't know or that don't check out", async () => {
    vi.useFakeTimers();
    const f = foundry(true);
    const s = start(f.page);
    await vi.advanceTimersByTimeAsync(1);
    const before = s.heard.length;
    s.ui.send("SHELL", { on: "yes" });
    s.ui.send("RUN_SCRIPT", { code: "alert(1)" });
    await vi.advanceTimersByTimeAsync(1);
    expect(s.heard.length).toBe(before);
    expect(f.notifications.error).not.toHaveBeenCalled();
  });

  test("reads the library file for the administrator's Setup", async () => {
    vi.useFakeTimers();
    const fetch = vi.fn(() => Promise.resolve(new Response('{"x":1}')));
    vi.stubGlobal("fetch", fetch);
    const f = foundry(true);
    const s = start(f.page);
    await vi.advanceTimersByTimeAsync(1);
    s.ui.send("LIBRARY_FILE", { requestId: "r1", op: "read" });
    await vi.advanceTimersByTimeAsync(1);
    expect(fetch).toHaveBeenCalledWith("/stagehand/library.json", {
      cache: "no-store",
      credentials: "same-origin",
    });
    expect(s.heard).toContainEqual([
      "LIBRARY_FILE_DONE",
      { requestId: "r1", text: '{"x":1}' },
    ]);
    vi.unstubAllGlobals();
  });

  test("passes on a failed write as an error", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(Response.json({ error: "No permission." }))),
    );
    const f = foundry(true);
    const s = start(f.page);
    await vi.advanceTimersByTimeAsync(1);
    s.ui.send("LIBRARY_FILE", { requestId: "r2", op: "write", text: "{}" });
    await vi.advanceTimersByTimeAsync(1);
    expect(s.heard).toContainEqual([
      "LIBRARY_FILE_DONE",
      { requestId: "r2", error: "No permission." },
    ]);
    vi.unstubAllGlobals();
  });

  test("keeps the library file away from a Setup that is not the administrator's", async () => {
    vi.useFakeTimers();
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const f = foundry(false);
    const s = start(f.page);
    await vi.advanceTimersByTimeAsync(1);
    s.ui.send("LIBRARY_FILE", { requestId: "r3", op: "read" });
    await vi.advanceTimersByTimeAsync(1);
    expect(fetch).not.toHaveBeenCalled();
    expect(f.notifications.error).toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  test("when Foundry stops at once (13), Foundry's notices clear and our page is told", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) =>
        url === "/quit"
          ? Promise.resolve(Response.json({ status: "failed" }))
          : Promise.reject(new TypeError("Failed to fetch")),
      ),
    );
    const f = foundry(true);
    const clear = vi.fn();
    const page = {
      ...f.page,
      game: { ...f.page.game, release: { generation: 13, build: 351 } },
      ui: { ...f.page.ui, notifications: { ...f.notifications, clear } },
    };
    const s = start(page);
    await vi.advanceTimersByTimeAsync(1);
    s.ui.send("FOUNDRY_ACTION", { action: "quit" });
    await vi.advanceTimersByTimeAsync(10);
    expect(clear).toHaveBeenCalledTimes(1);
    expect(s.heard).toContainEqual(["SERVER_STOPPED", {}]);
    // Nothing more is asked of Foundry, or shown through it.
    s.ui.send("NOTIFY", { kind: "error", text: "Foundry did not answer" });
    s.ui.send("LIBRARY_FILE", { requestId: "r9", op: "read" });
    await vi.advanceTimersByTimeAsync(10);
    expect(f.notifications.error).not.toHaveBeenCalled();
    expect(s.heard.map((h) => h[0])).not.toContain("LIBRARY_FILE_DONE");
    vi.unstubAllGlobals();
  });
});
