// @vitest-environment happy-dom
import { afterEach, describe, expect, test, vi } from "vitest";
import {
  startAppGame,
  startAppSetup,
  takeBridge,
  whenRoot,
} from "../../src/app/page.ts";
import { BACK, isServerPage, wrapForServer } from "../../src/app/native-api.ts";
import { fakeNative } from "./fake-native.ts";
import {
  updateLaunchNote,
  writeLaunchNote,
} from "../../src/app/launch-note.ts";

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

  test("answers native's Back: nothing to go back to on a bare page", async () => {
    const native = fakeNative();
    native.on("runtime.send", () => ({}));
    Object.assign(window, { mlApp: native.port });
    startAppSetup({
      win: window,
      doc: document,
      href: `${SERVER}/setup`,
      server: SERVER,
      css: "",
    });
    await expect(native.request(BACK, {})).resolves.toEqual({
      handled: false,
    });
  });

  test("on a touch screen Foundry's size notice goes from the start", () => {
    const clearNotice = vi.fn();
    const coarse = vi
      .spyOn(window, "matchMedia")
      .mockImplementation(
        (q: string) =>
          ({ matches: q === "(pointer: coarse)" }) as MediaQueryList,
      );
    Object.assign(window, { mlApp: fakeNative().port });
    startAppSetup({
      win: window,
      doc: document,
      href: `${SERVER}/setup`,
      server: SERVER,
      css: "",
      clearNotice,
    });
    expect(clearNotice).toHaveBeenCalledWith(window);
    coarse.mockImplementation(() => ({ matches: false }) as MediaQueryList);
    clearNotice.mockClear();
    Object.assign(window, { mlApp: fakeNative().port });
    startAppSetup({
      win: window,
      doc: document,
      href: `${SERVER}/setup`,
      server: SERVER,
      css: "",
      clearNotice,
    });
    expect(clearNotice).not.toHaveBeenCalled();
    coarse.mockRestore();
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

describe("waiting for the document's root element", () => {
  test("runs at once when there is one, else as soon as it comes", async () => {
    const seen: string[] = [];
    whenRoot(document, (root) => seen.push(root.tagName));
    expect(seen).toEqual(["HTML"]);
    const html = document.documentElement;
    html.remove();
    try {
      whenRoot(document, (root) => seen.push(root.tagName));
      expect(seen).toHaveLength(1);
    } finally {
      document.append(html);
    }
    await vi.waitFor(() => {
      expect(seen).toEqual(["HTML", "HTML"]);
    });
  });
});

describe("app-game on a server's game page", () => {
  test("watches its changes apply out of sight, and tells native", async () => {
    writeLaunchNote(sessionStorage, "w", 1, Date.now(), {
      launchId: "l1",
      ids: ["c1"],
    });
    updateLaunchNote(sessionStorage, { applyingAt: Date.now() });
    const report = {
      at: "2026-11-09T20:00:00.000Z",
      companion: "0.2.0",
      core: "14.370",
      system: { id: "dnd5e", version: "6" },
      active: [],
      versions: true,
      partial: false,
      launchId: "l1",
      results: [{ id: "c1", status: "applied" }],
    };
    Object.assign(window, {
      game: { world: { flags: { stagehand: { v: 1, report } } } },
    });
    const native = fakeNative();
    const done = vi.fn(() => ({}));
    native.on("apply.done", done);
    Object.assign(window, { mlApp: native.port });
    expect(
      startAppGame({ win: window, href: `${SERVER}/game`, server: SERVER }),
    ).toBe(true);
    await vi.waitFor(
      () => {
        expect(done).toHaveBeenCalledWith({ ok: true });
      },
      { timeout: 3000 },
    );
    Reflect.deleteProperty(window, "game");
    sessionStorage.clear();
  });

  test("on Foundry's /join (no running screen) and on /auth, it clears Foundry's size notice", () => {
    const clearNotice = vi.fn();
    Object.assign(window, { mlApp: fakeNative().port });
    startAppGame({
      win: window,
      href: `${SERVER}/join`,
      server: SERVER,
      clearNotice: clearNotice,
    });
    expect(clearNotice).toHaveBeenCalledWith(window);
    Object.assign(window, { mlApp: fakeNative().port });
    startAppGame({
      win: window,
      href: `${SERVER}/auth`,
      server: SERVER,
      clearNotice: clearNotice,
    });
    expect(clearNotice).toHaveBeenCalledTimes(2);
    Object.assign(window, { mlApp: fakeNative().port });
    startAppGame({
      win: window,
      href: `${SERVER}/game`,
      server: SERVER,
      clearNotice: clearNotice,
    });
    expect(clearNotice).toHaveBeenCalledTimes(2);
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

  test("on /join it starts the running-world screen, after a launch too", () => {
    const native = fakeNative();
    Object.assign(window, { mlApp: native.port });
    startAppGame({
      win: window,
      href: `${SERVER}/join`,
      server: SERVER,
      runningCss: "#ml-run-root{}",
    });
    expect(document.documentElement.classList.contains("ml-run-wait")).toBe(
      true,
    );
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
