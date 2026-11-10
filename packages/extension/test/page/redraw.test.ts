import { describe, expect, test, vi } from "vitest";
import { redrawSetup } from "../../src/page/redraw.ts";

describe("redrawing Foundry's Setup", () => {
  test("renders Setup's packages", async () => {
    const render = vi.fn(() => Promise.resolve());
    await redrawSetup({ ui: { setupPackages: { render } } }, "queue");
    expect(render).toHaveBeenCalled();
  });

  test("a render that throws or rejects is logged, never thrown", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const rejects = (): Promise<unknown> =>
      Promise.reject(new TypeError("RegExp.escape is not a function"));
    const throws = (): unknown => {
      throw new Error("no");
    };
    await expect(
      redrawSetup({ ui: { setupPackages: { render: rejects } } }, "queue"),
    ).resolves.toBeUndefined();
    await expect(
      redrawSetup({ ui: { setupPackages: { render: throws } } }, "world"),
    ).resolves.toBeUndefined();
    expect(log).toHaveBeenCalledTimes(2);
    log.mockRestore();
  });

  test("no Setup on the page: nothing to do", async () => {
    await expect(redrawSetup({}, "queue")).resolves.toBeUndefined();
  });
});
