import { describe, expect, test } from "vitest";
import {
  acknowledge,
  activeIdsKey,
  pendingFor,
  reconcile,
  type Command,
} from "../src/commands.ts";

const command = (over: Partial<Command> = {}): Command => ({
  id: "c1",
  worldId: "w1",
  type: "preset.apply",
  payload: { mode: "add", modules: ["a"] },
  createdAt: "2026-11-05T00:00:00Z",
  status: "pending",
  ...over,
});

describe("activeIdsKey", () => {
  test("ignores order", () => {
    expect(activeIdsKey(["b", "a"])).toBe(activeIdsKey(["a", "b"]));
  });
});

describe("pendingFor", () => {
  test("returns only this world's pending commands", () => {
    const list = [
      command({ id: "1" }),
      command({ id: "2", worldId: "w2" }),
      command({ id: "3", status: "applied" }),
    ];
    expect(pendingFor(list, "w1").map((c) => c.id)).toEqual(["1"]);
  });
});

describe("acknowledge", () => {
  test("records the status and target without touching other commands", () => {
    const list = [command(), command({ id: "c2" })];
    const next = acknowledge(list, {
      id: "c1",
      status: "applying",
      target: ["b", "a"],
    });
    expect(next[0]).toMatchObject({
      status: "applying",
      targetKey: activeIdsKey(["a", "b"]),
    });
    expect(next[1]).toBe(list[1]);
    expect(list[0]?.status).toBe("pending");
  });

  test("ignores an unknown command id", () => {
    const list = [command()];
    expect(acknowledge(list, { id: "nope", status: "declined" })).toEqual(list);
  });
});

describe("reconcile", () => {
  test("marks an applying command applied when the snapshot reaches its target", () => {
    const list = [
      command({ status: "applying", targetKey: activeIdsKey(["a", "b"]) }),
    ];
    const next = reconcile(list, { worldId: "w1", active: ["b", "a"] });
    expect(next[0]?.status).toBe("applied");
  });

  test("marks it failed when the snapshot differs from the target", () => {
    const list = [command({ status: "applying", targetKey: "a" })];
    const next = reconcile(list, { worldId: "w1", active: ["x"] });
    expect(next[0]).toMatchObject({ status: "failed" });
  });

  test("leaves other worlds and other states alone", () => {
    const list = [
      command({ status: "applying", worldId: "w2", targetKey: "a" }),
      command({ id: "c2" }),
    ];
    expect(reconcile(list, { worldId: "w1", active: ["a"] })).toEqual(list);
  });
});
