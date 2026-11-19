// Module Management's take-over (docs/IN-WORLD-LIBRARY-PLAN.md), on each
// render: for a Gamemaster with the library view on and a library on the
// server, guard Foundry's save first, size the window, put a host in place
// of Foundry's list, and draw the view, loaded only now. A redraw by
// Foundry replaces the previous view.
import type { Library } from "@stagehand/shared/library/schema";
import { logError } from "@stagehand/shared/log";
import { type GuardedWindow, guardSave } from "./guard.ts";
import { takesOver } from "./take-over.ts";

/** The cards' width: three columns and the module panel (the mockup). */
export const VIEW_WIDTH = 1160;
/** A resizable window opens between these heights (owner, 2026-11-19). */
export const MIN_HEIGHT = 720;
export const MAX_HEIGHT = 880;
const MARGIN = 10;
const HOST_CLASS = "stagehand-host";

export interface ModuleWindow extends GuardedWindow {
  readonly options: GuardedWindow["options"] & {
    /** Resizable: the companion made Module Management so (register.ts). */
    readonly window?: { readonly resizable?: boolean };
    /** This window's own copy (ApplicationV2 deep-clones its options). */
    readonly position?: { height?: number | "auto" };
  };
  readonly position: { readonly top: number };
  setPosition(position: {
    readonly width?: number;
    readonly height?: number;
    readonly left?: number;
    readonly top?: number;
  }): unknown;
  /** Foundry draws the window again (its own list, when we stand aside). */
  render(): Promise<unknown>;
}

export interface Mounted {
  readonly unmount: () => void;
}

export interface WindowDeps {
  readonly isGM: boolean;
  /** Foundry's major version. */
  readonly generation: number;
  readonly settingOn: () => boolean;
  readonly library: () => Promise<Library | undefined>;
  readonly loadCss: () => void;
  /** Draws the view into the host; the view gives its review to `setReview`. */
  readonly mount: (
    host: HTMLElement,
    library: Library,
    setReview: (review: () => void) => void,
  ) => Promise<Mounted>;
  readonly viewportWidth: () => number;
  readonly viewportHeight: () => number;
  /** Says the view couldn't load (Foundry's list is back). */
  readonly viewFailed: () => void;
}

interface WindowState {
  review?: (() => void) | undefined;
  mounted?: Mounted | undefined;
  /** Counts renders: a load that finishes after a newer render is dropped. */
  render: number;
  /** The view couldn't load: Foundry's list stays until the window closes. */
  failed: boolean;
  /** Stops keeping the window on the screen. */
  unwatch?: (() => void) | undefined;
}

const states = new WeakMap<object, WindowState>();

function stateOf(app: object): WindowState {
  const known = states.get(app);
  if (known) return known;
  const fresh: WindowState = { render: 0, failed: false };
  states.set(app, fresh);
  return fresh;
}

/** Foundry drew the window again: the previous view is gone from it. */
function dropView(state: WindowState): void {
  state.mounted?.unmount();
  state.mounted = undefined;
  state.review = undefined;
  state.unwatch?.();
  state.unwatch = undefined;
}

/**
 * Keeps the window's bottom on the screen (owner, 2026-11-19): Foundry
 * placed it for its own shorter list, and its height follows the view's
 * (a minimum, and the screen's height at most, in view.css). It moves up
 * only as far as it must, now and whenever its height changes.
 */
function keepOnScreen(
  deps: WindowDeps,
  app: ModuleWindow,
  element: HTMLElement,
): () => void {
  const fit = (): void => {
    const height = element.offsetHeight;
    const room = deps.viewportHeight();
    if (app.position.top + height <= room - MARGIN) return;
    app.setPosition({ top: Math.max(MARGIN, room - height - MARGIN) });
  };
  fit();
  if (typeof ResizeObserver === "undefined") return () => undefined;
  const observer = new ResizeObserver(fit);
  observer.observe(element);
  return () => {
    observer.disconnect();
  };
}

async function eligible(
  deps: WindowDeps,
  element: HTMLElement,
): Promise<{ library: Library; content: HTMLElement } | undefined> {
  if (!deps.isGM || !deps.settingOn()) return undefined;
  const library = await deps.library();
  const content = element.querySelector<HTMLElement>(".window-content");
  const ok = takesOver({
    isGM: deps.isGM,
    settingOn: true,
    generation: deps.generation,
    hasLibrary: library !== undefined,
    hasContent: content !== null,
  });
  return ok && library && content ? { library, content } : undefined;
}

