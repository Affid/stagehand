// The app's native side, played in Node for the app harness (Android plan,
// phase 2, package 4): what the Kotlin app will do, by the contract in
// packages/extension/src/app/native-api.ts. Storage, saved origins and
// registered scripts live in memory; files, dialogs and links are recorded
// for the tests to read and answer.
import {
  FETCH_MAX_CHARS,
  FETCH_TIMEOUT_MS,
  fetchAllowed,
} from "../../packages/extension/src/app/native-api.ts";
import { FOUNDRY_ORIGIN } from "../../packages/extension/src/background/releases.ts";

/** A payload as it arrived: checked field by field by each handler. */
type Payload = Record<string, unknown>;

/** What native does when a page asks; the result goes back as the reply. */
export type NativeHandler = (payload: Payload) => unknown;

/** Events the harness turns into browser work (inject scripts, open pages). */
export interface NativeEvents {
  /** A server's origin may now get the bridge object. */
  readonly originAllowed: (origin: string) => Promise<void>;
  /** A server's page scripts are to be injected from now on. */
  readonly scriptsRegistered: (server: string) => Promise<void>;
  readonly homeOpened: () => Promise<void>;
}

const text = (p: Payload, key: string): string => {
  const value = p[key];
  if (typeof value !== "string") throw new Error(`${key} must be a string`);
  return value;
};

const strings = (p: Payload, key: string): string[] => {
  const value = p[key];
  if (!Array.isArray(value) || !value.every((v) => typeof v === "string"))
    throw new Error(`${key} must be a list of strings`);
  return value;
};

/** A match pattern's origin: "http://localhost:30000/*" → its origin. */
const patternOrigin = (pattern: string): string =>
  new URL(pattern.replace(/\/\*$/, "/")).origin;

export class NativeSim {
  /** App-private storage, as JSON text (copied like the real store). */
  readonly kv = new Map<string, string>();
  readonly origins = new Set<string>();
  /** Registered script ids and the server each is for. */
  readonly scripts = new Map<string, string>();
  releaseHistory = false;
  /** Files the pages saved, in order. */
  readonly saved: { fileName: string; text: string }[] = [];
  /** Texts the next files.open calls return (empty: no file picked). */
  readonly toOpen: string[] = [];
  /** Questions the pages asked, and the answer the next ones get. */
  readonly confirms: string[] = [];
  confirmAnswer = true;
  /** Links the pages handed over. */
  readonly external: string[] = [];
  homeOpens = 0;
  private confirming = false;

  private readonly events: NativeEvents;

  constructor(events: NativeEvents) {
    this.events = events;
  }

  /** Storage as the background sees it (tests seed and read through it). */
  get(key: string): unknown {
    const raw = this.kv.get(key);
    return raw === undefined ? undefined : (JSON.parse(raw) as unknown);
  }

  set(key: string, value: unknown): void {
    this.kv.set(key, JSON.stringify(value));
  }

  /** Whether a match pattern's site is allowed (a server, or Release history). */
  contains(pattern: string): boolean {
    if (pattern === FOUNDRY_ORIGIN) return this.releaseHistory;
    return this.origins.has(patternOrigin(pattern));
  }

  /** The handlers for every request but runtime.send (the harness relays it). */
  handlers(): Readonly<Record<string, NativeHandler>> {
    return {
      "kv.get": (p) => {
        const raw = this.kv.get(text(p, "key"));
        return raw === undefined ? {} : { value: JSON.parse(raw) as unknown };
      },
      "kv.set": (p) => {
        this.kv.set(text(p, "key"), JSON.stringify(p.value));
        return null;
      },
      "scripts.registered": (p) =>
        strings(p, "ids").filter((id) => this.scripts.has(id)),
      "scripts.register": (p) => this.register(p),
      "scripts.unregister": (p) => {
        strings(p, "ids").forEach((id) => this.scripts.delete(id));
        return null;
      },
      "permissions.contains": (p) => this.contains(text(p, "origin")),
      "permissions.request": (p) => this.request(text(p, "origin")),
      "permissions.remove": (p) => this.remove(text(p, "origin")),
      fetch: (p) => this.fetch(text(p, "url"), text(p, "purpose")),
      "files.save": (p) => {
        this.saved.push({
          fileName: text(p, "fileName"),
          text: text(p, "text"),
        });
        return null;
      },
      "files.open": () => {
        const next = this.toOpen.shift();
        return next === undefined ? {} : { text: next };
      },
      confirm: (p) => this.confirm(text(p, "text")),
      openExternal: (p) => this.openExternal(text(p, "url")),
      "home.open": async () => {
        this.homeOpens += 1;
        await this.events.homeOpened();
        return null;
      },
    };
  }

  /** Injection for a saved origin only; the ids answer scripts.registered. */
  private async register(p: Payload): Promise<null> {
    const server = text(p, "server");
    if (!this.origins.has(new URL(server).origin))
      throw new Error("Not a saved server");
    strings(p, "ids").forEach((id) => this.scripts.set(id, server));
    await this.events.scriptsRegistered(server);
    return null;
  }

  private async request(pattern: string): Promise<boolean> {
    if (pattern === FOUNDRY_ORIGIN) {
      this.releaseHistory = true;
      return true;
    }
    const origin = patternOrigin(pattern);
    this.origins.add(origin);
    await this.events.originAllowed(origin);
    return true;
  }

  private remove(pattern: string): boolean {
    if (pattern === FOUNDRY_ORIGIN) {
      this.releaseHistory = false;
      return true;
    }
    return this.origins.delete(patternOrigin(pattern));
  }

  /** One dialog at a time; a second while one is open is a no. */
  private async confirm(question: string): Promise<{ yes: boolean }> {
    this.confirms.push(question);
    if (this.confirming) return { yes: false };
    this.confirming = true;
    await Promise.resolve();
    this.confirming = false;
    return { yes: this.confirmAnswer };
  }

  private openExternal(url: string): null {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:")
      throw new Error("Only http(s) links open");
    if (this.origins.has(parsed.origin))
      throw new Error("The server's own pages stay in the app");
    this.external.push(url);
    return null;
  }

  /** NativeFetch: the contract's rule, no redirects, no cookies, a size cap. */
  private async fetch(url: string, purpose: string): Promise<{ text: string }> {
    if (purpose !== "release" && purpose !== "config")
      throw new Error(`Unknown purpose ${purpose}`);
    if (!fetchAllowed(url, purpose, this.releaseHistory))
      throw new Error("Not an address the app reads");
    const response = await fetch(url, {
      redirect: "error",
      credentials: "omit",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!response.ok) throw new Error(`HTTP ${String(response.status)}`);
    const body = await response.text();
    if (body.length > FETCH_MAX_CHARS) throw new Error("Too large");
    return { text: body };
  }
}
