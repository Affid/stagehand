// The app's one line to its native side (Android plan, phase 2). WebView
// injects an object into each of the app's pages (`addWebMessageListener`):
// `postMessage(string)` sends to native, `onmessage` hears native. Both
// sides send requests and answer them over it:
//
//   request  {"v":1,"id":"…","type":"kv.get","payload":{…}}
//   reply    {"v":1,"re":"…","ok":true,"result":…}
//            {"v":1,"re":"…","ok":false,"error":"…"}
//
// Strings only, JSON, at most MAX_MESSAGE_CHARS. What each page may ask is
// in native-api.ts; native checks it again and attaches who asked.
import { logError } from "@module-library/shared/log";
import { newRequestId } from "@module-library/shared/protocol";
import { z } from "zod";

/** The object WebView injects into the page. */
export interface NativePort {
  postMessage(message: string): void;
  onmessage: ((event: { readonly data: unknown }) => void) | null;
}

/** A library export of a few thousand modules stays well below this. */
export const MAX_MESSAGE_CHARS = 8_000_000;
/** Native's own work (storage, a fetch) answers within this. */
export const DEFAULT_TIMEOUT_MS = 30_000;
const MAX_ERROR_CHARS = 2000;
const WIRE_VERSION = 1;

const RequestSchema = z.object({
  v: z.literal(WIRE_VERSION),
  id: z.string().min(1).max(64),
  type: z.string().min(1).max(64),
  payload: z.unknown().optional(),
});

const ReplySchema = z.discriminatedUnion("ok", [
  z.object({
    v: z.literal(WIRE_VERSION),
    re: z.string().min(1).max(64),
    ok: z.literal(true),
    result: z.unknown().optional(),
  }),
  z.object({
    v: z.literal(WIRE_VERSION),
    re: z.string().min(1).max(64),
    ok: z.literal(false),
    // Native's long errors (a stack trace) are cut, not refused (review).
    error: z.string().transform((e) => e.slice(0, MAX_ERROR_CHARS)),
  }),
]);

export interface RequestOptions {
  /** Milliseconds; null waits as long as the user needs (a dialog, a picker). */
  readonly timeoutMs?: number | null;
}

export type NativeHandler = (payload: unknown) => unknown;

export interface NativeBridge {
  /** Asks native; resolves its result or rejects with its error. */
  request<T = unknown>(
    type: string,
    payload?: unknown,
    options?: RequestOptions,
  ): Promise<T>;
  /** Answers native's requests of this type (the background: "route"). */
  handle(type: string, fn: NativeHandler): void;
}

export interface BridgeOptions {
  readonly timeoutMs?: number;
}

const errorText = (error: unknown): string =>
  (error instanceof Error ? error.message : String(error)).slice(
    0,
    MAX_ERROR_CHARS,
  );

/**
 * The globals the bridge uses, taken when it is made: the app makes it at
 * document start, before any page script could replace them.
 */
function captureGlobals() {
  return {
    parse: JSON.parse.bind(JSON) as (text: string) => unknown,
    stringify: JSON.stringify.bind(JSON) as (value: unknown) => string,
    setTimer: globalThis.setTimeout.bind(globalThis),
    clearTimer: globalThis.clearTimeout.bind(globalThis),
  };
}

interface Waiting {
  readonly resolve: (value: unknown) => void;
  readonly reject: (error: Error) => void;
}

/** One bridge's state: its globals, sender and open requests. */
interface Ctx {
  readonly g: ReturnType<typeof captureGlobals>;
  readonly send: (message: object) => void;
  readonly waiting: Map<string, Waiting>;
  readonly handlers: Map<string, NativeHandler>;
  readonly timeoutMs: number;
}

