// @vitest-environment happy-dom
import { describe, expect, test, vi } from "vitest";
import { windowHostId } from "../../src/page-protocol.ts";
import type { AppClass } from "../../src/page/globals.ts";
import { createWindowHost } from "../../src/page/windows.ts";

/** Just enough of ApplicationV2's lifecycle to exercise our subclass. */
class FakeApp {
  static made: FakeApp[] = [];
  element = document.createElement("div");
  readonly options: object;
  constructor(options: object) {
    this.options = options;
    FakeApp.made.push(this);
  }
  async _renderHTML(): Promise<unknown> {
    return Promise.resolve(undefined);
  }
  _replaceHTML(_r: unknown, _c: HTMLElement): void {
    // ApplicationV2's own does nothing.
  }
  _onClose(_o: unknown): void {
    // ApplicationV2's own does nothing.
  }
  async render(): Promise<this> {
    const result = await this._renderHTML();
    this._replaceHTML(result, this.element);
    this._replaceHTML(result, this.element);
    return this;
  }
  close(): Promise<this> {
    this._onClose({});
    return Promise.resolve(this);
  }
  bringToFront = vi.fn();
}

const spec = {
  id: "sheet-1",
  title: "Strahd",
  icon: "fa-solid fa-globe",
  width: 500,
  height: 700,
  left: 900,
};

describe("Foundry windows from the page world", () => {
  test("opens a window with an empty host for the UI, then reports ready", async () => {
    const post = vi.fn();
    const host = createWindowHost(FakeApp as unknown as AppClass, post);
    await host.open(spec);
    const app = FakeApp.made.at(-1)!;
    expect(app.options).toEqual({
      id: "ml-window-sheet-1",
      classes: ["ml-window"],
      window: { title: "Strahd", icon: "fa-solid fa-globe", resizable: true },
      position: { width: 500, height: 700, left: 900 },
    });
    expect(
      app.element.querySelectorAll(`#${windowHostId("sheet-1")}`),
    ).toHaveLength(1);
    expect(post).toHaveBeenCalledWith({
      type: "WINDOW_READY",
      payload: { id: "sheet-1" },
    });
    await host.open(spec);
    expect(app.bringToFront).toHaveBeenCalled();
  });

  test("our windows can't be detached into a separate browser window", async () => {
    const host = createWindowHost(FakeApp as unknown as AppClass, vi.fn());
    await host.open({ ...spec, id: "sheet-detach" });
    const app = FakeApp.made.at(-1) as unknown as { _canDetach(): boolean };
    expect(app._canDetach()).toBe(false);
  });

  test("Foundry's close is reported once; our close is not echoed", async () => {
    const post = vi.fn();
    const host = createWindowHost(FakeApp as unknown as AppClass, post);
    await host.open(spec);
    await FakeApp.made.at(-1)!.close();
    expect(post).toHaveBeenLastCalledWith({
      type: "WINDOW_CLOSED",
      payload: { id: "sheet-1" },
    });
    await host.open({ ...spec, id: "sheet-2" });
    post.mockClear();
    await host.close("sheet-2");
    await host.close("sheet-2");
    expect(post).not.toHaveBeenCalled();
  });
});

describe("closing while Foundry is still rendering", () => {
  test("waits for the render, closes, and never reports ready", async () => {
    let finish = (): void => undefined;
    class SlowApp extends FakeApp {
      override async render(): Promise<this> {
        await new Promise<void>((r) => {
          finish = r;
        });
        return super.render();
      }
    }
    const post = vi.fn();
    const host = createWindowHost(SlowApp as unknown as AppClass, post);
    const opening = host.open({ ...spec, id: "slow-1" });
    const app = FakeApp.made.at(-1)!;
    const close = vi.spyOn(app, "close");
    const closing = host.close("slow-1");
    expect(close).not.toHaveBeenCalled();
    finish();
    await Promise.all([opening, closing]);
    expect(close).toHaveBeenCalledOnce();
    expect(post).not.toHaveBeenCalled();
  });
});
