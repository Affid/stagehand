// Keeps Foundry's own save from running while our view is in the window
// (docs/IN-WORLD-LIBRARY-PLAN.md, "Keeping Foundry's save safe"). Foundry's
// handler saves the form's checkboxes as the whole module list. A submit is
// caught before it (capture phase), and the window's own handler, which
// app.submit() calls, is wrapped. Each window's form options are its own
// copy (ApplicationV2 deep-clones them), so the wrap stays there. While the
// window shows Foundry's own list, Foundry saves as usual.

export interface GuardedWindow {
  readonly options: { readonly form?: { handler?: unknown } };
}

export interface Guard {
  /** Our view is in the window now. */
  readonly active: () => boolean;
  readonly review: () => void;
}

/** Guarded windows, and whether their handler is wrapped too. */
const guarded = new WeakMap<object, boolean>();

function wrapHandler(app: GuardedWindow, guard: Guard): boolean {
  const form = app.options.form;
  const original = form?.handler;
  if (!form || typeof original !== "function" || Object.isFrozen(form))
    return false;
  try {
    form.handler = function (this: unknown, ...args: unknown[]): unknown {
      if (!guard.active())
        return Reflect.apply(original, this, args) as unknown;
      guard.review();
      return Promise.resolve();
    };
    return true;
  } catch {
    return false;
  }
}

/** Guards once per window; true when the window's handler is wrapped too. */
export function guardSave(
  app: GuardedWindow,
  element: HTMLElement,
  guard: Guard,
): boolean {
  const known = guarded.get(app);
  if (known !== undefined) return known;
  element.addEventListener(
    "submit",
    (event) => {
      if (!guard.active()) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      guard.review();
    },
    { capture: true },
  );
  const wrapped = wrapHandler(app, guard);
  guarded.set(app, wrapped);
  return wrapped;
}
