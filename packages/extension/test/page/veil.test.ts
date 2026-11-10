// @vitest-environment happy-dom
// The veil (no jump from Foundry's Setup to ours): marked as waiting from the
// first moment, and Foundry's page shown again if the new page hasn't taken
// over in time.
import { afterEach, describe, expect, test, vi } from "vitest";
import {
  liftVeil,
  startVeil,
  VEIL_OFF,
  VEIL_TIMEOUT_MS,
  VEIL_WAIT,
} from "../../src/page/veil.ts";

afterEach(() => {
  document.documentElement.className = "";
  document.body.className = "";
});

const html = (): DOMTokenList => document.documentElement.classList;

describe("the veil", () => {
  test("starts waiting at once, and gives Foundry's page back if nothing takes over in time", () => {
    const later: (() => void)[] = [];
    startVeil(document, (fn, ms) => {
      expect(ms).toBe(VEIL_TIMEOUT_MS);
      later.push(fn);
    });
    expect(html().contains(VEIL_WAIT)).toBe(true);
    expect(html().contains(VEIL_OFF)).toBe(false);
    later.forEach((fn) => {
      fn();
    });
    expect(html().contains(VEIL_OFF)).toBe(true);
  });

  test("once the new page is on, the timer leaves it alone", () => {
    const later: (() => void)[] = [];
    startVeil(document, (fn) => later.push(fn));
    document.body.classList.add("st-shell-on");
    later.forEach((fn) => {
      fn();
    });
    expect(html().contains(VEIL_OFF)).toBe(false);
  });

  test("lifting it shows Foundry's page", () => {
    liftVeil(document);
    expect(html().contains(VEIL_OFF)).toBe(true);
  });

  test("waits long enough for a slow server, not forever", () => {
    expect(VEIL_TIMEOUT_MS).toBeGreaterThanOrEqual(10_000);
    expect(VEIL_TIMEOUT_MS).toBeLessThanOrEqual(20_000);
    vi.useRealTimers();
  });
});
