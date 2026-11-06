// @vitest-environment happy-dom
import { makeEnvelope } from "@module-library/shared/protocol";
import { describe, expect, test, vi } from "vitest";
import { createPageBridge } from "../../src/ui/page.ts";

const fromPage = (type: string, payload: unknown): MessageEvent =>
  new MessageEvent("message", {
    data: makeEnvelope("setup-main", type, payload),
    origin: window.location.origin,
    source: window,
  });

describe("the UI's bridge to the page world", () => {
  test("posts checked messages to the page", () => {
    const spy = vi.spyOn(window, "postMessage");
    const bridge = createPageBridge(window);
    bridge.notify("info", "Queued");
    bridge.closeWindow("apply-1");
    expect(spy.mock.calls.map((c) => (c[0] as { type: string }).type)).toEqual([
      "NOTIFY",
      "WINDOW_CLOSE",
    ]);
    expect(spy.mock.calls[0]?.[0]).toMatchObject({
      from: "setup-ui",
      payload: { kind: "info", text: "Queued" },
    });
    spy.mockRestore();
  });

  test("asks for the new Setup page and for Foundry actions", () => {
    const spy = vi.spyOn(window, "postMessage");
    const bridge = createPageBridge(window);
    bridge.setShell(true);
    bridge.foundryAction({ action: "launch", worldId: "strahd" });
    bridge.foundryAction({ action: "logout" });
    expect(
      spy.mock.calls.map((c) => c[0] as { type: string; payload: unknown }),
    ).toMatchObject([
      { type: "SHELL", payload: { on: true } },
      {
        type: "FOUNDRY_ACTION",
        payload: { action: "launch", worldId: "strahd" },
      },
      { type: "FOUNDRY_ACTION", payload: { action: "logout" } },
    ]);
    spy.mockRestore();
  });

  test("passes on the shell's state", () => {
    const bridge = createPageBridge(window);
    const seen = vi.fn();
    bridge.subscribe(seen);
    window.dispatchEvent(
      fromPage("SHELL_STATE", { on: false, error: "missing #setup" }),
    );
    expect(seen).toHaveBeenCalledWith({
      type: "SHELL_STATE",
      payload: { on: false, error: "missing #setup" },
    });
  });

  test("passes on well-formed page events only", () => {
    const bridge = createPageBridge(window);
    const seen = vi.fn();
    const stop = bridge.subscribe(seen);
    window.dispatchEvent(fromPage("WINDOW_READY", { id: "apply-1" }));
    window.dispatchEvent(fromPage("WINDOW_READY", { id: "../x" }));
    window.dispatchEvent(
      new MessageEvent("message", {
        data: makeEnvelope("module", "WINDOW_READY", { id: "apply-1" }),
        origin: window.location.origin,
        source: window,
      }),
    );
    expect(seen).toHaveBeenCalledTimes(1);
    stop();
    window.dispatchEvent(fromPage("WINDOW_READY", { id: "apply-1" }));
    expect(seen).toHaveBeenCalledTimes(1);
  });

  test("renders only into a host inside a Foundry window", () => {
    const bridge = createPageBridge(window);
    document.body.innerHTML =
      '<div class="application ml-window"><div id="ml-host-a-1"></div></div><div id="ml-host-b-1"></div>';
    expect(bridge.windowHost("a-1")?.id).toBe("ml-host-a-1");
    expect(bridge.windowHost("b-1")).toBeNull();
    expect(bridge.windowHost("c-1")).toBeNull();
  });
});

describe("saving a world through the bridge", () => {
  test("asks with a request id and settles on the matching answer", async () => {
    const spy = vi.spyOn(window, "postMessage");
    const bridge = createPageBridge(window);
    const done = bridge.saveWorld("w", { title: "New" });
    const sentMsg = spy.mock.calls.at(-1)?.[0] as {
      type: string;
      payload: { requestId: string; worldId: string; changes: unknown };
    };
    expect(sentMsg).toMatchObject({
      type: "SAVE_WORLD",
      payload: { worldId: "w", changes: { title: "New" } },
    });
    window.dispatchEvent(
      fromPage("SAVE_DONE", { requestId: "someone-else", error: "no" }),
    );
    window.dispatchEvent(
      fromPage("SAVE_DONE", {
        requestId: sentMsg.payload.requestId,
        error: "title: may not be blank",
      }),
    );
    await expect(done).resolves.toBe("title: may not be blank");
    spy.mockRestore();
  });

  test("no answer in time is an error, not a wait forever", async () => {
    vi.useFakeTimers();
    const bridge = createPageBridge(window);
    const done = bridge.saveWorld("w", { nextSession: null });
    vi.advanceTimersByTime(30_000);
    await expect(done).resolves.toMatch(/answer/i);
    vi.useRealTimers();
  });
});

describe("a world's backups through the bridge", () => {
  test("asks, and settles on the matching answer with the list", async () => {
    const spy = vi.spyOn(window, "postMessage");
    const bridge = createPageBridge(window);
    const done = bridge.backups("w", "list", []);
    const msg = spy.mock.calls.at(-1)?.[0] as {
      type: string;
      payload: { requestId: string };
    };
    expect(msg).toMatchObject({
      type: "BACKUPS",
      payload: { worldId: "w", op: "list", ids: [] },
    });
    window.dispatchEvent(
      fromPage("BACKUPS_DONE", {
        requestId: msg.payload.requestId,
        backups: [{ id: "b", createdAt: 1, size: 2, snapshot: false }],
      }),
    );
    await expect(done).resolves.toEqual({
      backups: [{ id: "b", createdAt: 1, size: 2, snapshot: false }],
    });
    spy.mockRestore();
  });
});

describe("the server's backups through the bridge", () => {
  test("asks, and settles on the matching answer with the listing", async () => {
    const spy = vi.spyOn(window, "postMessage");
    const bridge = createPageBridge(window);
    const done = bridge.serverBackups("list", []);
    const msg = spy.mock.calls.at(-1)?.[0] as {
      type: string;
      payload: { requestId: string };
    };
    expect(msg).toMatchObject({
      type: "SERVER_BACKUPS",
      payload: { op: "list", ids: [] },
    });
    const listing = { snapshots: [], packages: [] };
    window.dispatchEvent(
      fromPage("SERVER_BACKUPS_DONE", {
        requestId: msg.payload.requestId,
        listing,
      }),
    );
    await expect(done).resolves.toEqual({ listing });
    spy.mockRestore();
  });
});

describe("configuration through the bridge", () => {
  test("asks, and settles on the matching answer", async () => {
    const spy = vi.spyOn(window, "postMessage");
    const bridge = createPageBridge(window);
    const done = bridge.config("save", { port: 30001 });
    const msg = spy.mock.calls.at(-1)?.[0] as {
      type: string;
      payload: { requestId: string };
    };
    expect(msg).toMatchObject({
      type: "CONFIG",
      payload: { op: "save", changes: { port: 30001 } },
    });
    window.dispatchEvent(
      fromPage("CONFIG_DONE", {
        requestId: msg.payload.requestId,
        error: "port: invalid",
      }),
    );
    await expect(done).resolves.toEqual({ error: "port: invalid" });
    spy.mockRestore();
  });
});
