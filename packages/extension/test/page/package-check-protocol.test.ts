// Our check's messages, checked both ways (page-package-check.ts): what the
// UI asks, and what the page world answers, which page scripts could forge.
import { describe, expect, test } from "vitest";
import { parsePageToUi, parseUiToPage } from "../../src/page-protocol.ts";

const result = {
  id: "a",
  type: "module",
  state: "update",
  version: "1.1.0",
  availability: 1,
  compatibility: { minimum: "13", verified: "14" },
  requires: [{ id: "lib", minimum: "1.1.0" }],
  systems: [{ id: "dnd5e", maximum: "5.9" }],
  checkedAt: 1,
};

describe("asking for a check", () => {
  test("the library, one package, or stop", () => {
    expect(
      parseUiToPage("PACKAGE_CHECK", { requestId: "r1", op: "all" }),
    ).toEqual({
      type: "PACKAGE_CHECK",
      payload: { requestId: "r1", op: "all" },
    });
    expect(
      parseUiToPage("PACKAGE_CHECK", {
        requestId: "r1",
        op: "one",
        type: "system",
        id: "dnd5e",
      })?.payload,
    ).toEqual({ requestId: "r1", op: "one", type: "system", id: "dnd5e" });
    expect(
      parseUiToPage("PACKAGE_CHECK", { requestId: "r1", op: "stop" })?.payload,
    ).toEqual({
      requestId: "r1",
      op: "stop",
    });
  });

  test("anything else is refused", () => {
    for (const p of [
      { requestId: "r 1", op: "all" },
      { requestId: "r1", op: "all", extra: 1 },
      { requestId: "r1", op: "one", type: "world", id: "x" },
      { requestId: "r1", op: "one", type: "module", id: "../x" },
      { requestId: "r1", op: "install" },
    ])
      expect(parseUiToPage("PACKAGE_CHECK", p)).toBeUndefined();
  });
});

describe("what the page world answers", () => {
  test("progress, a result and the end are read", () => {
    expect(
      parsePageToUi("PACKAGE_CHECK", {
        requestId: "r1",
        kind: "tick",
        done: 2,
        total: 9,
        current: "a",
      })?.payload,
    ).toEqual({
      requestId: "r1",
      kind: "tick",
      done: 2,
      total: 9,
      current: "a",
    });
    expect(
      parsePageToUi("PACKAGE_CHECK", {
        requestId: "r1",
        kind: "result",
        result: { ...result, junk: "x" },
      })?.payload,
    ).toEqual({ requestId: "r1", kind: "result", result });
    expect(
      parsePageToUi("PACKAGE_CHECK", {
        requestId: "r1",
        kind: "done",
        stopped: true,
      })?.payload,
    ).toEqual({ requestId: "r1", kind: "done", stopped: true });
  });

  test("a forged or odd answer is dropped", () => {
    const bad = [
      { requestId: "r1", kind: "tick", done: 5, total: 2 },
      { requestId: "r1", kind: "tick", done: 1, total: 2, current: "<b>" },
      {
        requestId: "r1",
        kind: "result",
        result: { ...result, state: "hacked" },
      },
      {
        requestId: "r1",
        kind: "result",
        result: { ...result, version: "x".repeat(61) },
      },
      {
        requestId: "r1",
        kind: "result",
        result: { ...result, requires: [{ id: "a b" }] },
      },
      { requestId: "r1", kind: "result", result: { ...result, errorCode: 42 } },
      {
        requestId: "r1",
        kind: "result",
        result: { ...result, compatibility: { minimum: 13 } },
      },
      { requestId: "r1", kind: "done", stopped: "yes" },
      { requestId: "r1", kind: "other" },
    ];
    for (const p of bad)
      expect(parsePageToUi("PACKAGE_CHECK", p)).toBeUndefined();
  });
});
