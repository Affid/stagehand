// @vitest-environment happy-dom
import { afterEach, describe, expect, test, vi } from "vitest";
import {
  isServerPage,
  startAppGame,
  startAppSetup,
  takeBridge,
} from "../../src/app/page.ts";
import { wrapForServer } from "../../src/app/native-api.ts";
import { fakeNative } from "./fake-native.ts";

const SERVER = "http://localhost:30000/vtt";

afterEach(() => {
  document.documentElement.className = "";
  document.querySelectorAll("style[data-ml]").forEach((s) => {
    s.remove();
  });
  Reflect.deleteProperty(window, "mlApp");
});

describe("which page a script runs on", () => {
  test("only the server's own Setup or game page, prefix included", () => {
    expect(isServerPage(`${SERVER}/setup`, SERVER, "/setup")).toBe(true);
    expect(isServerPage(`${SERVER}/setup?x=1#y`, SERVER, "/setup")).toBe(true);
    expect(isServerPage(`${SERVER}/game`, SERVER, "/game")).toBe(true);
    expect(isServerPage(`${SERVER}/join`, SERVER, "/setup")).toBe(false);
    expect(isServerPage(`${SERVER}/setupx`, SERVER, "/setup")).toBe(false);
    expect(isServerPage("http://localhost:30000/setup", SERVER, "/setup")).toBe(
      false,
    );
    expect(isServerPage("http://other:30000/vtt/setup", SERVER, "/setup")).toBe(
      false,
    );
    expect(isServerPage("not a url", SERVER, "/setup")).toBe(false);
  });
});

describe("the bridge object WebView injects", () => {
  test("is kept and its global name removed, so later page scripts can't use it", () => {
    const port = fakeNative().port;
    Object.assign(window, { mlApp: port });
    expect(takeBridge(window)).toBe(port);
    expect((window as { mlApp?: unknown }).mlApp).toBeUndefined();
  });

  test("is missing on an old WebView", () => {
    expect(takeBridge(window)).toBeUndefined();
  });

  test("one whose name can't be taken away is refused, not used", () => {
    const win = {};
    Object.defineProperty(win, "mlApp", {
      value: fakeNative().port,
      configurable: false,
      writable: false,
    });
    expect(takeBridge(win as Window)).toBeUndefined();
  });
});

describe("app-setup on a server's Setup page", () => {
  test("hides Foundry's Setup before the first paint and starts both halves", () => {
    const native = fakeNative();
    native.on("runtime.send", () => ({}));
    Object.assign(window, { mlApp: native.port });
    const started = startAppSetup({
      win: window,
      doc: document,
      href: `${SERVER}/setup`,
      server: SERVER,
      css: ".ml-test { color: red }",
    });
    expect(started).toBe(true);
    const style = document.querySelector("style[data-ml]");
    expect(style?.textContent).toBe(".ml-test { color: red }");
    expect(style?.parentElement).toBe(document.documentElement);
    expect(document.documentElement.classList.contains("ml-shell-wait")).toBe(
      true,
    );
    expect((window as { mlApp?: unknown }).mlApp).toBeUndefined();
  });

  test("does nothing on another page, or without the bridge", () => {
    Object.assign(window, { mlApp: fakeNative().port });
    expect(
      startAppSetup({
        win: window,
        doc: document,
        href: `${SERVER}/join`,
        server: SERVER,
        css: "",
      }),
    ).toBe(false);
    expect((window as { mlApp?: unknown }).mlApp).toBeDefined();
    Reflect.deleteProperty(window, "mlApp");
    expect(
      startAppSetup({
        win: window,
        doc: document,
        href: `${SERVER}/setup`,
        server: SERVER,
        css: "",
      }),
    ).toBe(false);
    expect(document.querySelector("style[data-ml]")).toBe(null);
    expect(document.documentElement.className).toBe("");
  });
});

describe("app-game on a server's game page", () => {
  test("relays the companion through native", async () => {
    const native = fakeNative();
    native.on("runtime.send", (p) =>
      (p as { message: { kind: string } }).message.kind === "bridge-init"
        ? { enabled: true, extensionVersion: "0.2.0" }
        : {},
    );
    Object.assign(window, { mlApp: native.port });
    const posted = vi.spyOn(window, "postMessage");
    expect(
      startAppGame({ win: window, href: `${SERVER}/game`, server: SERVER }),
    ).toBe(true);
    await vi.waitFor(() => {
      expect(posted).toHaveBeenCalledWith(
        expect.objectContaining({ type: "BRIDGE_READY" }),
        window.location.origin,
      );
    });
  });

  test("on any other page of the server it takes the bridge away, unused", () => {
    const native = fakeNative();
    Object.assign(window, { mlApp: native.port });
    expect(
      startAppGame({ win: window, href: `${SERVER}/join`, server: SERVER }),
    ).toBe(false);
    expect((window as { mlApp?: unknown }).mlApp).toBeUndefined();
    expect(native.sent).toEqual([]);
  });
});

describe("native's wrapper around a page script (odd servers)", () => {
  test("quotes anything a server string holds", () => {
    const odd = 'http://h/a"\\\u2028</script>\ud800';
    const wrapped = wrapForServer("", odd);
    const literal = wrapped.slice(wrapped.lastIndexOf("})(") + 3, -3);
    expect(JSON.parse(literal)).toBe(odd);
    expect(wrapped.endsWith(");\n")).toBe(true);
  });
});

describe("native's wrapper around a page script", () => {
  test("gives the script its server as a parameter, JSON-quoted", () => {
    const wrapped = wrapForServer(
      "var moduleLibrary = ML_APP_SERVER;",
      'http://host:30000/a"b',
    );
    expect(wrapped).toBe(
      '(function (ML_APP_SERVER) {\nvar moduleLibrary = ML_APP_SERVER;\n})("http://host:30000/a\\"b");\n',
    );
  });
});
