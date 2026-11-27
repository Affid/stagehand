import { describe, expect, test } from "vitest";
import { parsePageToUi } from "../../src/page-protocol.ts";

describe("Foundry's progress and lock, forwarded", () => {
  test("a backup's progress is read and bounded", () => {
    expect(
      parsePageToUi("PROGRESS", {
        action: "createBackup",
        id: "strahd",
        title: "Curse of Strahd",
        pct: 47.4,
        step: "archive",
        extra: "dropped",
      })?.payload,
    ).toEqual({
      action: "createBackup",
      id: "strahd",
      title: "Curse of Strahd",
      pct: 47,
      step: "archive",
    });
  });

  test("the package comes from Foundry's tick, or from the backup's id", () => {
    expect(
      parsePageToUi("PROGRESS", {
        action: "createBackup",
        id: "world.strahd.2026-11-06.1762400000000",
        packageId: "strahd",
        type: "world",
      })?.payload,
    ).toMatchObject({ packageId: "strahd", type: "world" });
    expect(
      parsePageToUi("PROGRESS", {
        action: "restoreBackup",
        id: "world.strahd.2026-11-06.1762400000000",
        step: "complete",
      })?.payload,
    ).toMatchObject({ packageId: "strahd", type: "world" });
    expect(
      parsePageToUi("PROGRESS", {
        action: "createSnapshot",
        id: "snapshot.2026-11-06.1762400000000",
      })?.payload,
    ).toEqual({
      action: "createSnapshot",
      id: "snapshot.2026-11-06.1762400000000",
      type: "snapshot",
    });
    expect(
      parsePageToUi("PROGRESS", {
        action: "createBackup",
        id: "x",
        packageId: "<b>",
      })?.payload,
    ).toEqual({ action: "createBackup", id: "x" });
  });

  test("an install names its package in Foundry's title; its id is the manifest URL", () => {
    const tick = (over: object) =>
      parsePageToUi("PROGRESS", {
        action: "installPackage",
        id: "https://example.com/sequencer/module.json",
        type: "module",
        title: "sequencer",
        ...over,
      })?.payload;
    expect(tick({ step: "download", pct: 40 })).toMatchObject({
      packageId: "sequencer",
      type: "module",
      pct: 40,
    });
    expect(tick({ step: "complete" })).toMatchObject({
      packageId: "sequencer",
    });
    // A title that isn't an id names no package.
    expect(tick({ title: "Sequencer <b>" })).not.toHaveProperty("packageId");
  });

  test("other actions, bad ids and odd numbers are refused or left out", () => {
    expect(
      parsePageToUi("PROGRESS", { action: "createWorld", id: "w" }),
    ).toBeUndefined();
    expect(
      parsePageToUi("PROGRESS", { action: "createBackup", id: "" }),
    ).toBeUndefined();
    expect(
      parsePageToUi("PROGRESS", { action: "createBackup", id: "w", pct: 300 })
        ?.payload,
    ).toEqual({ action: "createBackup", id: "w" });
  });

  test("the lock is on or off, with Foundry's message", () => {
    expect(
      parsePageToUi("LOCK", { locked: true, message: "Backing up" })?.payload,
    ).toEqual({
      locked: true,
      message: "Backing up",
    });
    expect(parsePageToUi("LOCK", { locked: "yes" })).toBeUndefined();
  });
});
