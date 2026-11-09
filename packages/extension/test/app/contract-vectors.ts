// The native rules as cases with the TypeScript's own answers, for the
// Kotlin app's tests (packages/android: ContractVectorsTest), so the two
// sides can't drift. Written by `node scripts/android/contract-vectors.ts`;
// contract-vectors.test.ts fails when the file is out of date.
import { REMOTE_CONFIG_URL } from "../../src/adapters/config.ts";
import { MAX_MESSAGE_CHARS } from "../../src/app/bridge.ts";
import {
  externalAllowed,
  fetchAllowed,
  foundryVersion,
  type FetchPurpose,
  isServerPage,
  mayAskAsServer,
  savableServerOrigin,
  statusUrl,
  wrapForServer,
} from "../../src/app/native-api.ts";
import {
  REQUEST_SCHEMAS,
  type RequestType,
} from "../../src/app/native-requests.ts";
import { RELEASES_URL } from "../../src/background/releases.ts";

export const VECTORS_PATH =
  "packages/android/app/src/test/resources/contract-vectors.json";

const SERVER = "http://localhost:30000";
const PREFIXED = "https://vtt.example.com/foundry";
const LAN = "http://192.168.178.25:30000";

const FETCH_URLS = [
  `${RELEASES_URL}14.370`,
  `${RELEASES_URL}14.370-beta.2`,
  RELEASES_URL,
  `${RELEASES_URL}14.370?x=1`,
  `${RELEASES_URL}14.370#notes`,
  `${RELEASES_URL}../x`,
  `${RELEASES_URL}..`,
  `${RELEASES_URL}a/b`,
  `${RELEASES_URL}14.370\n`,
  `${RELEASES_URL}14%2e370`,
  "https://foundryvtt.com/releases",
  "http://foundryvtt.com/releases/14.370",
  "https://foundryvtt.com.evil.com/releases/1",
  REMOTE_CONFIG_URL,
  `${REMOTE_CONFIG_URL}?x`,
  `${REMOTE_CONFIG_URL}\n`,
  REMOTE_CONFIG_URL.toUpperCase(),
  "https://evil.example/",
];

const PAGE_URLS = [
  `${SERVER}/setup`,
  `${SERVER}/setup?x=1#y`,
  `${SERVER}/setup/`,
  `${SERVER}/setup/more`,
  `${SERVER}/setupx`,
  `${SERVER}/game`,
  `${SERVER}/game?x`,
  `${SERVER}/join`,
  `${SERVER}/auth`,
  `${SERVER}/`,
  `${SERVER}/foundry/setup`,
  "http://localhost:30001/setup",
  "https://localhost:30000/setup",
  `${PREFIXED}/setup`,
  `${PREFIXED}/game`,
  `${PREFIXED}/join`,
  "https://vtt.example.com/setup",
  "https://vtt.example.com/foundryx/setup",
  `${LAN}/setup`,
  `${SERVER}/setup/%2e%2e/game`,
  `${SERVER}/setup/..`,
  `${SERVER}/setup//x`,
  `${SERVER}/setup/a%20b`,
  "about:blank",
  "https://appassets.androidplatform.net/home.html",
  "data:text/html,x",
];

const SERVER_SETS: readonly (readonly string[])[] = [
  [],
  [SERVER],
  [PREFIXED],
  [SERVER, PREFIXED, LAN],
];

const EXTERNAL_URLS = [
  "https://foundryvtt.com/releases/14.370",
  "https://foundryvtt.com/packages/dnd5e",
  "http://example.com/x?y=1#z",
  "HTTPS://Example.COM/x",
  "https://example.com:8443/",
  `${SERVER}/setup`,
  "http://localhost:30000/other",
  "HTTP://LOCALHOST:30000/x",
  "http://localhost:30001/",
  `${LAN}/x`,
  "https://vtt.example.com/foundry/setup",
  "javascript:alert(1)",
  "file:///etc/passwd",
  "intent://x#Intent;end",
  "mailto:a@example.com",
  "https://user:pw@example.com/",
  "https://user@example.com/",
  "https:example.com",
  "https:/example.com",
  "//example.com/x",
  "https://",
  "",
  `https://example.com/${"a".repeat(4070)}`,
  `https://example.com/${"a".repeat(4080)}`,
];

const ORIGIN_SETS: readonly (readonly string[])[] = [
  [],
  [SERVER, "https://vtt.example.com", LAN],
];

const PATTERNS = [
  "http://localhost:30000/*",
  "https://vtt.example.com/*",
  "https://VTT.Example.com/*",
  "https://vtt.example.com:443/*",
  "http://vtt.example.com:80/*",
  "http://192.168.178.25:30000/*",
  "http://[::1]:30000/*",
  "https://appassets.androidplatform.net/*",
  "https://foundryvtt.com/*",
  "https://api.foundryvtt.com/*",
  "https://notfoundryvtt.com/*",
  "https://foundryvtt.com./*",
  "https://www.foundryvtt.com./*",
  "https://appassets.androidplatform.net./*",
  "http://localhost:65535/*",
  "http://localhost:65536/*",
  "http://localhost:99999/*",
  "http://localhost:30000/x/*",
  "http://localhost:30000/",
  "http://localhost:30000/*\n",
  "ftp://localhost/*",
  "http://u@localhost/*",
  "http://local host/*",
  "http://local host/*",
  "",
];

