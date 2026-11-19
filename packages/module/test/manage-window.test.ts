// @vitest-environment happy-dom
// Taking over Module Management on each render (docs/IN-WORLD-LIBRARY-PLAN.md):
// only for a Gamemaster with the view on and a library; the save guarded
// before Foundry's list is replaced; the view loaded only then; a redraw
// replaces the previous view.
import { emptyLibrary } from "@stagehand/shared/library/schema";
import { describe, expect, it, vi } from "vitest";
import {
  closeWindow,
  takeOverWindow,
  type WindowDeps,
} from "../src/manage/window.ts";

function fakeApp() {
  const element = document.createElement("form");
  element.innerHTML = `<header class="window-header"></header>
    <section class="window-content"><input type="checkbox" name="a"></section>`;
  document.body.append(element);
  const handler = vi.fn();
  const app = {
    options: { form: { handler } },
    position: { top: 250 },
    setPosition: vi.fn((p: { top?: number }) => {
      if (p.top !== undefined) app.position.top = p.top;
    }),
    render: vi.fn(() => Promise.resolve()),
  };
  return { app, element, handler };
}

function deps(over: Partial<WindowDeps> = {}) {
  const unmount = vi.fn();
  const mount = vi.fn(
    (_host: HTMLElement, _lib: unknown, setReview: (r: () => void) => void) => {
      setReview(review);
      return Promise.resolve({ unmount });
    },
  );
  const review = vi.fn();
  const d: WindowDeps = {
    isGM: true,
    generation: 14,
    settingOn: () => true,
    library: () => Promise.resolve(emptyLibrary("s")),
    loadCss: vi.fn(),
    mount,
    viewportWidth: () => 1600,
    viewportHeight: () => 1000,
    viewFailed: vi.fn(),
    ...over,
  };
  return { d, mount, unmount, review };
}

