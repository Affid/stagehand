// Foundry's Setup tour that starts by itself on the first open (its
// backups overview) stays off our Setup page (owner, 2026-11-11): its
// steps point at Foundry's own Setup, which ours covers.
import { describe, expect, test, vi } from "vitest";
import type { PageGlobals } from "../../src/page/globals.ts";
import { closeStartedTours, quietSetupTours } from "../../src/page/tours.ts";

function tours(ids: readonly string[]) {
  const all = new Map(ids.map((id) => [id, { start: vi.fn() }]));
  const page = { game: { tours: all } } as unknown as PageGlobals;
  return { all, page };
}

describe("quietSetupTours", () => {
  test("the backups tour no longer starts when Foundry asks it to; others do", async () => {
    const t = tours(["core.backupsOverview", "core.creatingAWorld"]);
    const backups = t.all.get("core.backupsOverview");
    const real = backups?.start;
    expect(quietSetupTours(t.page)).toBe(true);
    await backups?.start();
    expect(real).not.toHaveBeenCalled();
    t.all.get("core.creatingAWorld")?.start();
    expect(t.all.get("core.creatingAWorld")?.start).toHaveBeenCalledOnce();
  });

  test("says so while Foundry hasn't registered its tours yet", () => {
    expect(quietSetupTours({})).toBe(false);
    expect(quietSetupTours(tours([]).page)).toBe(false);
  });
});

describe("closeStartedTours", () => {
  /** Foundry's tour: `overlayElement` is there once its step is drawn. */
  function started(drawn: boolean) {
    const tour = {
      start: vi.fn(),
      overlayElement: drawn ? {} : undefined,
      resets: 0,
      reset(this: { resets: number; overlayElement: unknown }) {
        this.resets += 1;
        this.overlayElement = undefined;
        return Promise.resolve();
      },
    };
    const page = {
      game: { tours: new Map([["core.backupsOverview", tour]]) },
    } as unknown as PageGlobals;
    return { tour, page };
  }

  test("a tour already on screen is taken away and left unstarted, on Foundry's own object", () => {
    vi.useFakeTimers();
    const { tour, page } = started(true);
    closeStartedTours(page);
    expect(tour.resets).toBe(1);
    vi.advanceTimersByTime(60_000);
    expect(tour.resets).toBe(1);
    vi.useRealTimers();
  });

  test("a tour Foundry is still starting is taken away once its step is drawn", () => {
    // Exiting it sooner leaves the step on screen: Foundry draws it after.
    vi.useFakeTimers();
    const { tour, page } = started(false);
    closeStartedTours(page);
    vi.advanceTimersByTime(500);
    expect(tour.resets).toBe(0);
    tour.overlayElement = {};
    vi.advanceTimersByTime(200);
    expect(tour.resets).toBe(1);
    vi.useRealTimers();
  });

  test("gives up watching after a while; nothing happens without Foundry", () => {
    vi.useFakeTimers();
    const { tour, page } = started(false);
    closeStartedTours(page);
    vi.advanceTimersByTime(60_000);
    expect(vi.getTimerCount()).toBe(0);
    tour.overlayElement = {};
    vi.advanceTimersByTime(1000);
    expect(tour.resets).toBe(0);
    expect(() => {
      closeStartedTours({});
    }).not.toThrow();
    vi.useRealTimers();
  });
});