const long = (n: number): string => "k".repeat(n);

/** Payloads per request type: valid and not. */
const PAYLOADS: readonly (readonly [RequestType, unknown])[] = [
  ["runtime.send", { message: { kind: "x" } }],
  ["runtime.send", {}],
  ["runtime.send", { message: null, extra: 1 }],
  ["runtime.send", null],
  ["runtime.send", []],
  ["runtime.send", "x"],
  ["files.save", { fileName: "library.json", text: "{}" }],
  ["files.save", { fileName: "", text: "" }],
  ["files.save", { fileName: "a/b.json", text: "" }],
  ["files.save", { fileName: "a\\b.json", text: "" }],
  ["files.save", { fileName: "a\u0000b", text: "" }],
  ["files.save", { fileName: long(200), text: "" }],
  ["files.save", { fileName: long(201), text: "" }],
  ["files.save", { fileName: "x.json" }],
  ["files.save", { fileName: "x.json", text: 5 }],
  ["files.open", {}],
  ["files.open", { any: true }],
  ["files.open", null],
  ["confirm", { text: "Delete the folder?" }],
  ["confirm", { text: "" }],
  ["confirm", { text: long(2000) }],
  ["confirm", { text: long(2001) }],
  ["confirm", { text: 1 }],
  ["openExternal", { url: "https://example.com/" }],
  ["openExternal", { url: long(4096) }],
  ["openExternal", { url: long(4097) }],
  ["openExternal", {}],
  ["kv.get", { key: "servers" }],
  ["kv.get", { key: "" }],
  ["kv.get", { key: long(200) }],
  ["kv.get", { key: long(201) }],
  ["kv.get", { key: 3 }],
  ["kv.set", { key: "servers", value: [1, "a", { b: null }] }],
  ["kv.set", { key: "servers" }],
  ["kv.set", { key: "servers", value: null }],
  ["kv.set", { value: 1 }],
  ["scripts.registered", { ids: [] }],
  ["scripts.registered", { ids: ["ml-a"] }],
  ["scripts.registered", { ids: [""] }],
  ["scripts.registered", { ids: [long(300)] }],
  ["scripts.registered", { ids: [long(301)] }],
  ["scripts.registered", { ids: Array.from({ length: 50 }, () => "a") }],
  ["scripts.registered", { ids: Array.from({ length: 51 }, () => "a") }],
  ["scripts.registered", { ids: [1] }],
  ["scripts.registered", { ids: "a" }],
  ["scripts.register", { server: SERVER, ids: ["a"] }],
  ["scripts.register", { server: PREFIXED, ids: ["a"] }],
  ["scripts.register", { server: `${SERVER}/`, ids: ["a"] }],
  ["scripts.register", { server: `${SERVER}/a/b`, ids: ["a"] }],
  ["scripts.register", { server: `${SERVER}/a%20b`, ids: ["a"] }],
  ["scripts.register", { server: `${SERVER}/a*`, ids: ["a"] }],
  ["scripts.register", { server: `${SERVER}/a b`, ids: ["a"] }],
  ["scripts.register", { server: "ftp://localhost", ids: ["a"] }],
  ["scripts.register", { server: "http://u@localhost", ids: ["a"] }],
  ["scripts.register", { server: `${SERVER}\n`, ids: ["a"] }],
  ["scripts.register", { server: SERVER }],
  ["scripts.unregister", { ids: ["a", "b"] }],
  ["scripts.unregister", {}],
  ["permissions.contains", { origin: "http://localhost:30000/*" }],
  ["permissions.contains", { origin: "https://foundryvtt.com/*" }],
  ["permissions.contains", { origin: "http://localhost:30000/x/*" }],
  ["permissions.contains", { origin: "http://localhost:30000/*\n" }],
  ["permissions.contains", { origin: "http://local host/*" }],
  ["permissions.contains", { origin: "http://local﻿host/*" }],
  ["permissions.contains", { origin: "http://local\u0085host/*" }],
  ["permissions.contains", { origin: "http://local host/*" }],
  ["permissions.request", { origin: "http://192.168.178.25:30000/*" }],
  ["permissions.request", { origin: "localhost:30000/*" }],
  ["permissions.remove", { origin: "http://localhost:30000/*" }],
  ["permissions.remove", { origin: 1 }],
  ["fetch", { url: REMOTE_CONFIG_URL, purpose: "config" }],
  ["fetch", { url: RELEASES_URL, purpose: "release" }],
  ["fetch", { url: RELEASES_URL, purpose: "other" }],
  ["fetch", { url: long(4097), purpose: "release" }],
  ["fetch", { purpose: "release" }],
  ["server.check", { server: LAN }],
  ["server.check", { server: PREFIXED }],
  ["server.check", { server: `${SERVER}/` }],
  ["server.check", { server: "192.168.178.25:30000" }],
  ["server.check", { server: "http://u@localhost" }],
  ["server.check", {}],
  [
    "password.ask",
    { purpose: "close", world: "Strahd", people: 2, wrong: false },
  ],
  [
    "password.ask",
    {
      purpose: "join",
      world: "Strahd",
      user: "Gamemaster",
      people: 0,
      wrong: true,
    },
  ],
  [
    "password.ask",
    { purpose: "open", world: "Strahd", people: 0, wrong: false },
  ],
  ["password.ask", { purpose: "close", world: "", people: 0, wrong: false }],
  [
    "password.ask",
    { purpose: "close", world: long(201), people: 0, wrong: false },
  ],
  [
    "password.ask",
    { purpose: "join", world: "S", user: "", people: 0, wrong: false },
  ],
  ["password.ask", { purpose: "close", world: "S", people: -1, wrong: false }],
  ["password.ask", { purpose: "close", world: "S", people: 1.5, wrong: false }],
  ["password.ask", { purpose: "close", world: "S", people: "2", wrong: false }],
  ["password.ask", { purpose: "close", world: "S", people: 0, wrong: "no" }],
  ["password.ask", { purpose: "close", world: "S", people: 0 }],
  ["home.open", {}],
  ["background.ready", {}],
  ["background.ready", { x: 1 }],
];

