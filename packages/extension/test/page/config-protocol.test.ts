import { describe, expect, test } from "vitest";
import { parseConfigReply, parseConfigRequest } from "../../src/page-config.ts";

describe("configuration requests", () => {
  test("read, or save known settings with the right types", () => {
    expect(parseConfigRequest({ requestId: "r1", op: "read" })).toEqual({
      requestId: "r1",
      op: "read",
      changes: {},
    });
    expect(
      parseConfigRequest({
        requestId: "r1",
        op: "save",
        changes: { port: 30001, upnp: false, world: null, language: "en.core" },
      })?.changes,
    ).toEqual({ port: 30001, upnp: false, world: null, language: "en.core" });
  });

  test("refuses secrets, unknown keys, wrong types and empty saves", () => {
    const save = (changes: unknown) =>
      parseConfigRequest({ requestId: "r1", op: "save", changes });
    for (const changes of [
      {},
      { adminPassword: "x" },
      { passwordSalt: "x" },
      { sslKey: "x" },
      { dataPath: "/tmp" },
      { port: "30000" },
      { port: 70000 },
      { upnp: "yes" },
      { language: "" },
      { hostname: "x".repeat(300) },
      null,
    ])
      expect(save(changes)).toBeUndefined();
    expect(parseConfigRequest({ requestId: "r1", op: "wipe" })).toBeUndefined();
    expect(
      parseConfigRequest({ requestId: "r1", op: "read", changes: { port: 1 } }),
    ).toBeUndefined();
  });
});

describe("configuration replies", () => {
  const settings = {
    adminUsername: null,
    passwordSet: true,
    world: null,
    language: "en.core",
    cssTheme: "dark",
    port: 30000,
    upnp: true,
    hostname: null,
    routePrefix: null,
    proxyPort: null,
    proxySSL: false,
    dataPath: "/data",
    noBackups: false,
    telemetry: false,
    hotReload: false,
    deleteNEDB: false,
    compressStatic: true,
    compressSocket: true,
    updateChannel: "stable",
  };
  const choices = {
    worlds: [{ value: "w", label: "W" }],
    languages: [{ value: "en.core", label: "English" }],
    themes: [{ value: "dark", label: "Dark" }],
    channels: [{ value: "stable", label: "Stable" }],
  };

  test("settings and their choices, checked", () => {
    expect(parseConfigReply({ requestId: "r1", settings, choices })).toEqual({
      requestId: "r1",
      settings,
      choices,
    });
    expect(
      parseConfigReply({ requestId: "r1", restart: true, settings, choices }),
    ).toMatchObject({ restart: true });
  });

  test("never carries a secret, and refuses malformed settings", () => {
    expect(
      parseConfigReply({
        requestId: "r1",
        settings: { ...settings, adminPassword: "hash" },
        choices,
      }),
    ).toBeUndefined();
    expect(
      parseConfigReply({
        requestId: "r1",
        settings: { ...settings, port: "x" },
        choices,
      }),
    ).toBeUndefined();
    expect(parseConfigReply({ requestId: "r1", error: "nope" })).toEqual({
      requestId: "r1",
      error: "nope",
    });
  });
});
