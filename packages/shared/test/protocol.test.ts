import { afterEach, describe, expect, test, vi } from "vitest";
import {
  NS,
  isEnvelope,
  makeEnvelope,
  newRequestId,
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

describe("newRequestId (Android spike, finding 4)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("24 hex characters, a new one each time", () => {
    const a = newRequestId();
    expect(a).toMatch(/^[0-9a-f]{24}$/);
    expect(newRequestId()).not.toBe(a);
  });

  test("works where crypto.randomUUID is missing (plain http on a network address)", () => {
    const real = globalThis.crypto;
    vi.stubGlobal("crypto", {
      getRandomValues: (a: Uint8Array<ArrayBuffer>) => real.getRandomValues(a),
    });
    expect(
      (globalThis.crypto as { randomUUID?: unknown }).randomUUID,
    ).toBeUndefined();
    expect(newRequestId()).toMatch(/^[0-9a-f]{24}$/);
  });
});
