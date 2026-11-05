// Registered Foundry servers: their ids, permissions and content scripts.

/** A server id is its base URL: origin plus route prefix, no trailing slash. */
export type ServerId = string;

export function normalizeServerUrl(input: string): ServerId {
  let url: URL;
  try {
    url = new URL(input);
  } catch (error: unknown) {
    throw new Error(`Not a URL; expected http(s)://host[:port]`, {
      cause: error,
    });
  }
  if (url.protocol !== "http:" && url.protocol !== "https:")
    throw new Error(`Only http and https servers are supported`);
  return `${url.origin}${url.pathname.replace(/\/+$/, "")}`;
}

/** The host permission to request: the server's origin, port included. */
export function permissionOrigin(server: ServerId): string {
  return `${new URL(server).origin}/*`;
}

export interface ContentScript {
  readonly id: string;
  readonly matches: readonly string[];
  readonly js: readonly string[];
  readonly css?: readonly string[];
  readonly world: "MAIN" | "ISOLATED";
  readonly runAt: "document_start" | "document_idle";
}

const scriptId = (kind: string, server: ServerId): string =>
  `ml-${kind}-${server.replace(/[^a-z0-9]/gi, "_")}`;

export function contentScriptsFor(server: ServerId): readonly ContentScript[] {
  return [
    {
      id: scriptId("setup-main", server),
      matches: [`${server}/setup*`],
      js: ["setup-main.js"],
      world: "MAIN",
      runAt: "document_idle",
    },
    {
      id: scriptId("setup-ui", server),
      matches: [`${server}/setup*`],
      js: ["setup-ui.js"],
      css: ["setup-ui.css"],
      world: "ISOLATED",
      runAt: "document_idle",
    },
    {
      id: scriptId("bridge", server),
      matches: [`${server}/game*`],
      js: ["game-bridge.js"],
      world: "ISOLATED",
      // Listening before the companion module's `ready` hook runs.
      runAt: "document_start",
    },
  ];
}

/** A page's path below its server's route prefix, e.g. "/setup". */
export function pathWithinServer(pageUrl: string, server: ServerId): string {
  const prefix = server.slice(new URL(server).origin.length);
  return new URL(pageUrl).pathname.slice(prefix.length);
}

/** The registered server a page URL belongs to, if any. */
export function serverIdOfPage(
  pageUrl: string,
  servers: readonly ServerId[],
): ServerId | undefined {
  const page = new URL(pageUrl);
  const path = `${page.origin}${page.pathname}`;
  return servers.find((s) => path === s || path.startsWith(`${s}/`));
}
