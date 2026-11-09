// @vitest-environment happy-dom
import { describe, expect, test, vi } from "vitest";
import { createNativeBridge } from "../../src/app/bridge.ts";
import {
  nativeKeyValue,
  nativePorts,
  nativeReleases,
  nativeScripting,
  nativeSend,
  nativeSettingsPlatform,
  serverOfScripts,
} from "../../src/app/platform.ts";
import { REQUEST_SCHEMAS } from "../../src/app/native-requests.ts";
import { fetchAllowed } from "../../src/app/native-api.ts";
import { REMOTE_CONFIG_URL } from "../../src/adapters/config.ts";
import { contentScriptsFor } from "../../src/background/servers.ts";
import { fakeNative } from "./fake-native.ts";

function setup() {
  const native = fakeNative();
  const bridge = createNativeBridge(native.port);
  return { native, bridge };
}

describe("storage over native (KeyValue)", () => {
  test("gets and sets values by key", async () => {
    const { native, bridge } = setup();
    const store = new Map<string, unknown>();
    native.on("kv.get", (p) => {
      const { key } = p as { key: string };
      return store.has(key) ? { value: store.get(key) } : {};
    });
    native.on("kv.set", (p) => {
      const { key, value } = p as { key: string; value: unknown };
      store.set(key, value);
      return null;
    });
    const kv = nativeKeyValue(bridge);
    expect(await kv.get("servers")).toBeUndefined();
    await kv.set("servers", { a: 1 });
    expect(await kv.get("servers")).toEqual({ a: 1 });
  });

  test("a malformed answer is an error, not a value", async () => {
    const { native, bridge } = setup();
    native.on("kv.get", () => "surprise");
    await expect(nativeKeyValue(bridge).get("k")).rejects.toThrow();
    native.on("kv.get", () => null);
    await expect(nativeKeyValue(bridge).get("k")).rejects.toThrow();
  });

  test("a yes or no that is neither is an error, not a quiet no", async () => {
    const { native, bridge } = setup();
    native.on("permissions.contains", () => "true");
    await expect(
      nativeScripting(bridge).hasPermission("http://x/*"),
    ).rejects.toThrow();
  });
});

describe("a server's scripts over native (ScriptingPlatform)", () => {
  test("asks native for permissions and registered scripts", async () => {
    const { native, bridge } = setup();
    native.on("permissions.contains", () => true);
    native.on("scripts.registered", (p) =>
      (p as { ids: string[] }).ids.slice(1),
    );
    native.on("scripts.register", () => null);
    native.on("scripts.unregister", () => null);
    const s = nativeScripting(bridge);
    const scripts = contentScriptsFor("http://localhost:30000");
    expect(await s.hasPermission("http://localhost:30000/*")).toBe(true);
    expect(await s.registeredIds(["a", "b"])).toEqual(["b"]);
    await s.register(scripts);
    await s.unregister(["b"]);
    expect(native.asked.map((a) => a[0])).toEqual([
      "permissions.contains",
      "scripts.registered",
      "scripts.register",
      "scripts.unregister",
    ]);
    // The server and ids only, never the extension's file names.
    expect(native.asked[2]?.[1]).toEqual({
      server: "http://localhost:30000",
      ids: scripts.map((x) => x.id),
    });
  });

  test("giving a site back is best effort", async () => {
    const { native, bridge } = setup();
    native.on("permissions.remove", () => {
      throw new Error("not saved");
    });
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    await expect(
      nativeScripting(bridge).removePermission("http://x/*"),
    ).resolves.toBeUndefined();
  });
});

describe("Release history over native (ReleasesPlatform)", () => {
  test("asks whether it is allowed, and fetches as a release", async () => {
    const { native, bridge } = setup();
    native.on(
      "permissions.contains",
      (p) => (p as { origin: string }).origin === "https://foundryvtt.com/*",
    );
    native.on("fetch", (p) => ({ text: `page ${JSON.stringify(p)}` }));
    const r = nativeReleases(bridge);
    expect(await r.permitted()).toBe(true);
    expect(await r.fetchText("https://foundryvtt.com/releases/14.370")).toBe(
      'page {"url":"https://foundryvtt.com/releases/14.370","purpose":"release"}',
    );
  });
});

describe("messages to the background (runtime send)", () => {
  test("go through native and come back unwrapped", async () => {
    const { native, bridge } = setup();
    native.on("runtime.send", (p) => ({ echoed: p }));
    expect(await nativeSend(bridge)({ kind: "get-state" })).toEqual({
      echoed: { message: { kind: "get-state" } },
    });
  });

  test("the background's error rejects", async () => {
    const { native, bridge } = setup();
    native.on("runtime.send", () => {
      throw new Error("Message from an unregistered page");
    });
    await expect(nativeSend(bridge)({ kind: "get-state" })).rejects.toThrow(
      "unregistered page",
    );
  });
});

