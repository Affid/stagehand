// Watching the companion apply a launch's changes out of sight (Android plan,
// phase 7): what the game page's relay sees says done or failed.
import { makeEnvelope } from "@module-library/shared/protocol";
import { describe, expect, test } from "vitest";
import { watchStep } from "../../src/app/apply-watch.ts";

const fromModule = (type: string, payload: object) =>
  makeEnvelope("module", type, payload);
const fromBridge = (type: string, payload: object) =>
  makeEnvelope("bridge", type, payload);
const pull = fromModule("COMMANDS_PULL", { worldId: "w" });
const commands = (n: number) =>
  fromBridge("COMMANDS", { world: Array.from({ length: n }, () => ({})) });

describe("watchStep", () => {
  test("the changes acknowledged, then a pull with none left after the reload: done", () => {
    let s = watchStep({ acked: false }, pull, commands(2)).state;
    expect(s.acked).toBe(false);
    const acked = watchStep(
      s,
      fromModule("COMMAND_ACK", { id: "c1", status: "applying" }),
      fromBridge("OK", { accepted: true }),
    );
    expect(acked).toEqual({ state: { acked: true } });
    s = acked.state;
    expect(watchStep(s, pull, commands(0))).toEqual({
      state: { acked: true },
      event: { kind: "done" },
    });
  });

  test("nothing to apply at the first pull: done at once", () => {
    expect(watchStep({ acked: false }, pull, commands(0)).event).toEqual({
      kind: "done",
    });
  });

  test("acknowledged, then a fresh snapshot without a reload (nothing changed): done", () => {
    const snap = fromModule("SNAPSHOT_PUSH", { worldId: "w" });
    expect(
      watchStep({ acked: true }, snap, fromBridge("OK", {})).event,
    ).toEqual({ kind: "done" });
    expect(
      watchStep({ acked: false }, snap, fromBridge("OK", {})).event,
    ).toBeUndefined();
  });

  test("a failed acknowledgement says why", () => {
    expect(
      watchStep(
        { acked: true },
        fromModule("COMMAND_ACK", { status: "failed", error: "No space" }),
        fromBridge("OK", { accepted: true }),
      ).event,
    ).toEqual({ kind: "failed", reason: "No space" });
  });

  test("other messages change nothing", () => {
    expect(
      watchStep(
        { acked: false },
        fromModule("HELLO", {}),
        fromBridge("HELLO_ACK", {}),
      ),
    ).toEqual({ state: { acked: false } });
  });
});
