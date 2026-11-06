import { describe, expect, test, vi } from "vitest";
import { parseConfigReply } from "../../src/page-config.ts";
import { runConfig } from "../../src/page/config.ts";

function foundry(over: { post?: () => Promise<unknown> } = {}) {
  let source: Record<string, unknown> = {
    adminUsername: null,
    adminPassword: "hash",
    passwordSalt: "salt",
    sslKey: "key",
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
    telemetry: undefined,
    hotReload: false,
    deleteNEDB: false,
    compressStatic: true,
    compressSocket: true,
    updateChannel: "stable",
  };
  const serverSettings = {
    get _source() {
      return source;
    },
    toObject: () => ({ ...source }),
    updateSource: vi.fn((changes: Record<string, unknown>) => {
      if (changes.port === 1) throw new Error("port: invalid");
      const diff = Object.fromEntries(
        Object.entries(changes).filter(([k, v]) => source[k] !== v),
      );
      source = { ...source, ...changes };
      return diff;
    }),
  };
  const post = vi.fn(over.post ?? (() => Promise.resolve({ restart: true })));
  const page = {
    game: {
      worlds: {
        values: () => [{ id: "w", title: "Strahd" }].values(),
        get: () => undefined,
      },
      serverSettings,
      post,
      data: {
        options: { adminPassword: "hash" },
        languages: [
          {
            id: "en",
            label: "English",
            modules: [{ id: "core", label: "Core" }],
          },
        ],
      },
      i18n: { lang: "en", localize: (k: string) => `L:${k}` },
    },
    CONST: {
      CSS_THEMES: { dark: "THEME.dark", light: "THEME.light" },
      SOFTWARE_UPDATE_CHANNELS: { stable: "CHANNEL.stable" },
    },
  };
  return { page, post, serverSettings };
}

describe("Foundry's configuration through its own model", () => {
  test("reads an allow-list: no password hash, salt or keys; says if a password is set", async () => {
    const f = foundry();
    const r = await runConfig(f.page, {
      requestId: "r1",
      op: "read",
      changes: {},
    });
    expect(r.settings).toMatchObject({
      port: 30000,
      passwordSet: true,
      telemetry: false,
      dataPath: "/data",
    });
    expect(JSON.stringify(r)).not.toMatch(/hash|salt|"key"/);
    expect(r.choices?.worlds).toEqual([{ value: "w", label: "Strahd" }]);
    expect(r.choices?.languages).toEqual([
      { value: "en.core", label: "English - Core" },
    ]);
    expect(r.choices?.themes).toEqual([
      { value: "dark", label: "L:THEME.dark" },
      { value: "light", label: "L:THEME.light" },
    ]);
    expect(parseConfigReply({ requestId: "r1", ...r })).toBeTruthy();
  });

  test("saves only what changed, through adminConfigure, and says a restart is needed", async () => {
    const f = foundry();
    const r = await runConfig(f.page, {
      requestId: "r1",
      op: "save",
      changes: { port: 30001, upnp: true },
    });
    expect(f.post).toHaveBeenCalledWith({
      action: "adminConfigure",
      config: { port: 30001 },
    });
    expect(r.restart).toBe(true);
    expect(r.settings?.port).toBe(30001);
  });

  test("a value Foundry rejects is never sent; a failed save restores the model", async () => {
    const f = foundry();
    const bad = await runConfig(f.page, {
      requestId: "r1",
      op: "save",
      changes: { port: 1 },
    });
    expect(bad.error).toMatch(/port/);
    expect(f.post).not.toHaveBeenCalled();
    const failing = foundry({ post: () => Promise.reject(new Error("403")) });
    const r = await runConfig(failing.page, {
      requestId: "r1",
      op: "save",
      changes: { port: 30002 },
    });
    expect(r.error).toMatch(/403/);
    expect(failing.serverSettings._source.port).toBe(30000);
  });
});
