import { describe, expect, test } from "vitest";
import { parsePageToUi, parseUiToPage } from "../../src/page-protocol.ts";

describe("UI to page messages are checked", () => {
  test("accepts well-formed notices", () => {
    expect(parseUiToPage("NOTIFY", { kind: "error", text: "x" })).toEqual({
      type: "NOTIFY",
      payload: { kind: "error", text: "x" },
    });
  });

  test("refuses anything else", () => {
    const bad: [string, unknown][] = [
      // Foundry windows of our own are gone with the preset editor (6a).
      [
        "WINDOW_OPEN",
        { id: "apply-1", title: "x", icon: "x", width: 1, height: 1 },
      ],
      ["WINDOW_CLOSE", { id: "apply-1" }],
      ["NOTIFY", { kind: "success", text: "x" }],
      ["NOTIFY", { kind: "info", text: "x".repeat(3000) }],
      // Foundry's world-card menu is no longer ours (Phase 5b).
      ["MENU", { labels: null, worldCard: ".w" }],
      ["EVAL", {}],
      ["NOTIFY", null],
    ];
    for (const [type, payload] of bad)
      expect(parseUiToPage(type, payload)).toBeUndefined();
  });
});

describe("page to UI messages are checked", () => {
  test("windows and menu actions are gone", () => {
    expect(parsePageToUi("WINDOW_READY", { id: "sheet-2" })).toBeUndefined();
    expect(
      parsePageToUi("MENU_ACTION", { action: "apply", worldId: "w1" }),
    ).toBeUndefined();
    expect(parsePageToUi("WINDOW_CLOSED", { id: "" })).toBeUndefined();
    expect(parsePageToUi("SETUP_DATA", {})).toBeUndefined();
    expect(parsePageToUi("WINDOW_READY", "x")).toBeUndefined();
  });
});

describe("new Setup page messages are checked", () => {
  test("the shell can be turned on and off, and reports its state", () => {
    expect(parseUiToPage("SHELL", { on: true })).toEqual({
      type: "SHELL",
      payload: { on: true },
    });
    expect(parseUiToPage("SHELL", { on: false })?.payload).toEqual({
      on: false,
    });
    expect(parsePageToUi("SHELL_STATE", { on: true })).toEqual({
      type: "SHELL_STATE",
      payload: { on: true },
    });
    expect(
      parsePageToUi("SHELL_STATE", { on: false, error: "missing #setup" })
        ?.payload,
    ).toEqual({ on: false, error: "missing #setup" });
  });

  test("Foundry actions come from a fixed list; world actions need a world", () => {
    for (const action of ["warnings", "logout", "shutdown", "createWorld"]) {
      expect(parseUiToPage("FOUNDRY_ACTION", { action })).toEqual({
        type: "FOUNDRY_ACTION",
        payload: { action },
      });
    }
    for (const action of ["launch", "favorite"]) {
      expect(
        parseUiToPage("FOUNDRY_ACTION", { action, worldId: "strahd" })?.payload,
      ).toEqual({ action, worldId: "strahd" });
      expect(parseUiToPage("FOUNDRY_ACTION", { action })).toBeUndefined();
    }
    expect(
      parseUiToPage("FOUNDRY_ACTION", {
        action: "backupLaunch",
        worldId: "strahd",
        note: "Before queued changes",
      })?.payload,
    ).toEqual({
      action: "backupLaunch",
      worldId: "strahd",
      note: "Before queued changes",
    });
  });

  test("refuses anything else", () => {
    const bad: [string, unknown][] = [
      ["SHELL", { on: "yes" }],
      ["SHELL", {}],
      ["FOUNDRY_ACTION", { action: "eval" }],
      ["FOUNDRY_ACTION", { action: "uninstall", worldId: "x" }],
      ["FOUNDRY_ACTION", { action: "launch", worldId: "" }],
      ["FOUNDRY_ACTION", { action: "launch", worldId: "x".repeat(201) }],
      ["FOUNDRY_ACTION", { action: "warnings", worldId: 3 }],
      // Gone with the fallbacks to Foundry's own windows (Phase 5b).
      ["FOUNDRY_ACTION", { action: "configure" }],
      ["FOUNDRY_ACTION", { action: "backups" }],
      ["FOUNDRY_ACTION", { action: "update" }],
      ["FOUNDRY_ACTION", { action: "editWorld", worldId: "x" }],
      ["FOUNDRY_ACTION", { action: "launch", worldId: "x", note: "n" }],
      ["FOUNDRY_ACTION", { action: "backupLaunch", worldId: "x", note: 3 }],
      [
        "FOUNDRY_ACTION",
        { action: "backupLaunch", worldId: "x", note: "n".repeat(201) },
      ],
    ];
    for (const [type, p] of bad) expect(parseUiToPage(type, p)).toBeUndefined();
    expect(parsePageToUi("SHELL_STATE", { on: 1 })).toBeUndefined();
    expect(
      parsePageToUi("SHELL_STATE", { on: false, error: "x".repeat(2001) }),
    ).toBeUndefined();
  });
});

