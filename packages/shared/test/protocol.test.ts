import { describe, expect, test } from "vitest";
import {
  NS,
  isEnvelope,
  makeEnvelope,
  negotiateProtocol,
} from "../src/protocol.ts";

describe("isEnvelope", () => {
  test("accepts a well-formed envelope from the expected sender", () => {
    const msg = makeEnvelope("module", "HELLO", { worldId: "w" }, "r1");
    expect(isEnvelope(msg, "module")).toBe(true);
  });

  test("rejects messages from another sender (a side reading its own posts)", () => {
    const msg = makeEnvelope("bridge", "HELLO_ACK", {}, "r1");
    expect(isEnvelope(msg, "module")).toBe(false);
  });

  test.each([
    ["null", null],
    ["a string", "HELLO"],
    ["another namespace", { ns: "other", v: 1, from: "module", type: "X" }],
    ["no type", { ns: NS, v: 1, from: "module" }],
    ["a non-numeric version", { ns: NS, v: "1", from: "module", type: "X" }],
  ])("rejects %s", (_label, value) => {
    expect(isEnvelope(value, "module")).toBe(false);
  });
});

describe("negotiateProtocol", () => {
  test("picks the highest version both sides support", () => {
    expect(negotiateProtocol([1, 2, 3], [2, 3, 4])).toBe(3);
  });

  test("returns undefined when there is no common version", () => {
    expect(negotiateProtocol([1], [2])).toBeUndefined();
  });
});
