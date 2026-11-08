// @vitest-environment happy-dom
import { makeEnvelope } from "@module-library/shared/protocol";
import { describe, expect, test, vi } from "vitest";
import { localChannelPair, windowChannel } from "../../src/page-channel.ts";

const flush = (): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, 0);
  });

describe("the window channel (the extension: two worlds, one page)", () => {
  test("posts an envelope from its own side to this page's origin", () => {
    const spy = vi.spyOn(window, "postMessage");
    windowChannel(window, "setup-ui", "setup-main").send("NOTIFY", { a: 1 });
    expect(spy).toHaveBeenCalledWith(
      makeEnvelope("setup-ui", "NOTIFY", { a: 1 }),
      window.location.origin,
    );
  });

  test("hears only the other side's envelopes from this window and origin", () => {
    const heard = vi.fn();
    const stop = windowChannel(window, "setup-ui", "setup-main").listen(heard);
    const post = (data: unknown, origin = window.location.origin): void => {
      window.dispatchEvent(
        new MessageEvent("message", { data, origin, source: window }),
      );
    };
    post(makeEnvelope("setup-main", "LOCK", { locked: true }));
    post(makeEnvelope("setup-ui", "NOTIFY", {}));
    post(makeEnvelope("module", "LOCK", {}));
    post(makeEnvelope("setup-main", "LOCK", {}), "https://elsewhere.example");
    post({ type: "LOCK" });
    expect(heard.mock.calls).toEqual([["LOCK", { locked: true }]]);
    stop();
    post(makeEnvelope("setup-main", "LOCK", { locked: false }));
    expect(heard).toHaveBeenCalledTimes(1);
  });
});

describe("the private channel (the app: one closure, no window messages)", () => {
  test("carries messages both ways, later, never to the sender itself", async () => {
    const [main, ui] = localChannelPair();
    const atMain = vi.fn();
    const atUi = vi.fn();
    main.listen(atMain);
    ui.listen(atUi);
    main.send("SETUP_DATA", { worlds: [] });
    ui.send("SHELL", { on: true });
    // Asynchronous, as window messages are: nothing arrives within the call.
    expect(atUi).not.toHaveBeenCalled();
    await flush();
    expect(atUi.mock.calls).toEqual([["SETUP_DATA", { worlds: [] }]]);
    expect(atMain.mock.calls).toEqual([["SHELL", { on: true }]]);
  });

  test("hands over a copy: the sender's object can't be changed through it", async () => {
    const [main, ui] = localChannelPair();
    const heard: unknown[] = [];
    ui.listen((_type, payload) => heard.push(payload));
    const payload = { worlds: [{ id: "w1" }] };
    main.send("SETUP_DATA", payload);
    payload.worlds[0]!.id = "changed";
    await flush();
    expect(heard).toEqual([{ worlds: [{ id: "w1" }] }]);
    expect(heard[0]).not.toBe(payload);
  });

  test("refuses what a window message couldn't carry", () => {
    const [main] = localChannelPair();
    expect(() => {
      main.send("NOTIFY", { run: () => undefined });
    }).toThrow();
  });

  test("page scripts can't reach it through window messages", async () => {
    const [, ui] = localChannelPair();
    const heard = vi.fn();
    ui.listen(heard);
    window.dispatchEvent(
      new MessageEvent("message", {
        data: makeEnvelope("setup-main", "SETUP_DATA", { isAdmin: true }),
        origin: window.location.origin,
        source: window,
      }),
    );
    window.postMessage(
      makeEnvelope("setup-main", "SETUP_DATA", { isAdmin: true }),
      "*",
    );
    await flush();
    expect(heard).not.toHaveBeenCalled();
  });

  test("a listener can stop listening; one throwing doesn't stop the others", async () => {
    const [main, ui] = localChannelPair();
    const kept = vi.fn();
    const stop = ui.listen(vi.fn());
    ui.listen(() => {
      throw new Error("broken listener");
    });
    ui.listen(kept);
    stop();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    main.send("LOCK", { locked: true });
    await flush();
    expect(kept).toHaveBeenCalledWith("LOCK", { locked: true });
  });
});
