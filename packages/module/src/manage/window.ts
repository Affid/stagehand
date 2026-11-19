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
const MARGIN = 10;
const HOST_CLASS = "stagehand-host";

export interface ModuleWindow extends GuardedWindow {
  setPosition(position: { width: number; left: number }): unknown;
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
  return true;
}

/** The window closed: its view goes too, and the next one tries again. */
export function closeWindow(app: object): void {
  const state = states.get(app);
  if (!state) return;
  dropView(state);
  state.failed = false;
}
