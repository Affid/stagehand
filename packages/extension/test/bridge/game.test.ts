// @vitest-environment happy-dom
import { makeEnvelope } from "@module-library/shared/protocol";
import { afterEach, describe, expect, test, vi } from "vitest";
import { startGameBridge } from "../../src/bridge/game.ts";
import type { ExtensionMessage } from "../../src/messages.ts";
import type { Send } from "../../src/ui/actions.ts";

const stops: (() => void)[] = [];
afterEach(() => {
  stops.splice(0).forEach((stop) => {
    stop();
  });
  vi.restoreAllMocks();
});

const fromModule = (type: string, payload: unknown): void => {
  window.dispatchEvent(
    new MessageEvent("message", {
      data: makeEnvelope("module", type, payload),
      origin: window.location.origin,
      source: window,
    }),
  );
};

function start(
  enabled: boolean,
  watch?: (msg: unknown, reply: unknown) => void,
) {
  const send = vi.fn((m: ExtensionMessage) =>
    Promise.resolve(
      m.kind === "bridge-init"
        ? { enabled, extensionVersion: "0.2.0" }
        : makeEnvelope("bridge", "ACK", { got: m.kind }),
    ),
  );
  const posted = vi.spyOn(window, "postMessage");
  stops.push(
    startGameBridge({
      send: send as unknown as Send,
      win: window,
      ...(watch ? { watch } : {}),
    }),
  );
  const kinds = (): string[] => send.mock.calls.map((c) => c[0].kind);
  const types = (): string[] =>
    posted.mock.calls.map((c) => (c[0] as { type: string }).type);
  return { send, kinds, types };
}

describe("the game page's bridge between the companion and the background", () => {
  test("says it is ready once the background allows it", async () => {
    const s = start(true);
    await vi.waitFor(() => {
      expect(s.types()).toEqual(["BRIDGE_READY"]);
    });
  });

  test("relays the companion's messages and posts the answers", async () => {
    const s = start(true);
    fromModule("HELLO", { worldId: "w1" });
    fromModule("COMMANDS_PULL", { worldId: "w1" });
    await vi.waitFor(() => {
      expect(s.kinds()).toEqual(["bridge-init", "relay", "relay"]);
    });
    await vi.waitFor(() => {
      expect(s.types().filter((t) => t === "ACK")).toHaveLength(2);
    });
  });

  test("the app watches each message with its reply (phase 7)", async () => {
    const seen: [string, string][] = [];
    start(true, (msg, reply) => {
      seen.push([
        (msg as { type: string }).type,
        (reply as { type: string }).type,
      ]);
    });
    fromModule("HELLO", { worldId: "w1" });
    await vi.waitFor(() => {
      expect(seen).toEqual([["HELLO", "ACK"]]);
    });
  });

  test("drops messages about another world than the HELLO's", async () => {
    const s = start(true);
    fromModule("HELLO", { worldId: "w1" });
    fromModule("COMMANDS_PULL", { worldId: "other" });
    fromModule("HELLO", { worldId: "other" });
    await vi.waitFor(() => {
      expect(s.kinds()).toEqual(["bridge-init", "relay"]);
    });
  });

  test("stays quiet when the background keeps it off", async () => {
    const s = start(false);
    fromModule("HELLO", { worldId: "w1" });
    await new Promise((resolve) => {
      setTimeout(resolve, 10);
    });
    expect(s.kinds()).toEqual(["bridge-init"]);
    expect(s.types()).toEqual([]);
  });

  test("a background that can't be reached is logged, nothing posted", async () => {
    const send = vi.fn(() => Promise.reject(new Error("No reply")));
    const posted = vi.spyOn(window, "postMessage");
    const logged = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    stops.push(startGameBridge({ send: send, win: window }));
    fromModule("HELLO", { worldId: "w1" });
    await vi.waitFor(() => {
      expect(logged).toHaveBeenCalledTimes(2);
    });
    expect(posted).not.toHaveBeenCalled();
  });
});
