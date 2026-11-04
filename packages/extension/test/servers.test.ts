import { describe, expect, test } from "vitest";
import {
  contentScriptsFor,
  normalizeServerUrl,
  pathWithinServer,
  permissionOrigin,
  serverIdOfPage,
} from "../src/servers.ts";

describe("normalizeServerUrl", () => {
  test("keeps scheme, host and port, and drops a trailing slash", () => {
    expect(normalizeServerUrl("http://localhost:30000/")).toBe(
      "http://localhost:30000",
    );
  });

  test("keeps a route prefix", () => {
    expect(normalizeServerUrl("https://vtt.example.com/foundry/")).toBe(
      "https://vtt.example.com/foundry",
    );
  });

  test("drops the query and hash", () => {
    expect(normalizeServerUrl("http://h:1/x?y=1#z")).toBe("http://h:1/x");
  });

  test.each(["ftp://h/", "not a url", "file:///tmp"])("rejects %s", (url) => {
    expect(() => normalizeServerUrl(url)).toThrow(/http/);
  });
});

describe("permissionOrigin", () => {
  test("asks for the origin only, with the port", () => {
    expect(permissionOrigin("https://vtt.example.com:8443/foundry")).toBe(
      "https://vtt.example.com:8443/*",
    );
  });
});

describe("contentScriptsFor", () => {
  test("registers the Setup scripts in both worlds and the bridge on /game", () => {
    const scripts = contentScriptsFor("http://localhost:30000");
    expect(scripts.map((s) => [s.js, s.world, s.matches])).toEqual([
      [["setup-main.js"], "MAIN", ["http://localhost:30000/setup*"]],
      [["setup-ui.js"], "ISOLATED", ["http://localhost:30000/setup*"]],
      [["game-bridge.js"], "ISOLATED", ["http://localhost:30000/game*"]],
    ]);
  });

  test("gives each server its own script ids", () => {
    const a = contentScriptsFor("http://localhost:30000").map((s) => s.id);
    const b = contentScriptsFor("http://localhost:30001").map((s) => s.id);
    expect(a.filter((id) => b.includes(id))).toEqual([]);
  });
});

describe("pathWithinServer", () => {
  test("keeps the leading slash for a server without a route prefix", () => {
    expect(
      pathWithinServer(
        "http://localhost:30000/setup",
        "http://localhost:30000",
      ),
    ).toBe("/setup");
  });

  test("strips a route prefix", () => {
    expect(
      pathWithinServer(
        "https://h.example/foundry/game",
        "https://h.example/foundry",
      ),
    ).toBe("/game");
  });
});

describe("serverIdOfPage", () => {
  const servers = ["http://localhost:30000", "https://h.example/foundry"];

  test("finds the server a page belongs to", () => {
    expect(serverIdOfPage("https://h.example/foundry/game", servers)).toBe(
      "https://h.example/foundry",
    );
  });

  test("does not match another port or a lookalike prefix", () => {
    expect(serverIdOfPage("http://localhost:30001/game", servers)).toBe(
      undefined,
    );
    expect(serverIdOfPage("https://h.example/foundry2/game", servers)).toBe(
      undefined,
    );
  });
});
