import { afterEach, describe, expect, test, vi } from "vitest";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe("the build label", () => {
  test("tests and tools count as a dev build", async () => {
    const info = await import("../src/build-info.ts");
    expect(info.BUILD).toBe("dev");
    expect(info.IS_DEV_BUILD).toBe(true);
  });

  test("a release build is not a dev build", async () => {
    vi.stubGlobal("__ML_DEV__", false);
    vi.stubGlobal("__ML_BUILD__", "0.2.0 · abc1234 · 2026-11-06 17:00");
    vi.resetModules();
    const info = await import("../src/build-info.ts");
    expect(info.IS_DEV_BUILD).toBe(false);
    expect(info.BUILD).toBe("0.2.0 · abc1234 · 2026-11-06 17:00");
  });
});
