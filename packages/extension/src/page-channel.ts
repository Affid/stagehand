// The line between the Setup page's two halves: `setup-main` (Foundry's
// objects) and `setup-ui` (our page). Each side checks what arrives
// (page-protocol.ts); the channel only carries a type and a payload.
//
// - The extension runs the halves in two JavaScript worlds of one page, so
//   they talk with window messages (any page script can post those too).
// - The app runs both in one injected closure: a private pair that no page
//   script can reach (Android plan, "What the app replaces").
import { logError } from "@module-library/shared/log";
import { isEnvelope, makeEnvelope } from "@module-library/shared/protocol";

export type ChannelListener = (type: string, payload: unknown) => void;

export interface PageChannel {
  /** Sends to the other side; the payload must be copyable as a window message's. */
  send(type: string, payload: unknown): void;
  /** Hears the other side; returns a function that stops listening. */
  listen(fn: ChannelListener): () => void;
}

type Side = "setup-main" | "setup-ui";

/** Window messages between the two worlds of one page (the extension). */
export function windowChannel(win: Window, me: Side, peer: Side): PageChannel {
  return {
    send(type, payload) {
      win.postMessage(makeEnvelope(me, type, payload), win.location.origin);
    },
    listen(fn) {
      const onMessage = (event: MessageEvent<unknown>): void => {
        if (event.source !== win || event.origin !== win.location.origin)
          return;
        if (!isEnvelope(event.data, peer)) return;
        fn(event.data.type, event.data.payload);
      };
      win.addEventListener("message", onMessage);
      return () => {
        win.removeEventListener("message", onMessage);
      };
    },
  };
}

/**
 * The globals a pair uses, taken once when it is made. In the app the pair
 * shares the page's world, so a page script could later replace
 * `structuredClone` or `setTimeout` to forge, replay or read messages
 * (security review); the app makes its pair at document start, before any
 * page script runs.
 */
interface Captured {
  readonly clone: <T>(value: T) => T;
  readonly defer: (fn: () => void) => void;
  readonly copyOf: (set: Set<ChannelListener>) => ChannelListener[];
}

function capture(): Captured {
  const clone = globalThis.structuredClone.bind(globalThis);
  const timeout = globalThis.setTimeout.bind(globalThis);
  const from = Array.from.bind(Array);
  return {
    clone: (value) => clone(value),
    defer: (fn) => {
      timeout(fn, 0);
    },
    copyOf: (set) => from(set),
  };
}

function end(
  own: Set<ChannelListener>,
  other: Set<ChannelListener>,
  g: Captured,
): PageChannel {
  return {
    send(type, payload) {
      // A copy, as a window message would carry: neither side can change
      // the other's objects, and what can't be copied fails here.
      const copy = g.clone(payload);
      g.defer(() => {
        for (const fn of g.copyOf(other)) {
          try {
            fn(type, copy);
          } catch (error: unknown) {
            logError("page channel", error);
          }
        }
      });
    },
    listen(fn) {
      own.add(fn);
      return () => {
        own.delete(fn);
      };
    },
  };
}

/** Two ends of a private channel in one closure (the app). */
export function localChannelPair(): readonly [PageChannel, PageChannel] {
  const first = new Set<ChannelListener>();
  const second = new Set<ChannelListener>();
  const g = capture();
  return [end(first, second, g), end(second, first, g)];
}
