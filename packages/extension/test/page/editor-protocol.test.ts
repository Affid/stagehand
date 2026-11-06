import { describe, expect, test } from "vitest";
import { parseUiToPage } from "../../src/page-protocol.ts";

describe("the description editor's messages", () => {
  test("open, save and close name one of our hosts", () => {
    expect(
      parseUiToPage("EDITOR_OPEN", { hostId: "ml-pm-w1", value: "<p>x</p>" })
        ?.payload,
    ).toEqual({ hostId: "ml-pm-w1", value: "<p>x</p>" });
    expect(
      parseUiToPage("EDITOR_SAVE", {
        requestId: "r1",
        hostId: "ml-pm-w1",
        worldId: "w1",
      })?.payload,
    ).toEqual({ requestId: "r1", hostId: "ml-pm-w1", worldId: "w1" });
    expect(
      parseUiToPage("EDITOR_CLOSE", { hostId: "ml-pm-w1" })?.payload,
    ).toEqual({ hostId: "ml-pm-w1" });
  });

  test("never another element, an oversized value, or a missing world", () => {
    for (const [type, p] of [
      ["EDITOR_OPEN", { hostId: "setup", value: "" }],
      ["EDITOR_OPEN", { hostId: "ml-pm-w1", value: "x".repeat(20001) }],
      ["EDITOR_OPEN", { hostId: "ml-pm-w1 #x", value: "" }],
      ["EDITOR_CLOSE", { hostId: "body" }],
      ["EDITOR_SAVE", { requestId: "r1", hostId: "ml-pm-w1", worldId: "" }],
      ["EDITOR_SAVE", { requestId: "", hostId: "ml-pm-w1", worldId: "w" }],
    ] as const)
      expect(parseUiToPage(type, p)).toBeUndefined();
  });
});
