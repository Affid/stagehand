import { describe, expect, test } from "vitest";
import { fileStamp, safeUrl } from "../../src/ui/common/files.ts";

describe("safeUrl", () => {
  test.each([
    ["https://a.example/x", "https://a.example/x"],
    ["http://a.example", "http://a.example/"],
    ["javascript:alert(1)", undefined],
    ["data:text/html,hi", undefined],
    ["not a url", undefined],
    [undefined, undefined],
  ])("%s -> %s", (input, expected) => {
    expect(safeUrl(input)).toBe(expected);
  });
});

test("fileStamp is the ISO date", () => {
  expect(fileStamp(new Date("2026-11-05T12:00:00Z"))).toBe("2026-11-05");
});
