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
    bridge.setMenu({ details: "D" }, ".w");
    bridge.closeWindow("apply-1");
    expect(spy.mock.calls.map((c) => (c[0] as { type: string }).type)).toEqual([
      "NOTIFY",
      "MENU",
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
    bridge.foundryAction({ action: "backups" });
    expect(
      spy.mock.calls.map((c) => c[0] as { type: string; payload: unknown }),
    ).toMatchObject([
      { type: "SHELL", payload: { on: true } },
      {
        type: "FOUNDRY_ACTION",
        payload: { action: "launch", worldId: "strahd" },
      },
      { type: "FOUNDRY_ACTION", payload: { action: "backups" } },
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
