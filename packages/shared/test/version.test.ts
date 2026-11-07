import { describe, expect, test } from "vitest";
import {
  Availability,
  isCompatibilityRisk,
  isNewerVersion,
  isUsable,
  parseCoreVersion,
  testAvailability,
  testDependencyCompatibility,
} from "../src/version.ts";

describe("isNewerVersion (mirrors Foundry's helper)", () => {
  test.each([
    ["1.10.0", "1.9.0", true],
    ["1.9.0", "1.10.0", false],
    ["1.0.0", "1.0.0", false],
    ["1.0.1", "1.0", true],
    ["1.0", "1.0.1", false],
    ["14.369", "14", true],
    ["1.0.0-beta", "1.0.0-alpha", true],
  ])("%s newer than %s: %s", (v1, v0, expected) => {
    expect(isNewerVersion(v1, v0)).toBe(expected);
  });

  test("compares only the major part when asked", () => {
    expect(isNewerVersion("14.369", "14", { majorOnly: true })).toBe(false);
    expect(isNewerVersion("15.1", "14", { majorOnly: true })).toBe(true);
  });

  test("treats a missing version like Foundry does", () => {
    expect(isNewerVersion(undefined, "1")).toBe(false);
    expect(isNewerVersion("1", undefined)).toBe(true);
  });
});

describe("parseCoreVersion", () => {
  test("splits generation and build", () => {
    expect(parseCoreVersion("14.369")).toEqual({
      version: "14.369",
      generation: 14,
      build: 369,
    });
  });

  test("accepts a generation alone", () => {
    expect(parseCoreVersion("13")).toMatchObject({ generation: 13, build: 0 });
  });
});

describe("testAvailability", () => {
  const core = parseCoreVersion("14.369");

  test.each([
    [{ minimum: "13", verified: "14" }, Availability.VERIFIED],
    [{ minimum: "13", verified: "14.369" }, Availability.VERIFIED],
    [{ minimum: "13", verified: "14.300" }, Availability.UNVERIFIED_BUILD],
    [{ minimum: "12", verified: "13" }, Availability.UNVERIFIED_GENERATION],
    [{ minimum: "15" }, Availability.REQUIRES_CORE_UPGRADE],
    [{ minimum: "12", maximum: "13" }, Availability.REQUIRES_CORE_DOWNGRADE],
    [{ minimum: "12", maximum: "14" }, Availability.UNKNOWN],
    [{}, Availability.UNKNOWN],
  ])("%j on 14.369 is %s", (compatibility, expected) => {
    expect(testAvailability(compatibility, core)).toBe(expected);
  });

  test("a risk as Foundry badges it: a newer build of the same generation is neutral", () => {
    expect(isCompatibilityRisk(Availability.VERIFIED)).toBe(false);
    expect(isCompatibilityRisk(Availability.UNVERIFIED_BUILD)).toBe(false);
    expect(isCompatibilityRisk(Availability.UNVERIFIED_GENERATION)).toBe(true);
    expect(isCompatibilityRisk(Availability.UNKNOWN)).toBe(true);
    expect(isCompatibilityRisk(Availability.REQUIRES_CORE_UPGRADE)).toBe(true);
    expect(isCompatibilityRisk(Availability.REQUIRES_CORE_DOWNGRADE)).toBe(
      true,
    );
  });

  test("unverified packages are still usable; out-of-range ones are not", () => {
    expect(isUsable(Availability.UNVERIFIED_GENERATION)).toBe(true);
    expect(isUsable(Availability.REQUIRES_CORE_DOWNGRADE)).toBe(false);
    expect(isUsable(Availability.REQUIRES_CORE_UPGRADE)).toBe(false);
  });
});

describe("testDependencyCompatibility", () => {
  test("accepts any version without a range", () => {
    expect(testDependencyCompatibility(undefined, "1.0.0")).toBe(true);
  });

  test("checks minimum and maximum", () => {
    const range = { minimum: "2.0.0", maximum: "2.9.9" };
    expect(testDependencyCompatibility(range, "1.9.0")).toBe(false);
    expect(testDependencyCompatibility(range, "2.5.0")).toBe(true);
    expect(testDependencyCompatibility(range, "3.0.0")).toBe(false);
  });
});

describe("versions as shown (Phase 6 live)", () => {
  test("one v before the number, whether the package wrote one or not", async () => {
    const { shownVersion, bareVersion } = await import("../src/version.ts");
    expect(shownVersion("1.1.4")).toBe("v1.1.4");
    expect(shownVersion("v1.1.4")).toBe("v1.1.4");
    expect(shownVersion("V2")).toBe("V2");
    expect(shownVersion("")).toBe("");
    expect(bareVersion("v1.1.4")).toBe("1.1.4");
    expect(bareVersion("version-x")).toBe("version-x");
  });
});
