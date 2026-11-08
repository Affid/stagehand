import { afterEach, describe, expect, test, vi } from "vitest";
import { createNativeBridge, MAX_MESSAGE_CHARS } from "../../src/app/bridge.ts";
import { fakeNative } from "./fake-native.ts";

afterEach(() => {
  vi.useRealTimers();
});

describe("the native bridge: requests from the page to native", () => {
  test("sends a request and resolves native's result", async () => {
    const native = fakeNative();
    native.on("kv.get", (p) => ({ value: (p as { key: string }).key }));
    const bridge = createNativeBridge(native.port);
    expect(await bridge.request("kv.get", { key: "servers" })).toEqual({
      value: "servers",
    });
    expect(native.asked).toEqual([["kv.get", { key: "servers" }]]);
    expect(JSON.parse(native.sent[0]!)).toMatchObject({
      v: 1,
      id: expect.any(String) as unknown,
      type: "kv.get",
    });
  });

  test("rejects with native's error", async () => {
    const native = fakeNative();
    native.on("fetch", () => {
      throw new Error("Not an allowed address");
    });
    const bridge = createNativeBridge(native.port);
    await expect(
      bridge.request("fetch", { url: "x", purpose: "release" }),
    ).rejects.toThrow("Not an allowed address");
  });

  test("keeps concurrent requests apart by id", async () => {
    const native = fakeNative();
    native.on("echo", (p) => p);
    const bridge = createNativeBridge(native.port);
    const [a, b] = await Promise.all([
      bridge.request("echo", 1),
      bridge.request("echo", 2),
    ]);
    expect([a, b]).toEqual([1, 2]);
  });

  test("gives up after its timeout; a late answer is ignored", async () => {
    vi.useFakeTimers();
    const native = fakeNative();
    const bridge = createNativeBridge(native.port, { timeoutMs: 1000 });
    native.on("slow", () => new Promise(() => undefined));
    const asked = bridge.request("slow");
    const failed = expect(asked).rejects.toThrow(/did not answer/);
    await vi.advanceTimersByTimeAsync(1000);
    await failed;
  });

  test("waits as long as the user needs when told to", async () => {
    vi.useFakeTimers();
    const native = fakeNative();
    let answer: (v: unknown) => void = () => undefined;
    native.on("confirm", () => new Promise((resolve) => (answer = resolve)));
    const bridge = createNativeBridge(native.port, { timeoutMs: 1000 });
    const asked = bridge.request("confirm", { text: "?" }, { timeoutMs: null });
    await vi.advanceTimersByTimeAsync(60_000);
    answer({ yes: true });
    await vi.advanceTimersByTimeAsync(1);
    expect(await asked).toEqual({ yes: true });
  });

  test("refuses to send what is too large or can't be sent", async () => {
    const native = fakeNative();
    const bridge = createNativeBridge(native.port);
    await expect(
      bridge.request("kv.set", { value: "x".repeat(MAX_MESSAGE_CHARS) }),
    ).rejects.toThrow(/too large/);
    await expect(bridge.request("kv.set", { value: 1n })).rejects.toThrow();
    expect(native.sent).toEqual([]);
  });
});

describe("the native bridge: answers that don't check out (review)", () => {
  /** The id of the page's last request, as native would read it. */
  const lastId = (sent: string[]): string =>
    (JSON.parse(sent.at(-1)!) as { id: string }).id;

  test("an answer native got wrong ends the request it names", async () => {
    const native = fakeNative();
    const bridge = createNativeBridge(native.port);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const asked = bridge.request("confirm", {}, { timeoutMs: null });
    native.raw(JSON.stringify({ v: 1, re: lastId(native.sent), ok: "yes" }));
    await expect(asked).rejects.toThrow("didn't check out");
  });

  test("a long error from native is cut, not dropped", async () => {
    const native = fakeNative();
    const bridge = createNativeBridge(native.port);
    const asked = bridge.request("files.save", {}, { timeoutMs: null });
    native.raw(
      JSON.stringify({
        v: 1,
        re: lastId(native.sent),
        ok: false,
        error: "x".repeat(5000),
      }),
    );
    const error = await asked.then(
      () => undefined,
      (e: unknown) => e as Error,
    );
    expect(error?.message).toHaveLength(2000);
  });

  test("a result too large to send is answered with an error", async () => {
    const native = fakeNative();
    const bridge = createNativeBridge(native.port);
    bridge.handle("route", () => "x".repeat(MAX_MESSAGE_CHARS));
    await expect(native.request("route", {})).rejects.toThrow(/too large/);
  });
});

describe("the native bridge: requests from native to the page", () => {
  test("runs the handler and answers with its result", async () => {
    const native = fakeNative();
    const bridge = createNativeBridge(native.port);
    bridge.handle("route", (p) => ({ routed: p }));
    expect(await native.request("route", { a: 1 })).toEqual({
      routed: { a: 1 },
    });
  });

  test("answers a failing handler with its message", async () => {
    const native = fakeNative();
    const bridge = createNativeBridge(native.port);
    bridge.handle("route", () => Promise.reject(new Error("Unknown sender")));
    await expect(native.request("route", {})).rejects.toThrow("Unknown sender");
  });

  test("answers an unknown request with an error", async () => {
    const native = fakeNative();
    createNativeBridge(native.port);
    await expect(native.request("run", { code: "x" })).rejects.toThrow(
      "Unknown request run",
    );
  });

  test("drops what isn't a message of the wire format", async () => {
    const native = fakeNative();
    const bridge = createNativeBridge(native.port);
    const handler = vi.fn();
    bridge.handle("route", handler);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    native.raw("not json");
    native.raw({ v: 1, id: "1", type: "route" });
    native.raw(JSON.stringify({ v: 2, id: "1", type: "route" }));
    native.raw(JSON.stringify({ v: 1, re: "nobody", ok: true }));
    native.raw("x".repeat(MAX_MESSAGE_CHARS + 1));
    await new Promise((resolve) => {
      setTimeout(resolve, 5);
    });
    expect(handler).not.toHaveBeenCalled();
    expect(native.sent).toEqual([]);
  });
});
