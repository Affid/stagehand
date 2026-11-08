// The harness's message router, playing native's bridge by the plan's
// "Native rules": each WebView's role is known by its Page (never by the
// message or its URL alone); the sender is the page's last committed
// navigation (a page script's replaceState doesn't change it); messages are
// capped, checked against the wire format and the request's payload schema;
// server requests only from a saved server's Setup or game page; replies
// only from the background, for requests native sent it. Runtime messages
// go to the background as `route`, held until it says background.ready.
import type { Frame, Page } from "@playwright/test";
import { MAX_MESSAGE_CHARS } from "../../packages/extension/src/app/bridge.ts";
import {
  type Caller,
  CALLER_REQUESTS,
  mayAskAsServer,
  READY,
  ROUTE,
  ROUTE_TIMEOUT_MS,
} from "../../packages/extension/src/app/native-api.ts";
import { REQUEST_SCHEMAS } from "../../packages/extension/src/app/native-requests.ts";
import type { NativeSim } from "./native.ts";

interface Wire {
  readonly v?: unknown;
  readonly id?: unknown;
  readonly re?: unknown;
  readonly type?: unknown;
  readonly payload?: unknown;
  readonly ok?: unknown;
  readonly result?: unknown;
  readonly error?: unknown;
}

/** A payload schema, as far as the relay uses it. */
interface Checker {
  safeParse(value: unknown): { success: boolean };
}

interface Pending {
  readonly resolve: (reply: Wire) => void;
  readonly reject: (error: Error) => void;
  readonly timer: ReturnType<typeof setTimeout>;
}

const READY_TIMEOUT_MS = 15_000;

/** Native's request to the background, through its fake bridge object. */
async function deliver(page: Page, message: object): Promise<void> {
  await page.evaluate((m) => {
    (
      globalThis as { __mlHarnessDeliver?: (m: string) => void }
    ).__mlHarnessDeliver?.(m);
  }, JSON.stringify(message));
}

export class Relay {
  private readonly native: NativeSim;
  private readonly appId: string;
  private background: Page | undefined;
  private home: Page | undefined;
  /** Each page's last committed navigation (not its live URL). */
  private readonly committed = new WeakMap<Page, string>();
  private next = 0;
  private readonly waiting = new Map<string, Pending>();
  private isReady = false;
  private readyWaiters: (() => void)[] = [];

  constructor(native: NativeSim, appId: string) {
    this.native = native;
    this.appId = appId;
  }

  /** Follows a page's committed navigations (a document request). */
  watch(page: Page): void {
    page.on("request", (request) => {
      if (
        !request.isNavigationRequest() ||
        request.frame() !== page.mainFrame()
      )
        return;
      this.committed.set(page, request.url());
      // A new background document serves `route` only once it says so.
      if (page === this.background) this.isReady = false;
    });
  }

  setBackground(page: Page): void {
    this.background = page;
  }

  setHome(page: Page): void {
    this.home = page;
  }

