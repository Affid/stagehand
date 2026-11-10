import { describe, expect, test } from "vitest";
import { parsePageToUi, parseUiToPage } from "../../src/page-protocol.ts";
import { MAX_SYNC_FILE_CHARS } from "@stagehand/shared/library/sync-file";

describe("LIBRARY_FILE messages", () => {
  test("a read and a write cross to the page world", () => {
    expect(
      parseUiToPage("LIBRARY_FILE", { requestId: "r1", op: "read" }),
    ).toEqual({
      type: "LIBRARY_FILE",
      payload: { requestId: "r1", op: "read" },
    });
    expect(
      parseUiToPage("LIBRARY_FILE", {
        requestId: "r2",
        op: "write",
        text: "{}",
      }),
    ).toEqual({
      type: "LIBRARY_FILE",
      payload: { requestId: "r2", op: "write", text: "{}" },
    });
  });

  test("malformed requests are dropped", () => {
    for (const p of [
      {},
      { requestId: "r", op: "delete" },
      { requestId: "r", op: "write" },
      { requestId: "r", op: "write", text: 5 },
      { requestId: "bad id!", op: "read" },
      {
        requestId: "r",
        op: "write",
        text: "x".repeat(MAX_SYNC_FILE_CHARS + 1),
      },
    ])
      expect(parseUiToPage("LIBRARY_FILE", p)).toBeUndefined();
  });

  test("each kind of answer crosses back", () => {
    for (const payload of [
      { requestId: "r", text: "{}" },
      { requestId: "r", missing: true },
      { requestId: "r", error: "No." },
      { requestId: "r" },
    ])
      expect(parsePageToUi("LIBRARY_FILE_DONE", payload)).toEqual({
        type: "LIBRARY_FILE_DONE",
        payload,
      });
  });

  test("malformed answers are dropped", () => {
    for (const p of [
      { text: "{}" },
      { requestId: "r", text: 1 },
      { requestId: "r", missing: "yes" },
      { requestId: "r", error: "" },
      { requestId: "r", text: "{}", error: "both" },
    ])
      expect(parsePageToUi("LIBRARY_FILE_DONE", p)).toBeUndefined();
  });
});
