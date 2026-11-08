// Which layout the Setup page takes (Android plan, phase 3): touch screens by
// orientation, a mouse by width.
import { describe, expect, test } from "vitest";
import { layoutFor, readViewport } from "../../src/ui/shell/phone/layout.ts";

describe("layoutFor", () => {
  test.each([
    // A touch screen held upright: the phone layout at any width.
    [360, 800, true, "phone"],
    [412, 915, true, "phone"],
    [768, 1024, true, "phone"],
    [1024, 1366, true, "phone"],
    // On its side: the worlds list on the left when tall enough.
    [1024, 768, true, "tablet"],
    [1280, 800, true, "tablet"],
    [915, 600, true, "tablet"],
    // A phone on its side is too short for it.
    [915, 412, true, "phone"],
    [800, 599, true, "phone"],
    // A square touch screen counts as upright.
    [800, 800, true, "phone"],
    // A mouse: the desktop layout from 700 px wide, as today.
    [699, 1000, false, "phone"],
    [700, 500, false, "desktop"],
    [1280, 800, false, "desktop"],
    [1080, 1920, false, "desktop"],
  ] as const)("%i×%i, touch %s: %s", (width, height, coarse, want) => {
    expect(layoutFor({ width, height, coarse })).toBe(want);
  });
});

describe("readViewport", () => {
  test("reads the window's size and its primary pointer", () => {
    const win = {
      innerWidth: 412,
      innerHeight: 915,
      matchMedia: (q: string) => ({ matches: q === "(pointer: coarse)" }),
    };
    expect(readViewport(win)).toEqual({
      width: 412,
      height: 915,
      coarse: true,
    });
  });

  test("a window without matchMedia counts as a mouse", () => {
    expect(readViewport({ innerWidth: 500, innerHeight: 900 })).toEqual({
      width: 500,
      height: 900,
      coarse: false,
    });
  });
});
