// Foundry's configuration through its own model, as its window runs it
// (package 7): an allow-list read, saves through adminConfigure (a new admin
// password included), the current password checked with adminPassword, and
// certificates got or released.
import { describe, expect, test, vi } from "vitest";
import { parseConfigReply } from "../../src/page-config.ts";
import { runConfig } from "../../src/page/config.ts";

type Post = (data: Record<string, unknown>) => Promise<unknown>;

function foundry(post?: Post) {
  let source: Record<string, unknown> = {
    adminUsername: null,
    adminPassword: "hash",
    passwordSalt: "salt",
    sslCert: null,
    sslKey: null,
    world: null,
    language: "en.core",
    cssTheme: "dark",
    port: 30000,
    upnp: true,
    unixSocket: null,
    hostname: "secret.example",
    dataPath: "/data",
    awsConfig: null,
    fullscreen: false,
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
  const calls = vi.fn(post ?? (() => Promise.resolve({ restart: true })));
  const options: Record<string, unknown> = {
    adminPassword: "hash",
    port: 30000,
    dataPath: "/data",
    unixSocket: null,
    proxySSL: false,
    noBackups: true,
  };
  const page = {
    game: {
      worlds: {
        values: () => [{ id: "w", title: "Strahd" }].values(),
        get: () => undefined,
      },
      serverSettings,
      post: calls,
      data: {
        options,
        certificate: { managed: false, expired: false, error: null },
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
      CSS_THEMES: { dark: "THEME.dark" },
      SOFTWARE_UPDATE_CHANNELS: { stable: "CHANNEL.stable" },
    },
  };
  return {
    page: page as never,
    post: calls,
    serverSettings,
    options,
    data: page.game.data,
  };
}

const req = (op: string, over: object = {}) =>
  ({ requestId: "r1", op, changes: {}, ...over }) as never;

describe("Foundry's configuration through its own model", () => {
  test("reads Foundry's window's settings, what runs now, and never a secret", async () => {
    const f = foundry();
    const r = await runConfig(f.page, req("read"));
    expect(r.settings).toMatchObject({
      port: 30000,
      dataPath: "/data",
      passwordSet: true,
      noBackups: true,
      proxySSL: false,
      running: { port: 30000, dataPath: "/data", unixSocket: null },
      certificate: { managed: false, expired: false, error: null },
    });
    const text = JSON.stringify(r);
    for (const secret of ["hash", "salt", "secret.example"])
      expect(text).not.toContain(secret);
    expect(parseConfigReply({ requestId: "r1", ...r })?.settings).toBeTruthy();
  });

  test("saves only what changed, with a new password as Foundry's form adds it", async () => {
    const f = foundry();
    const r = await runConfig(
      f.page,
      req("save", { changes: { port: 30001 }, password: "new-secret" }),
    );
    expect(f.post).toHaveBeenCalledWith(
      {
        action: "adminConfigure",
        config: { port: 30001, adminPassword: "new-secret" },
      },
      { notify: false },
    );
    expect(r.restart).toBe(true);
    expect(JSON.stringify(r)).not.toContain("new-secret");
  });

  test("a value Foundry rejects is never sent; a failed save restores the model", async () => {
    const f = foundry(() => Promise.reject(new Error("no")));
    expect(
      (await runConfig(f.page, req("save", { changes: { port: 1 } }))).error,
    ).toContain("port");
    const r = await runConfig(
      f.page,
      req("save", { changes: { port: 30002 } }),
    );
    expect(r.error).toBe("no");
    const after = await runConfig(f.page, req("read"));
    expect(after.settings?.port).toBe(30000);
  });

  test("the current password is checked by Foundry", async () => {
    const f = foundry((d) =>
      Promise.resolve({ result: d.adminPassword === "right" }),
    );
    expect(
      (await runConfig(f.page, req("checkPassword", { password: "right" })))
        .passwordOk,
    ).toBe(true);
    expect(
      (await runConfig(f.page, req("checkPassword", { password: "wrong" })))
        .passwordOk,
    ).toBe(false);
  });

  test("a certificate: Foundry gets one, then saves its files, as its window does", async () => {
    const f = foundry((d) =>
      Promise.resolve(
        d.action === "adminGenerateCertificates"
          ? { method: "letsencrypt", sslCert: "c.pem", sslKey: "k.pem" }
          : {
              restart: true,
              certificate: { managed: true, expired: false, error: null },
            },
      ),
    );
    const r = await runConfig(f.page, req("generateCertificate"));
    expect(f.post).toHaveBeenNthCalledWith(
      2,
      {
        action: "adminConfigure",
        config: { sslCert: "c.pem", sslKey: "k.pem" },
      },
      { notify: false },
    );
    expect(r).toMatchObject({ method: "letsencrypt", restart: true });
    expect(r.settings?.certificate.managed).toBe(true);
  });

  test("releasing clears the files, then tells Foundry", async () => {
    const f = foundry(() =>
      Promise.resolve({
        restart: false,
        certificate: { managed: false, expired: false },
      }),
    );
    await runConfig(f.page, req("releaseCertificate"));
    expect(
      f.post.mock.calls.map((c) => (c[0] as { action: string }).action),
    ).toEqual(["adminConfigure", "adminReleaseCertificate"]);
  });
});
