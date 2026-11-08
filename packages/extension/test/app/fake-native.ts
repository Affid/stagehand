// A stand-in for the app's native side in unit tests: the port WebView
// injects (`postMessage(string)`, `onmessage`), with handlers per request
// type, and requests from native to the page. Strings only, as WebView
// carries them.
import type { NativePort } from "../../src/app/bridge.ts";
import { REQUEST_SCHEMAS } from "../../src/app/native-requests.ts";

/** Contract requests are checked against their payload schema, as native will. */
const checks = (type: string, payload: unknown): string | undefined => {
  const schema = (
    REQUEST_SCHEMAS as Record<
      string,
      { safeParse(v: unknown): { success: boolean } }
    >
  )[type];
  return schema && !schema.safeParse(payload).success
    ? `Bad payload for ${type}`
    : undefined;
};

type Handler = (payload: unknown) => unknown;

export interface FakeNative {
  readonly port: NativePort;
  /** What the page asked native for, in order: [type, payload]. */
  readonly asked: [string, unknown][];
  /** Answers requests of this type; a throw is sent back as an error. */
  on(type: string, fn: Handler): void;
  /** Sends a raw string to the page, as a broken or hostile sender might. */
  raw(message: unknown): void;
  /** Asks the page, as native asks the background ("route"). */
  request(type: string, payload?: unknown): Promise<unknown>;
  /** Raw strings the page sent, replies included. */
  readonly sent: string[];
}

const later = (fn: () => void): void => {
  setTimeout(fn, 0);
};

export function fakeNative(): FakeNative {
  const handlers = new Map<string, Handler>();
  const asked: [string, unknown][] = [];
  const sent: string[] = [];
  const waiting = new Map<string, (reply: Record<string, unknown>) => void>();
  let next = 0;
  const port: NativePort = {
    onmessage: null,
    postMessage(message: string) {
      sent.push(message);
      const m = JSON.parse(message) as Record<string, unknown>;
      if (typeof m.re === "string") {
        waiting.get(m.re)?.(m);
        waiting.delete(m.re);
        return;
      }
      asked.push([m.type as string, m.payload]);
      const reply = (body: object): void => {
        later(() => {
          port.onmessage?.({
            data: JSON.stringify({ v: 1, re: m.id, ...body }),
          });
        });
      };
      const bad = checks(m.type as string, m.payload);
      if (bad) {
        reply({ ok: false, error: bad });
        return;
      }
      const fn = handlers.get(m.type as string);
      if (!fn) {
        reply({ ok: false, error: `No native handler for ${String(m.type)}` });
        return;
      }
      Promise.resolve()
        .then(() => fn(m.payload))
        .then(
          (result: unknown) => {
            reply({ ok: true, result });
          },
          (error: unknown) => {
            reply({
              ok: false,
              error: error instanceof Error ? error.message : String(error),
            });
          },
        );
    },
  };
  return {
    port,
    asked,
    sent,
    on(type, fn) {
      handlers.set(type, fn);
    },
    raw(message) {
      port.onmessage?.({ data: message });
    },
    request(type, payload) {
      next += 1;
      const id = `n${String(next)}`;
      return new Promise((resolve, reject) => {
        waiting.set(id, (reply) => {
          if (reply.ok === true) resolve(reply.result);
          else reject(new Error(String(reply.error)));
        });
        later(() => {
          port.onmessage?.({
            data: JSON.stringify({ v: 1, id, type, payload }),
          });
        });
      });
    },
  };
}