describe("saving a world's details", () => {
  const save = (changes: unknown, extra: Record<string, unknown> = {}) =>
    parseUiToPage("SAVE_WORLD", {
      requestId: "r1",
      worldId: "w",
      changes,
      ...extra,
    });

  test("accepts a title, a next session or clearing it", () => {
    expect(save({ title: "New title" })?.payload).toEqual({
      requestId: "r1",
      worldId: "w",
      changes: { title: "New title" },
    });
    expect(save({ nextSession: "2026-11-12T18:00:00.000Z" })?.payload).toEqual({
      requestId: "r1",
      worldId: "w",
      changes: { nextSession: "2026-11-12T18:00:00.000Z" },
    });
    expect(save({ nextSession: null })?.payload).toMatchObject({
      changes: { nextSession: null },
    });
  });

  test("accepts the About tab's other fields", () => {
    for (const changes of [
      { system: "pf2e" },
      { joinTheme: "minimal" },
      { joinTheme: "default" },
      { background: "worlds/w/bg.webp" },
      { background: null },
      { safeMode: true },
      { safeMode: false },
      { resetKeys: true },
      { description: "<p>Gothic</p>" },
      { description: "" },
      {
        schedule: {
          start: "2026-11-10",
          time: "19:00",
          tz: "Europe/Berlin",
          freq: "w1",
          skips: [],
        },
      },
      { schedule: null },
    ])
      expect(save(changes)?.payload).toMatchObject({ changes });
  });

  test("refuses empty, oversized, unreadable or unknown changes", () => {
    for (const changes of [
      {},
      { title: "" },
      { title: "x".repeat(201) },
      { nextSession: "soon" },
      { nextSession: 5 },
      { title: "t", lockPackage: true },
      { system: "" },
      { system: "x".repeat(201) },
      { joinTheme: "fancy" },
      { safeMode: "yes" },
      { resetKeys: false },
      { background: 3 },
      { background: "x".repeat(2049) },
      { description: "x".repeat(20001) },
      {
        schedule: {
          start: "soon",
          time: "19:00",
          tz: "UTC",
          freq: "w1",
          skips: [],
        },
      },
      { schedule: "weekly" },
      null,
    ])
      expect(save(changes)).toBeUndefined();
    expect(save({ title: "t" }, { requestId: "" })).toBeUndefined();
    expect(save({ title: "t" }, { worldId: 3 })).toBeUndefined();
  });

  test("the answer names its request and may carry an error", () => {
    expect(parsePageToUi("SAVE_DONE", { requestId: "r1" })).toEqual({
      type: "SAVE_DONE",
      payload: { requestId: "r1" },
    });
    expect(
      parsePageToUi("SAVE_DONE", { requestId: "r1", error: "Bad title" })
        ?.payload,
    ).toEqual({ requestId: "r1", error: "Bad title" });
    expect(parsePageToUi("SAVE_DONE", { error: "x" })).toBeUndefined();
  });
});

describe("Install and Update All are checked (6a)", () => {
  test("a package type is required, and nothing else", () => {
    expect(
      parseUiToPage("FOUNDRY_ACTION", {
        action: "installPackage",
        packageType: "module",
      }),
    ).toEqual({
      type: "FOUNDRY_ACTION",
      payload: { action: "installPackage", packageType: "module" },
    });
    expect(
      parseUiToPage("FOUNDRY_ACTION", {
        action: "updateAll",
        packageType: "world",
      }),
    ).toBeUndefined();
    expect(
      parseUiToPage("FOUNDRY_ACTION", {
        action: "updateAll",
        packageType: "module",
        worldId: "w",
      }),
    ).toBeUndefined();
  });
});
