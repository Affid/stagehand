// Whether the server has the companion module Setup needs, and in a version
// this Stagehand works with (issue 1).
import { describe, expect, test } from "vitest";
import {
  COMPANION_ID,
  COMPANION_MANIFEST,
  companionState,
  MIN_COMPANION_VERSION,
} from "../src/companion.ts";

const mod = (id: string, version: string) => ({ id, version });

describe("the companion on a server", () => {
  test("missing when no installed module has its id", () => {
    expect(companionState([])).toBe("missing");
    expect(companionState([mod("dice-so-nice", "5.0.0")])).toBe("missing");
  });

  test("ok from the oldest version this Stagehand works with", () => {
    expect(companionState([mod(COMPANION_ID, MIN_COMPANION_VERSION)])).toBe(
      "ok",
    );
    expect(companionState([mod("a", "1"), mod(COMPANION_ID, "9.0.0")])).toBe(
      "ok",
    );
  });

  test("outdated below it, or without a readable version", () => {
    expect(companionState([mod(COMPANION_ID, "0.0.9")])).toBe("outdated");
    expect(companionState([mod(COMPANION_ID, "")])).toBe("outdated");
  });

  test("installs from the manifests branch, the address Foundry updates from", () => {
    expect(COMPANION_MANIFEST).toBe(
      "https://raw.githubusercontent.com/Affid/stagehand/manifests/stagehand/module.json",
    );
    expect(MIN_COMPANION_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
