import { describe, expect, test } from "vitest";
import { parsePageToUi, parseUiToPage } from "../../src/page-protocol.ts";

const spec = {
  id: "apply-1",
  title: "Apply presets",
  icon: "fa-solid fa-layer-group",
  width: 980,
  height: 780,
};

describe("UI to page messages are checked", () => {
  test("accepts well-formed windows, notices and menus", () => {
    expect(parseUiToPage("WINDOW_OPEN", { ...spec, left: 10 })).toEqual({
      type: "WINDOW_OPEN",
      payload: { ...spec, left: 10 },
    });
    expect(parseUiToPage("WINDOW_CLOSE", { id: "apply-1" })?.type).toBe(
      "WINDOW_CLOSE",
    );
    expect(parseUiToPage("NOTIFY", { kind: "error", text: "x" })).toEqual({
      type: "NOTIFY",
      payload: { kind: "error", text: "x" },
    });
    expect(
      parseUiToPage("MENU", {
        labels: { details: "D", apply: "A" },
        worldCard: ".world",
      }),
    ).toEqual({
      type: "MENU",
      payload: { labels: { details: "D", apply: "A" }, worldCard: ".world" },
    });
    expect(
      parseUiToPage("MENU", { labels: null, worldCard: ".world" })?.payload,
    ).toEqual({ labels: null, worldCard: ".world" });
  });

  test("refuses anything else", () => {
    const bad: [string, unknown][] = [
      ["WINDOW_OPEN", { ...spec, id: "Bad Id" }],
      ["WINDOW_OPEN", { ...spec, width: -1 }],
      ["WINDOW_OPEN", { ...spec, top: "1" }],
      ["WINDOW_OPEN", { ...spec, title: "" }],
      ["WINDOW_CLOSE", { id: 3 }],
      ["NOTIFY", { kind: "success", text: "x" }],
      ["NOTIFY", { kind: "info", text: "x".repeat(3000) }],
      ["MENU", { labels: { details: "" }, worldCard: ".w" }],
      ["MENU", { labels: { details: "D", apply: 1 }, worldCard: ".w" }],
      ["MENU", { labels: null }],
      ["EVAL", {}],
      ["NOTIFY", null],
    ];
    for (const [type, payload] of bad)
      expect(parseUiToPage(type, payload)).toBeUndefined();
  });
});

describe("page to UI messages are checked", () => {
  test("windows and menu actions", () => {
    expect(parsePageToUi("WINDOW_READY", { id: "sheet-2" })?.type).toBe(
      "WINDOW_READY",
    );
    expect(
      parsePageToUi("MENU_ACTION", { action: "apply", worldId: "w1" }),
    ).toEqual({
      type: "MENU_ACTION",
      payload: { action: "apply", worldId: "w1" },
    });
    expect(
      parsePageToUi("MENU_ACTION", { action: "delete", worldId: "w1" }),
    ).toBeUndefined();
    expect(parsePageToUi("WINDOW_CLOSED", { id: "" })).toBeUndefined();
    expect(parsePageToUi("SETUP_DATA", {})).toBeUndefined();
    expect(parsePageToUi("WINDOW_READY", "x")).toBeUndefined();
  });
});
