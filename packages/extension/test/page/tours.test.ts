// Foundry's Setup tour that starts by itself on the first open (its
// backups overview) stays off our Setup page (owner, 2026-11-11): its
// steps point at Foundry's own Setup, which ours covers.
import { describe, expect, test, vi } from "vitest";
import type { PageGlobals } from "../../src/page/globals.ts";
import { exitActiveTour, quietSetupTours } from "../../src/page/tours.ts";

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

describe("exitActiveTour", () => {
  test("a tour already on screen is closed, on Foundry's own object", () => {
    const tour = {
      exited: 0,
      exit(this: { exited: number }) {
        this.exited += 1;
      },
    };
    const page = {
      foundry: { nue: { Tour: { activeTour: tour } } },
    } as unknown as PageGlobals;
    exitActiveTour(page);
    expect(tour.exited).toBe(1);
  });

  test("does nothing with no tour on screen, or no Foundry", () => {
    const page = {
      foundry: { nue: { Tour: { activeTour: null } } },
    } as unknown as PageGlobals;
    expect(() => {
      exitActiveTour(page);
      exitActiveTour({});
    }).not.toThrow();
  });
});
