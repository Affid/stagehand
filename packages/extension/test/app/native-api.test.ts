// The native rules the Kotlin app mirrors (Android plan, "Native rules").
import { describe, expect, it } from "vitest";
import {
  externalAllowed,
  foundryVersion,
  mayAskAsServer,
  savableServerOrigin,
  statusUrl,
} from "../../src/app/native-api.ts";

const SERVER = "http://localhost:30000";
const PREFIXED = "https://vtt.example.com/foundry";

describe("mayAskAsServer", () => {
  it("allows a saved server's Setup and game pages", () => {
    expect(mayAskAsServer(`${SERVER}/setup`, [SERVER])).toBe(true);
    expect(mayAskAsServer(`${SERVER}/setup?x=1`, [SERVER])).toBe(true);
    expect(mayAskAsServer(`${SERVER}/game`, [SERVER])).toBe(true);
    expect(mayAskAsServer(`${PREFIXED}/setup`, [SERVER, PREFIXED])).toBe(true);
  });

  it("refuses the server's other pages and other servers", () => {
    expect(mayAskAsServer(`${SERVER}/join`, [SERVER])).toBe(false);
    expect(mayAskAsServer(`${SERVER}/setupx`, [SERVER])).toBe(false);
    expect(mayAskAsServer(`${PREFIXED}/setup`, [SERVER])).toBe(false);
    expect(mayAskAsServer("https://vtt.example.com/setup", [PREFIXED])).toBe(
      false,
    );
    expect(mayAskAsServer(`${SERVER}/setup`, [])).toBe(false);
  });

  it("refuses odd paths before comparing", () => {
    for (const path of [
      "/setup/%2e%2e/x",
      "/setup/../game",
      "/setup//x",
      "/setup/a\\b",
    ])
      expect(mayAskAsServer(`${SERVER}${path}`, [SERVER])).toBe(false);
  });

  it("refuses what isn't an http(s) URL", () => {
    expect(mayAskAsServer("about:blank", [SERVER])).toBe(false);
    expect(mayAskAsServer("not a url", [SERVER])).toBe(false);
    expect(
      mayAskAsServer("https://appassets.androidplatform.net/home.html", [
        SERVER,
      ]),
    ).toBe(false);
  });
});

describe("externalAllowed", () => {
  it("opens http(s) links with a host elsewhere", () => {
    expect(externalAllowed("https://foundryvtt.com/releases/14.370", [])).toBe(
      true,
    );
    expect(externalAllowed("http://example.com/x?y#z", [SERVER])).toBe(true);
  });

  it("keeps the server's own pages in the app", () => {
    expect(externalAllowed(`${SERVER}/setup`, [SERVER])).toBe(false);
    expect(externalAllowed("HTTP://LOCALHOST:30000/x", [SERVER])).toBe(false);
  });

  it("refuses other schemes, user info and long links", () => {
    expect(externalAllowed("javascript:alert(1)", [])).toBe(false);
    expect(externalAllowed("file:///etc/passwd", [])).toBe(false);
    expect(externalAllowed("intent://x#Intent;end", [])).toBe(false);
    expect(externalAllowed("https://user:pw@example.com/", [])).toBe(false);
    expect(externalAllowed("https://user@example.com/", [])).toBe(false);
    expect(externalAllowed("https:example.com", [])).toBe(false);
    expect(externalAllowed(`https://example.com/${"a".repeat(4096)}`, [])).toBe(
      false,
    );
  });
});

describe("savableServerOrigin", () => {
  it("reads a server's origin from its match pattern", () => {
    expect(savableServerOrigin("http://localhost:30000/*")).toBe(SERVER);
    expect(savableServerOrigin("https://VTT.Example.com:443/*")).toBe(
      "https://vtt.example.com",
    );
  });

  it("never saves the app's own origin or foundryvtt.com", () => {
    expect(
      savableServerOrigin("https://appassets.androidplatform.net/*"),
    ).toBeUndefined();
    expect(savableServerOrigin("https://foundryvtt.com/*")).toBeUndefined();
    expect(savableServerOrigin("https://api.foundryvtt.com/*")).toBeUndefined();
    expect(savableServerOrigin("https://foundryvtt.com./*")).toBeUndefined();
    expect(
      savableServerOrigin("https://appassets.androidplatform.net./*"),
    ).toBeUndefined();
  });

  it("refuses what isn't a server pattern", () => {
    expect(savableServerOrigin("http://localhost:30000/x/*")).toBeUndefined();
    expect(savableServerOrigin("ftp://localhost/*")).toBeUndefined();
    expect(savableServerOrigin("http://u@localhost/*")).toBeUndefined();
  });
});

describe("server.check: statusUrl and foundryVersion (app's home)", () => {
  it("reads a server's /api/status, route prefix kept", () => {
    expect(statusUrl(SERVER)).toBe(`${SERVER}/api/status`);
    expect(statusUrl(PREFIXED)).toBe(`${PREFIXED}/api/status`);
  });

  it("never reads the app's own origin, foundryvtt.com or a non-URL", () => {
    expect(statusUrl("https://appassets.androidplatform.net")).toBeUndefined();
    expect(statusUrl("https://api.foundryvtt.com")).toBeUndefined();
    expect(statusUrl("localhost:30000")).toBeUndefined();
  });

  it("takes only a plain version string from a JSON object", () => {
    expect(foundryVersion('{"active":false,"version":"14.370"}')).toBe(
      "14.370",
    );
    expect(foundryVersion('{"version":14.37}')).toBeUndefined();
    expect(foundryVersion('{"version":"<b>1</b>"}')).toBeUndefined();
    expect(foundryVersion('["14.370"]')).toBeUndefined();
    expect(foundryVersion("null")).toBeUndefined();
    expect(foundryVersion("<html>")).toBeUndefined();
  });
});
