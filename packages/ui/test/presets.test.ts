// A preset is active in a world when every module in it that the server
// has is on (owner, 2026-11-18); modules the server lacks aren't counted.
import { describe, expect, it } from "vitest";
import { presetState } from "../src/model/presets.ts";

const preset = (modules: readonly string[]) => ({ modules });
const installed = new Set(["a", "b", "c"]);

describe("presetState", () => {
  it("is active when all of its installed modules are on", () => {
    const state = presetState(
      preset(["a", "b"]),
      installed,
      new Set(["a", "b"]),
    );

    expect(state).toEqual({ installed: 2, on: 2, missing: 0, active: true });
  });

  it("is not active while one of them is off", () => {
    const state = presetState(preset(["a", "b"]), installed, new Set(["a"]));

    expect(state.active).toBe(false);
    expect(state.on).toBe(1);
  });

  it("leaves out modules the server doesn't have", () => {
    const state = presetState(preset(["a", "gone"]), installed, new Set(["a"]));

    expect(state).toEqual({ installed: 1, on: 1, missing: 1, active: true });
  });

  it("is never active with nothing installed", () => {
    const state = presetState(preset(["gone"]), installed, new Set());

    expect(state.active).toBe(false);
  });
});
