import { describe, expect, test, vi } from "vitest";
import { createNativeBridge } from "../../src/app/bridge.ts";
import { nativeRouterDeps, serveBackground } from "../../src/app/background.ts";
import { APP_ID, HOME_PAGE, ROUTE } from "../../src/app/native-api.ts";
import { BUNDLED_CONFIG } from "../../src/adapters/config.ts";
import { fakeNative, type FakeNative } from "./fake-native.ts";

const SERVER = "http://localhost:30000";

/** A native side with storage, saved origins and scripts in memory. */
function nativeWithStorage(): FakeNative {
  const native = fakeNative();
  const kv = new Map<string, string>();
  const registered = new Set<string>();
  native.on("kv.get", (p) => {
    const raw = kv.get((p as { key: string }).key);
    return raw === undefined ? {} : { value: JSON.parse(raw) as unknown };
  });
  native.on("kv.set", (p) => {
    const { key, value } = p as { key: string; value: unknown };
    kv.set(key, JSON.stringify(value));
    return null;
  });
  native.on("permissions.contains", () => true);
  native.on("scripts.registered", (p) =>
    (p as { ids: string[] }).ids.filter((id) => registered.has(id)),
  );
  native.on("scripts.register", (p) => {
    (p as { ids: string[] }).ids.forEach((id) => registered.add(id));
    return null;
  });
  native.on("fetch", () => {
    throw new Error("offline");
  });
  native.on("home.open", () => null);
  native.on("background.ready", () => null);
  return native;
}

function start() {
  const native = nativeWithStorage();
  const bridge = createNativeBridge(native.port);
  const deps = nativeRouterDeps(bridge, { version: "0.2.0" });
  const ready = serveBackground(bridge, deps);
  const route = (message: unknown, url: string, fromTab: boolean) =>
    native.request(ROUTE, { message, sender: { id: APP_ID, url, fromTab } });
  return { native, deps, route, ready };
}

describe("the background in the app: route requests from native", () => {
  test("the home screen adds and lists servers", async () => {
    const s = start();
    await s.route(
      { kind: "register-server", server: `${SERVER}/` },
      HOME_PAGE,
      false,
    );
    const listed = (await s.route(
      { kind: "list-servers" },
      HOME_PAGE,
      false,
    )) as {
      servers: { id: string; active: boolean }[];
    };
    expect(listed.servers).toEqual([
      expect.objectContaining({ id: SERVER, active: true }),
    ]);
  });

  test("a saved server's Setup page gets its state; others are refused", async () => {
    const s = start();
    await s.route(
      { kind: "register-server", server: SERVER },
      HOME_PAGE,
      false,
    );
    const state = (await s.route(
      { kind: "get-state" },
      `${SERVER}/setup`,
      true,
    )) as { server: string; config: unknown };
    expect(state.server).toBe(SERVER);
    // Offline: the bundled config applies.
    expect(state.config).toEqual(BUNDLED_CONFIG);
    await expect(
      s.route({ kind: "get-state" }, "http://elsewhere:30000/setup", true),
    ).rejects.toThrow("unregistered page");
  });

  test("a sender that isn't the app's is refused", async () => {
    const s = start();
    await expect(
      s.native.request(ROUTE, {
        message: { kind: "list-servers" },
        sender: { id: "someone-else", url: HOME_PAGE, fromTab: false },
      }),
    ).rejects.toThrow("Unknown sender");
  });

  test("a route request that doesn't check out is refused", async () => {
    const s = start();
    await expect(
      s.native.request(ROUTE, { message: { kind: "list-servers" } }),
    ).rejects.toThrow();
    await expect(
      s.route({ kind: "no-such-message" }, HOME_PAGE, false),
    ).rejects.toThrow();
  });

  test("Setup's settings entry opens the home screen", async () => {
    const s = start();
    await s.route(
      { kind: "register-server", server: SERVER },
      HOME_PAGE,
      false,
    );
    await s.route({ kind: "open-settings" }, `${SERVER}/setup`, true);
    expect(s.native.asked.map((a) => a[0])).toContain("home.open");
  });

  test("the app's id, address and version stand in for the extension's", () => {
    const s = start();
    expect(s.deps.extensionId).toBe(APP_ID);
    expect(HOME_PAGE.startsWith(s.deps.extensionUrl)).toBe(true);
    expect(s.deps.extensionVersion).toBe("0.2.0");
    expect(s.deps.uuid()).toMatch(/^[0-9a-f-]{36}$/);
    vi.useFakeTimers({ now: new Date("2026-11-08T10:00:00Z") });
    expect(s.deps.now()).toBe("2026-11-08T10:00:00.000Z");
    vi.useRealTimers();
  });
});