  /** Resolves once the background said background.ready. */
  ready(): Promise<void> {
    if (this.isReady) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const waiter = (): void => {
        clearTimeout(timer);
        resolve();
      };
      const timer = setTimeout(() => {
        this.readyWaiters = this.readyWaiters.filter((w) => w !== waiter);
        reject(new Error("The background never said it was ready"));
      }, READY_TIMEOUT_MS);
      this.readyWaiters.push(waiter);
    });
  }

  /** Ends every pending request (the harness closing). */
  dispose(): void {
    for (const [id, p] of this.waiting) {
      clearTimeout(p.timer);
      p.reject(new Error("The app closed"));
      this.waiting.delete(id);
    }
  }

  private callerOf(page: Page, url: string): Caller | undefined {
    if (page === this.background) return "background";
    if (page === this.home) return "home";
    const saved = [...new Set(this.native.scripts.values())].filter((s) =>
      this.native.origins.has(new URL(s).origin),
    );
    return mayAskAsServer(url, saved) ? "server" : undefined;
  }

  /**
   * A message from a page's bridge object; resolves with native's reply,
   * which the fake bridge hands to the page (the binding's own answer:
   * quicker than a separate evaluate into a busy game page, where Foundry's
   * loading held one back past the companion's 1 s HELLO wait).
   */
  async fromPage(
    page: Page,
    frame: Frame,
    text: string,
  ): Promise<string | undefined> {
    if (frame !== page.mainFrame() || text.length > MAX_MESSAGE_CHARS)
      return undefined;
    let m: Wire;
    try {
      m = JSON.parse(text) as Wire;
    } catch {
      return undefined;
    }
    if (m.v !== 1) return undefined;
    if (typeof m.re === "string") {
      if (page === this.background) this.settle(m.re, m);
      return undefined;
    }
    if (typeof m.id !== "string" || typeof m.type !== "string")
      return undefined;
    // No committed navigation seen: no server rights (fail closed).
    const url = this.committed.get(page) ?? "about:blank";
    const caller = this.callerOf(page, url);
    const reply = await this.answer(caller, url, m.id, m.type, m.payload);
    // Only to the document that asked: after a navigation nobody is there
    // to answer, as on Android.
    const same = !this.committed.has(page) || this.committed.get(page) === url;
    return same ? JSON.stringify(reply) : undefined;
  }

  private settle(id: string, reply: Wire): void {
    const p = this.waiting.get(id);
    if (!p) return;
    this.waiting.delete(id);
    clearTimeout(p.timer);
    p.resolve(reply);
  }

  private async answer(
    caller: Caller | undefined,
    url: string,
    id: string,
    type: string,
    payload: unknown,
  ): Promise<object> {
    try {
      if (!caller || !CALLER_REQUESTS[caller].includes(type))
        throw new Error(`${type} isn't allowed from this page`);
      const schema = (REQUEST_SCHEMAS as Record<string, Checker | undefined>)[
        type
      ];
      if (!schema?.safeParse(payload).success)
        throw new Error(`Bad payload for ${type}`);
      const result = await this.run(caller, url, type, payload);
      return { v: 1, re: id, ok: true, result: result ?? null };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return { v: 1, re: id, ok: false, error: message };
    }
  }

  private run(
    caller: Caller,
    url: string,
    type: string,
    payload: unknown,
  ): unknown {
    if (type === READY) {
      this.isReady = true;
      const waiters = this.readyWaiters;
      this.readyWaiters = [];
      waiters.forEach((fn) => {
        fn();
      });
      return null;
    }
    const p = (payload ?? {}) as Record<string, unknown>;
    if (type === "runtime.send")
      return this.route(p.message, {
        id: this.appId,
        url,
        fromTab: caller === "server",
      });
    const handler = this.native.handlers()[type];
    if (!handler) throw new Error(`Native doesn't know ${type}`);
    return handler(p);
  }

  /** Native's `route` to the background, held until it is ready. */
  private async route(message: unknown, sender: object): Promise<unknown> {
    await this.ready();
    const background = this.background;
    if (!background) throw new Error("No background page");
    this.next += 1;
    const id = `native-${String(this.next)}`;
    const reply = await new Promise<Wire>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.waiting.delete(id);
        reject(new Error("The background did not answer in time"));
      }, ROUTE_TIMEOUT_MS);
      this.waiting.set(id, { resolve, reject, timer });
      deliver(background, {
        v: 1,
        id,
        type: ROUTE,
        payload: { message, sender },
      }).catch((error: unknown) => {
        // The background is gone or reloading: fail now, not in 2 minutes.
        this.waiting.delete(id);
        clearTimeout(timer);
        reject(error instanceof Error ? error : new Error(String(error)));
      });
    });
    if (reply.ok !== true) throw new Error(String(reply.error));
    return reply.result;
  }
}
