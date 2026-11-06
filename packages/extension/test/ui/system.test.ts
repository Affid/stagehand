import { describe, expect, test } from "vitest";
import { systemTitle } from "../../src/ui/model/system.ts";
import { setupState } from "./harness.tsx";

describe("a world's system by name", () => {
  const setup = setupState().setup;

  test("the installed system's title", () => {
    expect(systemTitle(setup, "dnd5e")).toBe(
      "Dungeons & Dragons Fifth Edition",
    );
  });

  test("a system that isn't installed keeps its id", () => {
    expect(systemTitle(setup, "pf2e")).toBe("pf2e");
    expect(systemTitle(undefined, "pf2e")).toBe("pf2e");
  });
});
