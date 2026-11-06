import { describe, expect, test, vi } from "vitest";
import { watchProgress } from "../../src/page/progress.ts";

describe("watching Foundry's progress and lock", () => {
  test("Foundry still draws its own; we get a bounded copy, once", () => {
    const onProgress = vi.fn();
    const toggleLock = vi.fn();
    const setupPackages = { onProgress, toggleLock };
    const post = vi.fn();
    const page = { ui: { setupPackages } };
    watchProgress(page, post);
    watchProgress(page, post);
    setupPackages.onProgress({
      action: "createBackup",
      id: "w",
      pct: 10,
      junk: 1,
    });
    setupPackages.toggleLock(true, { message: "Backing up" });
    expect(onProgress).toHaveBeenCalledTimes(1);
    expect(toggleLock).toHaveBeenCalledWith(true, { message: "Backing up" });
    expect(post.mock.calls).toEqual([
      [
        {
          type: "PROGRESS",
          payload: { action: "createBackup", id: "w", pct: 10 },
        },
      ],
      [{ type: "LOCK", payload: { locked: true, message: "Backing up" } }],
    ]);
  });

  test("without Foundry's Setup apps it does nothing", () => {
    expect(() => {
      watchProgress({}, vi.fn());
    }).not.toThrow();
  });
});
