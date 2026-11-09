// Android's Back on the home screen: the top open sheet closes first;
// native goes on (out of the app, or back to the server) when none is
// open (Android plan, phase 6).
import { createContext } from "preact";
import { useContext, useLayoutEffect, useRef } from "preact/hooks";

export interface BackStack {
  /** Closes the top sheet; false when none is open. */
  readonly press: () => boolean;
  /** Adds a closer; the returned function takes it off again. */
  readonly push: (close: () => void) => () => void;
}

export function createBackStack(): BackStack {
  let closers: readonly (() => void)[] = [];
  return {
    press() {
      const top = closers.at(-1);
      if (!top) return false;
      top();
      return true;
    },
    push(close) {
      closers = [...closers, close];
      return () => {
        closers = closers.filter((c) => c !== close);
      };
    },
  };
}

export const BackContext = createContext<BackStack | undefined>(undefined);

/**
 * While mounted, Back calls `close` (the latest one given). Pushed once, as
 * the sheet appears, and taken off as it goes: a new `close` each render
 * doesn't move it.
 */
export function useBackClose(close: () => void): void {
  const stack = useContext(BackContext);
  const latest = useRef(close);
  latest.current = close;
  useLayoutEffect(
    () =>
      stack?.push(() => {
        latest.current();
      }),
    [stack],
  );
}