/** Runs a request's handler and sends its result or error back. */
function answer(ctx: Ctx, re: string, run: () => unknown): void {
  const fail = (error: unknown): void => {
    ctx.send({ v: WIRE_VERSION, re, ok: false, error: errorText(error) });
  };
  Promise.resolve()
    .then(run)
    .then((result: unknown) => {
      // A result that can't be sent (too large, not JSON) still gets an
      // answer, so native never waits for nothing (review).
      try {
        ctx.send({ v: WIRE_VERSION, re, ok: true, result });
      } catch (error: unknown) {
        fail(error);
      }
    }, fail)
    .catch((error: unknown) => {
      logError("native bridge", error);
    });
}

function onIncoming(ctx: Ctx, data: unknown): void {
  const m = readMessage(data, ctx.g.parse, (re, error) => {
    // A reply we can't read still ends the request it names (review).
    ctx.waiting.get(re)?.reject(error);
  });
  if (!m) return;
  if ("re" in m) {
    const w = ctx.waiting.get(m.re);
    if (!w) return;
    ctx.waiting.delete(m.re);
    if (m.ok) w.resolve(m.result);
    else w.reject(new Error(m.error));
    return;
  }
  const fn = ctx.handlers.get(m.type);
  answer(ctx, m.id, () => {
    if (!fn) throw new Error(`Unknown request ${m.type}`);
    return fn(m.payload);
  });
}

function request<T>(
  ctx: Ctx,
  type: string,
  payload: unknown,
  opts: RequestOptions,
): Promise<T> {
  const id = newRequestId();
  const timeoutMs =
    opts.timeoutMs === undefined ? ctx.timeoutMs : opts.timeoutMs;
  return new Promise<T>((resolve, reject) => {
    const timer =
      timeoutMs === null
        ? undefined
        : ctx.g.setTimer(() => {
            ctx.waiting.delete(id);
            reject(new Error(`Native did not answer ${type} in time`));
          }, timeoutMs);
    const settle = (): void => {
      ctx.waiting.delete(id);
      if (timer !== undefined) ctx.g.clearTimer(timer);
    };
    ctx.waiting.set(id, {
      resolve: (value) => {
        settle();
        resolve(value as T);
      },
      reject: (error) => {
        settle();
        reject(error);
      },
    });
    try {
      ctx.send({ v: WIRE_VERSION, id, type, payload });
    } catch (error: unknown) {
      settle();
      reject(error instanceof Error ? error : new Error(String(error)));
    }
  });
}

export function createNativeBridge(
  port: NativePort,
  options: BridgeOptions = {},
): NativeBridge {
  const g = captureGlobals();
  const post = port.postMessage.bind(port);
  const ctx: Ctx = {
    g,
    send: (message) => {
      const text = g.stringify(message);
      if (text.length > MAX_MESSAGE_CHARS)
        throw new Error("Message to native is too large");
      post(text);
    },
    waiting: new Map(),
    handlers: new Map(),
    timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  };
  port.onmessage = (event) => {
    onIncoming(ctx, event.data);
  };
  return {
    request: (type, payload, opts = {}) => request(ctx, type, payload, opts),
    handle(type, fn) {
      ctx.handlers.set(type, fn);
    },
  };
}

type Incoming = z.infer<typeof RequestSchema> | z.infer<typeof ReplySchema>;

/** A request or reply of the wire format, or undefined (logged). */
function readMessage(
  data: unknown,
  parse: (text: string) => unknown,
  onBadReply: (re: string, error: Error) => void,
): Incoming | undefined {
  if (typeof data !== "string" || data.length > MAX_MESSAGE_CHARS) {
    logError("native bridge", new Error("Not a message from native"));
    return undefined;
  }
  let raw: unknown;
  try {
    raw = parse(data);
  } catch (error: unknown) {
    logError("native bridge", error);
    return undefined;
  }
  const isReply = typeof raw === "object" && raw !== null && "re" in raw;
  const parsed = isReply
    ? ReplySchema.safeParse(raw)
    : RequestSchema.safeParse(raw);
  if (!parsed.success) {
    logError("native bridge", parsed.error);
    const re: unknown = isReply ? (raw as { re: unknown }).re : undefined;
    if (typeof re === "string")
      onBadReply(re, new Error("Native's answer didn't check out"));
    return undefined;
  }
  return parsed.data;
}