describe("files, confirm and links over native (UiPorts)", () => {
  test("save, open and confirm wait for the user's answer", async () => {
    const { native, bridge } = setup();
    native.on("files.save", () => null);
    native.on("files.open", () => ({ text: "{}" }));
    native.on("confirm", (p) => ({
      yes: (p as { text: string }).text === "?",
    }));
    const ports = nativePorts(bridge);
    await ports.files.save("a.json", "{}");
    expect(await ports.files.open()).toBe("{}");
    expect(await ports.confirm("?")).toBe(true);
    expect(await ports.confirm("no")).toBe(false);
    expect(native.asked[0]).toEqual([
      "files.save",
      { fileName: "a.json", text: "{}" },
    ]);
  });

  test("no file picked is undefined", async () => {
    const { native, bridge } = setup();
    native.on("files.open", () => ({}));
    expect(await nativePorts(bridge).files.open()).toBeUndefined();
  });

  test("a link opens in native and the page doesn't follow it", async () => {
    const { native, bridge } = setup();
    native.on("openExternal", () => null);
    expect(nativePorts(bridge).openExternal("https://foundryvtt.com/x")).toBe(
      true,
    );
    await vi.waitFor(() => {
      expect(native.asked).toEqual([
        ["openExternal", { url: "https://foundryvtt.com/x" }],
      ]);
    });
  });

  test("a link native can't open is logged", async () => {
    const { bridge } = setup();
    const logged = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    nativePorts(bridge).openExternal("https://foundryvtt.com/x");
    await vi.waitFor(() => {
      expect(logged).toHaveBeenCalled();
    });
  });
});

describe("the home screen's settings platform", () => {
  test("permissions and messages through native; no current tab", async () => {
    const { native, bridge } = setup();
    native.on("permissions.request", () => true);
    native.on("permissions.contains", () => false);
    native.on("permissions.remove", () => true);
    native.on("runtime.send", () => ({ servers: [] }));
    const p = nativeSettingsPlatform(bridge, "0.2.0 · test");
    expect(await p.permissions.request("http://x/*")).toBe(true);
    expect(await p.permissions.contains("http://x/*")).toBe(false);
    expect(await p.permissions.remove("http://x/*")).toBe(true);
    expect(await p.send({ kind: "list-servers" })).toEqual({ servers: [] });
    expect(await p.currentTab()).toBeUndefined();
    expect(await p.isFoundry(1)).toBe(false);
    await p.reload(1);
    expect(p.build).toBe("0.2.0 · test");
  });

  test("checks a typed address over native: Foundry's version, or the error", async () => {
    const { native, bridge } = setup();
    native.on("server.check", (p) =>
      (p as { server: string }).server === "http://10.0.2.2:30000"
        ? { version: "14.370" }
        : Promise.reject(new Error("Timed out")),
    );
    const app = nativeSettingsPlatform(bridge, "b").app;
    expect(await app?.check("http://10.0.2.2:30000")).toBe("14.370");
    await expect(app?.check("https://10.0.2.2:30000")).rejects.toThrow(
      "Timed out",
    );
    expect(app?.serverHref("http://h:1")).toBe("http://h:1/setup");
  });

  test("an answer without a version is an error, not a quiet empty one", async () => {
    const { native, bridge } = setup();
    native.on("server.check", () => ({ text: "<html>" }));
    const app = nativeSettingsPlatform(bridge, "b").app;
    await expect(app?.check("http://h:1")).rejects.toThrow();
  });
});

describe("the payloads native accepts (native-requests.ts)", () => {
  test("refuse folders in file names, wildcard sites and odd servers", () => {
    const S = REQUEST_SCHEMAS;
    expect(
      S["files.save"].safeParse({ fileName: "../a.json", text: "" }).success,
    ).toBe(false);
    expect(
      S["files.save"].safeParse({ fileName: "a.json", text: "" }).success,
    ).toBe(true);
    for (const origin of [
      "<all_urls>",
      "*://*/*",
      "http://*.lan/*",
      "file:///x/*",
      "http://a@b/*",
    ])
      expect(S["permissions.request"].safeParse({ origin }).success).toBe(
        false,
      );
    expect(
      S["permissions.request"].safeParse({
        origin: "http://192.168.1.5:30000/*",
      }).success,
    ).toBe(true);
    for (const server of [
      "http://h/vtt/",
      "http://h/a%2e%2e",
      "http://h/*",
      "ftp://h",
    ])
      expect(S["scripts.register"].safeParse({ server, ids: [] }).success).toBe(
        false,
      );
    expect(
      S["scripts.register"].safeParse({
        server: "http://h:30000/vtt",
        ids: ["a"],
      }).success,
    ).toBe(true);
  });

  test("scripts for one server at a time", () => {
    expect(() =>
      serverOfScripts([
        ...contentScriptsFor("http://a:1"),
        ...contentScriptsFor("http://b:1"),
      ]),
    ).toThrow();
    expect(() => serverOfScripts([])).toThrow();
  });
});

describe("NativeFetch's rule", () => {
  test("release pages only while Release history is allowed", () => {
    const page = "https://foundryvtt.com/releases/14.370";
    expect(fetchAllowed(page, "release", true)).toBe(true);
    expect(
      fetchAllowed("https://foundryvtt.com/releases/", "release", true),
    ).toBe(true);
    expect(fetchAllowed(page, "release", false)).toBe(false);
    expect(fetchAllowed("https://foundryvtt.com/me", "release", true)).toBe(
      false,
    );
    expect(
      fetchAllowed("https://foundryvtt.com/releases/../me", "release", true),
    ).toBe(false);
    expect(
      fetchAllowed("https://foundryvtt.com/releases/1?x=y", "release", true),
    ).toBe(false);
    expect(
      fetchAllowed(
        "https://foundryvtt.com.evil.example/releases/",
        "release",
        true,
      ),
    ).toBe(false);
  });

  test("the config only at its own address", () => {
    expect(fetchAllowed(REMOTE_CONFIG_URL, "config", false)).toBe(true);
    expect(fetchAllowed(`${REMOTE_CONFIG_URL}?x`, "config", false)).toBe(false);
    expect(
      fetchAllowed("https://foundryvtt.com/releases/", "config", true),
    ).toBe(false);
  });
});
