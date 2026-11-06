import { describe, expect, test } from "vitest";
import { createTranslator } from "../../src/ui/i18n.ts";
import { unverifiedText } from "../../src/ui/model/unverified.ts";

describe("the not verified line", () => {
  const t = createTranslator("en");

  test("names the running generation", () => {
    expect(unverifiedText(t, 14)).toBe("Not verified for Foundry 14");
  });

  test("without a known version it says so, never Foundry 0", () => {
    expect(unverifiedText(t, 0)).toBe("Not verified for this Foundry version");
    expect(unverifiedText(t, undefined)).toBe(
      "Not verified for this Foundry version",
    );
  });
});