function place(
  deps: WindowDeps,
  app: ModuleWindow,
  firstRender: boolean,
): void {
  if (!firstRender) return;
  const width = Math.min(VIEW_WIDTH, deps.viewportWidth() - 2 * MARGIN);
  const left = Math.max(MARGIN, (deps.viewportWidth() - width) / 2);
  app.setPosition({ width, left });
}

/** Our host is out, and Foundry draws its own list again. */
function standAside(app: ModuleWindow, element: HTMLElement): void {
  element.querySelector(`.${HOST_CLASS}`)?.remove();
  element.classList.remove("stagehand-cards");
  app.render().catch((error: unknown) => {
    logError("module view", error);
  });
}

async function show(
  deps: WindowDeps,
  state: WindowState,
  render: number,
  content: HTMLElement,
  library: Library,
): Promise<Mounted> {
  deps.loadCss();
  const host = document.createElement("div");
  host.className = HOST_CLASS;
  content.replaceChildren(host);
  return deps.mount(host, library, (review) => {
    if (render === state.render) state.review = review;
  });
}

function guard(
  app: ModuleWindow,
  element: HTMLElement,
  state: WindowState,
): void {
  const wrapped = guardSave(app, element, {
    active: () => element.querySelector(`.${HOST_CLASS}`) !== null,
    // Before the view has loaded, a save does nothing.
    review: () => state.review?.(),
  });
  if (!wrapped)
    logError(
      "module view",
      "Module Management's save handler couldn't be wrapped",
    );
}

/**
 * A resizable window opens once at its content's height, 720 to 880 px
 * and inside the screen; after that its size is the user's (owner,
 * 2026-11-19: a full-screen window was too big, and it couldn't be resized).
 */
function sizeToContent(
  deps: WindowDeps,
  app: ModuleWindow,
  element: HTMLElement,
): void {
  const before = element.style.height;
  element.style.height = "auto";
  const natural = element.offsetHeight;
  element.style.height = before;
  const room = deps.viewportHeight() - 2 * MARGIN;
  const height = Math.max(
    Math.min(MIN_HEIGHT, room),
    Math.min(natural, MAX_HEIGHT, room),
  );
  const top = Math.max(
    MARGIN,
    Math.min(app.position.top, deps.viewportHeight() - height - MARGIN),
  );
  app.setPosition({ height, top });
  // Foundry's redraws re-apply an "auto" height from the window's options,
  // which resizable windows don't measure again: this window has its own.
  const position = app.options.position;
  if (position && !Object.isFrozen(position)) position.height = height;
}

/** Sized once when resizable; else kept on the screen as it grows. */
function fitWindow(
  deps: WindowDeps,
  app: ModuleWindow,
  element: HTMLElement,
  firstRender: boolean,
): (() => void) | undefined {
  if (app.options.window?.resizable !== true)
    return keepOnScreen(deps, app, element);
  element.classList.add("stagehand-sized");
  if (firstRender) sizeToContent(deps, app, element);
  return undefined;
}

export async function takeOverWindow(
  deps: WindowDeps,
  app: ModuleWindow,
  element: HTMLElement,
  firstRender: boolean,
): Promise<boolean> {
  const state = stateOf(app);
  const render = ++state.render;
  dropView(state);
  if (state.failed) return false;
  const found = await eligible(deps, element);
  if (render !== state.render) return false;
  if (!found) {
    if (element.querySelector(`.${HOST_CLASS}`)) standAside(app, element);
    return false;
  }
  guard(app, element, state);
  element.classList.add("stagehand-cards");
  place(deps, app, firstRender);
  let mounted: Mounted;
  try {
    mounted = await show(deps, state, render, found.content, found.library);
  } catch (error: unknown) {
    logError("module view", error);
    state.failed = true;
    deps.viewFailed();
    standAside(app, element);
    return false;
  }
  if (render !== state.render) {
    mounted.unmount();
    return false;
  }
  state.mounted = mounted;
  state.unwatch = fitWindow(deps, app, element, firstRender);
  return true;
}

/** The window closed: its view goes too, and the next one tries again. */
export function closeWindow(app: object): void {
  const state = states.get(app);
  if (!state) return;
  dropView(state);
  state.failed = false;
}