describe("takeOverWindow", () => {
  it("replaces Foundry's list with the view, guarded and wide", async () => {
    // Arrange
    const w = fakeApp();
    const { d, mount } = deps();

    // Act
    const took = await takeOverWindow(d, w.app, w.element, true);

    // Assert
    expect(took).toBe(true);
    expect(
      w.element.querySelector(".window-content .stagehand-host"),
    ).not.toBeNull();
    expect(w.element.querySelector('input[name="a"]')).toBeNull();
    expect(w.element.querySelector(".window-header")).not.toBeNull();
    expect(w.app.setPosition).toHaveBeenCalledWith({ width: 1160, left: 220 });
    expect(w.element.classList.contains("stagehand-cards")).toBe(true);
    expect(mount).toHaveBeenCalledTimes(1);
  });

  it("sends Foundry's save to the view's review once it is in", async () => {
    const w = fakeApp();
    const { d, review } = deps();
    await takeOverWindow(d, w.app, w.element, true);

    w.element.dispatchEvent(new Event("submit", { cancelable: true }));

    expect(review).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["a player", { isGM: false }],
    ["the setting off", { settingOn: () => false }],
    ["no library on the server", { library: () => Promise.resolve(undefined) }],
    ["an unknown Foundry", { generation: 15 }],
  ])("leaves Foundry's window as it is for %s", async (_why, over) => {
    const w = fakeApp();
    const { d, mount } = deps(over);

    const took = await takeOverWindow(d, w.app, w.element, true);

    expect(took).toBe(false);
    expect(w.element.querySelector('input[name="a"]')).not.toBeNull();
    expect(mount).not.toHaveBeenCalled();
  });

  it("sizes the window on its first render only", async () => {
    const w = fakeApp();
    const { d } = deps();

    await takeOverWindow(d, w.app, w.element, false);

    expect(w.app.setPosition).not.toHaveBeenCalled();
  });

  it("fits a narrow screen", async () => {
    const w = fakeApp();
    const { d } = deps({ viewportWidth: () => 1000 });

    await takeOverWindow(d, w.app, w.element, true);

    expect(w.app.setPosition).toHaveBeenCalledWith({ width: 980, left: 10 });
  });

  it("replaces the previous view when Foundry draws the window again", async () => {
    const w = fakeApp();
    const { d, mount, unmount } = deps();
    await takeOverWindow(d, w.app, w.element, true);

    w.element.querySelector(".window-content")!.innerHTML = '<input name="a">';
    await takeOverWindow(d, w.app, w.element, false);

    expect(unmount).toHaveBeenCalledTimes(1);
    expect(mount).toHaveBeenCalledTimes(2);
    expect(w.element.querySelectorAll(".stagehand-host")).toHaveLength(1);
  });

  it("lets Foundry save when a redraw keeps Foundry's list", async () => {
    const w = fakeApp();
    let on = true;
    const { d, review } = deps({ settingOn: () => on });
    await takeOverWindow(d, w.app, w.element, true);

    on = false;
    w.element.querySelector(".window-content")!.innerHTML = '<input name="a">';
    await takeOverWindow(d, w.app, w.element, false);
    w.element.dispatchEvent(new Event("submit", { cancelable: true }));

    expect(review).not.toHaveBeenCalled();
  });

  it("keeps only the newest view when Foundry draws again during a load", async () => {
    // Arrange: the first load finishes after the second
    const w = fakeApp();
    const unmounts = [vi.fn(), vi.fn()];
    let release: () => void = () => undefined;
    const slow = new Promise<void>((resolve) => {
      release = resolve;
    });
    let calls = 0;
    const mount = vi.fn(async () => {
      const i = calls++;
      if (i === 0) await slow;
      return { unmount: unmounts[i]! };
    });
    const { d } = deps({ mount });

    // Act
    const first = takeOverWindow(d, w.app, w.element, true);
    await vi.waitFor(() => {
      expect(mount).toHaveBeenCalledTimes(1);
    });
    await takeOverWindow(d, w.app, w.element, false);
    release();
    const tookFirst = await first;

    // Assert
    expect(tookFirst).toBe(false);
    expect(unmounts[0]).toHaveBeenCalledTimes(1);
    expect(unmounts[1]).not.toHaveBeenCalled();
  });

  it("puts Foundry's list back when the view can't load, and says so", async () => {
    // Arrange: the view's chunk fails to load
    const w = fakeApp();
    const { d } = deps({ mount: () => Promise.reject(new Error("404")) });

    // Act
    const took = await takeOverWindow(d, w.app, w.element, true);
    // Foundry draws its list again, as app.render() asked
    w.element.querySelector(".window-content")!.innerHTML = '<input name="a">';
    const again = await takeOverWindow(d, w.app, w.element, false);

    // Assert
    expect(took).toBe(false);
    expect(d.viewFailed).toHaveBeenCalledTimes(1);
    expect(w.app.render).toHaveBeenCalledTimes(1);
    expect(w.element.classList.contains("stagehand-cards")).toBe(false);
    expect(again).toBe(false);
    expect(w.element.querySelector('input[name="a"]')).not.toBeNull();
  });

  it("doesn't leave an empty view behind when it no longer applies", async () => {
    const w = fakeApp();
    let on = true;
    const { d } = deps({ settingOn: () => on });
    await takeOverWindow(d, w.app, w.element, true);

    on = false;
    await takeOverWindow(d, w.app, w.element, false);

    expect(w.element.querySelector(".stagehand-host")).toBeNull();
    expect(w.element.classList.contains("stagehand-cards")).toBe(false);
    expect(w.app.render).toHaveBeenCalledTimes(1);
  });

  it("moves up, as far as needed, when the view makes it reach below the screen", async () => {
    // Arrange: Foundry placed it for its own short list
    const w = fakeApp();
    Object.defineProperty(w.element, "offsetHeight", { get: () => 900 });
    const { d } = deps();

    // Act
    await takeOverWindow(d, w.app, w.element, true);

    // Assert: 1000 high screen, 10 px margin
    expect(w.app.setPosition).toHaveBeenLastCalledWith({ top: 90 });
  });

  it("stays where it is while it fits", async () => {
    const w = fakeApp();
    Object.defineProperty(w.element, "offsetHeight", { get: () => 600 });
    const { d } = deps();

    await takeOverWindow(d, w.app, w.element, false);

    expect(w.app.setPosition).not.toHaveBeenCalled();
  });

  it("moves up again when it grows, and stops watching when the view goes", async () => {
    // Arrange: a ResizeObserver that reports when asked
    let resized: () => void = () => undefined;
    const disconnect = vi.fn();
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(callback: () => void) {
          resized = callback;
        }
        observe = vi.fn();
        disconnect = disconnect;
      },
    );
    const w = fakeApp();
    let height = 600;
    Object.defineProperty(w.element, "offsetHeight", { get: () => height });
    const { d } = deps();
    await takeOverWindow(d, w.app, w.element, false);

    // Act: the list grows (a filter cleared)
    height = 950;
    resized();
    closeWindow(w.app);

    // Assert
    expect(w.app.setPosition).toHaveBeenLastCalledWith({ top: 40 });
    expect(disconnect).toHaveBeenCalledTimes(1);
    vi.unstubAllGlobals();
  });
});
