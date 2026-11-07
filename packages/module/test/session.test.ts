import { makeEnvelope } from "@module-library/shared/protocol";
import { afterEach, describe, expect, test, vi } from "vitest";
import type { ApplyDeps } from "../src/apply.ts";
import { ChannelTimeout, createChannel } from "../src/channel.ts";
import { HELLO_ATTEMPTS, handshake, runSession } from "../src/session.ts";
import { fakeChannel, fakeDialog, fakeGame, ok } from "./fakes.ts";

function deps(
  answer: Parameters<typeof fakeChannel>[0],
  dialogResult: unknown = "later",
) {
  const { game } = fakeGame([
    { id: "module-library", active: true },
    { id: "a" },
  ]);
  const { channel, requests } = fakeChannel(answer);
  const d: ApplyDeps = {
    game,
    dialog: fakeDialog(dialogResult).dialog,
    channel,
    reload: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    now: () => new Date("2026-11-05T00:00:00Z"),
  };
  return { d, requests };
}

describe("handshake (8.7)", () => {
  test("ok when the extension acknowledges", async () => {
    const { d, requests } = deps(() => ok("HELLO_ACK"));
    expect(await handshake(d)).toBe("ok");
    expect(requests[0]).toMatchObject({
      type: "HELLO",
      payload: { protocol: [1], worldId: "w1", coreVersion: "14.369" },
    });
  });

  test("rejected when there is no common protocol", async () => {
    const { d } = deps(() => ok("HELLO_REJECT"));
    expect(await handshake(d)).toBe("rejected");
  });

  test("none after retrying when no bridge answers (no extension)", async () => {
    const { d, requests } = deps(() => new ChannelTimeout("HELLO"));
    expect(await handshake(d)).toBe("none");
    expect(requests).toHaveLength(HELLO_ATTEMPTS);
  });
});

describe("runSession (8.4)", () => {
  const world = [
    {
      id: "c1",
      mode: "add",
      presets: [{ id: "p", name: "P" }],
      modules: ["a"],
    },
  ];

  test("handshake, snapshot, pull, then apply", async () => {
    const { d, requests } = deps(
      (type) =>
        type === "HELLO"
          ? ok("HELLO_ACK")
          : type === "COMMANDS_PULL"
            ? ok("COMMANDS", { world, global: [] })
            : ok(),
      "later",
    );
    expect(await runSession(d)).toEqual({ handshake: "ok", outcome: "later" });
    expect(requests.map((r) => r.type)).toEqual([
      "HELLO",
      "SNAPSHOT_PUSH",
      "COMMANDS_PULL",
    ]);
  });

  test("a launch reviewed on Setup applies without the dialog", async () => {
    const { d, requests } = deps((type) =>
      type === "HELLO"
        ? ok("HELLO_ACK")
        : type === "COMMANDS_PULL"
          ? ok("COMMANDS", {
              world,
              global: [],
              reviewed: ["module-library", "a"],
            })
          : type === "COMMAND_ACK"
            ? ok("OK", { accepted: true })
            : ok(),
    );
    expect(await runSession(d)).toEqual({
      handshake: "ok",
      outcome: "applied",
    });
    expect(d.reload).toHaveBeenCalledTimes(1);
    expect(requests.map((r) => r.type)).toContain("COMMAND_ACK");
  });

  test("stays idle without the extension", async () => {
    const { d, requests } = deps(() => new ChannelTimeout("HELLO"));
    expect(await runSession(d)).toEqual({ handshake: "none" });
    expect(requests.every((r) => r.type === "HELLO")).toBe(true);
  });

  test("ignores a malformed command list", async () => {
    const { d } = deps((type) =>
      type === "HELLO" ? ok("HELLO_ACK") : ok("COMMANDS", { world: "nope" }),
    );
    expect(await runSession(d)).toEqual({ handshake: "ok" });
  });
});

/** A window stand-in: messages are delivered only when the test says so. */
function fakeWindow() {
  const listeners: ((e: MessageEvent) => void)[] = [];
  const posted: unknown[] = [];
  const win = {
    location: { origin: "http://localhost:30000" },
    addEventListener: (_type: string, fn: (e: MessageEvent) => void) =>
      listeners.push(fn),
    postMessage: (msg: unknown) => posted.push(msg),
  };
  const deliver = (
    data: unknown,
    source: unknown = win,
    origin = win.location.origin,
  ): void => {
    listeners.forEach((fn) => {
      fn({ data, source, origin } as MessageEvent);
    });
  };
  return { win: win as unknown as Window, posted, deliver };
}

describe("handshake errors (Android spike review)", () => {
  test("an error other than no answer stops at once and is not taken for 'no extension'", async () => {
    const { d, requests } = deps(
      () => new TypeError("crypto.randomUUID is not a function"),
    );
    await expect(handshake(d)).rejects.toThrow("crypto.randomUUID");
    expect(requests).toHaveLength(1);
  });
});

describe("channel (8.6)", () => {
  test("resolves a request with the bridge's answer to the same requestId", async () => {
    const { win, posted, deliver } = fakeWindow();
    const channel = createChannel(win);
    const pending = channel.request("HELLO", { a: 1 });
    const sent = posted[0] as { requestId: string; from: string };
    expect(sent.from).toBe("module");
    deliver(makeEnvelope("bridge", "HELLO_ACK", {}, "other-id"));
    deliver(makeEnvelope("module", "HELLO_ACK", {}, sent.requestId));
    deliver(
      makeEnvelope("bridge", "HELLO_ACK", {}, sent.requestId),
      {},
      win.location.origin,
    );
    deliver(
      makeEnvelope("bridge", "HELLO_ACK", {}, sent.requestId),
      win,
      "http://evil.example",
    );
    deliver(
      makeEnvelope("bridge", "HELLO_ACK", { real: true }, sent.requestId),
    );
    await expect(pending).resolves.toMatchObject({ payload: { real: true } });
  });

  test("times out when nobody answers", async () => {
    vi.useFakeTimers();
    const { win } = fakeWindow();
    const pending = createChannel(win).request("HELLO", {}, 50);
    vi.advanceTimersByTime(60);
    await expect(pending).rejects.toThrow("No answer to HELLO");
    await expect(pending).rejects.toBeInstanceOf(ChannelTimeout);
    vi.useRealTimers();
  });

  test("calls bridge-ready listeners", () => {
    const { win, deliver } = fakeWindow();
    const channel = createChannel(win);
    const ready = vi.fn();
    channel.onBridgeReady(ready);
    deliver(makeEnvelope("bridge", "BRIDGE_READY", {}));
    expect(ready).toHaveBeenCalledTimes(1);
  });
});

describe("channel on plain http (Android spike, finding 4)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("still asks and gets answered without crypto.randomUUID", async () => {
    const real = globalThis.crypto;
    vi.stubGlobal("crypto", {
      getRandomValues: (a: Uint8Array<ArrayBuffer>) => real.getRandomValues(a),
    });
    const { win, posted, deliver } = fakeWindow();
    const pending = createChannel(win).request("HELLO", {});
    const sent = posted[0] as { requestId: string } | undefined;
    expect(sent?.requestId).toMatch(/^[0-9a-f]{24}$/);
    deliver(makeEnvelope("bridge", "HELLO_ACK", {}, sent?.requestId));
    await expect(pending).resolves.toMatchObject({ type: "HELLO_ACK" });
  });
});