const STATUS_SERVERS = [
  SERVER,
  PREFIXED,
  LAN,
  "http://[::1]:30000",
  "https://appassets.androidplatform.net",
  "https://foundryvtt.com",
  "https://www.foundryvtt.com.",
  "http://localhost:30000/a/b",
];

const STATUS_BODIES = [
  '{"active":false,"version":"14.370"}',
  '{"active":true,"version":"13.351-beta.2","world":"w"}',
  '{"version":14.37}',
  '{"version":""}',
  '{"version":"14 370"}',
  '{"version":"<b>14</b>"}',
  `{"version":"${"1".repeat(40)}"}`,
  `{"version":"${"1".repeat(41)}"}`,
  '{"active":false}',
  '["14.370"]',
  '"14.370"',
  "null",
  "<html>Foundry</html>",
  "",
  ' {"version":"14.370"} ',
];

const WRAPS = [
  ["console.log(ML_APP_SERVER);", SERVER],
  ["x", PREFIXED],
  ["a\nb", 'http://h:1/p"q\\r'],
  ["", "http://h/ é\u0001"],
];

const isCanonical = (url: string): boolean => {
  try {
    return new URL(url).href === url;
  } catch {
    return true;
  }
};

const cross = <A, B>(as: readonly A[], bs: readonly B[]): [A, B][] =>
  as.flatMap((a) => bs.map((b): [A, B] => [a, b]));

export function contractVectors(): object {
  const purposes: FetchPurpose[] = ["release", "config"];
  return {
    maxMessageChars: MAX_MESSAGE_CHARS,
    fetchAllowed: FETCH_URLS.flatMap((url) =>
      cross(purposes, [true, false]).map(([purpose, releaseHistory]) => ({
        url,
        purpose,
        releaseHistory,
        allowed: fetchAllowed(url, purpose, releaseHistory),
      })),
    ),
    // Canonical URLs only, as WebView commits them: TypeScript's URL parser
    // tidies the others (%2e%2e), which native refuses before comparing.
    isServerPage: cross(PAGE_URLS.filter(isCanonical), [
      SERVER,
      PREFIXED,
    ]).flatMap(([href, server]) =>
      ["/setup", "/game"].map((page) => ({
        href,
        server,
        page,
        result: isServerPage(href, server, page),
      })),
    ),
    mayAskAsServer: cross(PAGE_URLS, SERVER_SETS).map(([url, servers]) => ({
      url,
      servers,
      result: mayAskAsServer(url, servers),
    })),
    externalAllowed: cross(EXTERNAL_URLS, ORIGIN_SETS).map(
      ([url, origins]) => ({
        url,
        origins,
        allowed: externalAllowed(url, origins),
      }),
    ),
    savableServerOrigin: PATTERNS.map((pattern) => ({
      pattern,
      origin: savableServerOrigin(pattern) ?? null,
    })),
    payloads: PAYLOADS.map(([type, payload]) => ({
      type,
      payload,
      valid: REQUEST_SCHEMAS[type].safeParse(payload).success,
    })),
    statusUrl: STATUS_SERVERS.map((server) => ({
      server,
      url: statusUrl(server) ?? null,
    })),
    foundryVersion: STATUS_BODIES.map((body) => ({
      body,
      version: foundryVersion(body) ?? null,
    })),
    wrapForServer: WRAPS.map(([script = "", server = ""]) => ({
      script,
      server,
      out: wrapForServer(script, server),
    })),
  };
}

/** The file's text: stable, one case per line group. */
export function vectorsText(): string {
  return `${JSON.stringify(contractVectors(), null, 1)}\n`;
}
