// @vitest-environment happy-dom
import { afterEach, describe, expect, test, vi } from "vitest";
import { browserPorts, watchExternalLinks } from "../../src/ui/ports.ts";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  document.body.replaceChildren();
});

describe("the extension's ports: the browser's own behaviour", () => {
  test("confirm asks the browser's confirm and resolves its answer", async () => {
    const ask = vi.fn(() => false);
    vi.stubGlobal("confirm", ask);
    expect(await browserPorts().confirm("Delete Combat?")).toBe(false);
    expect(ask).toHaveBeenCalledWith("Delete Combat?");
  });

  test("files.save downloads through a temporary link", async () => {
    vi.stubGlobal(
      "URL",
      Object.assign(URL, {
        createObjectURL: vi.fn(() => "blob:x"),
        revokeObjectURL: vi.fn(),
      }),
    );
    const saved: string[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      saved.push(this.download);
    });
    await browserPorts().files.save("library.json", "{}");
    expect(saved).toEqual(["library.json"]);
  });

  test("files.open reads the file the user picks", async () => {
    vi.spyOn(HTMLInputElement.prototype, "click").mockImplementation(function (
      this: HTMLInputElement,
    ) {
      Object.defineProperty(this, "files", {
        value: [new File(["{}"], "x.json")],
      });
      this.dispatchEvent(new Event("change"));
    });
    expect(await browserPorts().files.open()).toBe("{}");
  });

  test("openExternal leaves the link to the browser", () => {
    expect(browserPorts().openExternal("https://foundryvtt.com")).toBe(false);
  });
});

describe("links to other sites on our page", () => {
  function setup(opens: boolean) {
    const host = document.createElement("div");
    host.innerHTML = `
      <a id="out" href="https://foundryvtt.com/article" target="_blank"><span id="inner">News</span></a>
      <a id="same" href="/setup">Setup</a>
      <a id="js" href="javascript:alert(1)" target="_blank">Bad</a>`;
    document.body.append(host);
    const open = vi.fn(() => opens);
    const stop = watchExternalLinks(host, open, () => true);
    const click = (id: string, init: MouseEventInit = {}): boolean =>
      host
        .querySelector(`#${id}`)!
        .dispatchEvent(
          new MouseEvent("click", { bubbles: true, cancelable: true, ...init }),
        );
    return { host, open, stop, click };
  }

  test("a new-tab link goes to openExternal, which may take it over", () => {
    const s = setup(true);
    // dispatchEvent returns false when the default was prevented.
    expect(s.click("inner")).toBe(false);
    expect(s.open).toHaveBeenCalledWith("https://foundryvtt.com/article");
  });

  test("when openExternal declines, the browser follows the link", () => {
    const s = setup(false);
    expect(s.click("out")).toBe(true);
    expect(s.open).toHaveBeenCalledTimes(1);
  });

  test("the middle button counts too", () => {
    const s = setup(true);
    const a = s.host.querySelector("#out")!;
    const middle = new MouseEvent("auxclick", {
      bubbles: true,
      cancelable: true,
      button: 1,
    });
    expect(a.dispatchEvent(middle)).toBe(false);
    const right = new MouseEvent("auxclick", {
      bubbles: true,
      cancelable: true,
      button: 2,
    });
    expect(a.dispatchEvent(right)).toBe(true);
    expect(s.open).toHaveBeenCalledTimes(1);
  });

  test("a page script's click opens nothing (no isTrusted)", () => {
    const host = document.createElement("div");
    host.innerHTML = `<a id="out" href="https://evil.example" target="_blank">x</a>`;
    document.body.append(host);
    const open = vi.fn(() => true);
    watchExternalLinks(host, open);
    host
      .querySelector("#out")!
      .dispatchEvent(
        new MouseEvent("click", { bubbles: true, cancelable: true }),
      );
    expect(open).not.toHaveBeenCalled();
  });

  test("a new-tab link that isn't http(s) never opens", () => {
    const s = setup(false);
    expect(s.click("js")).toBe(false);
    expect(s.open).not.toHaveBeenCalled();
  });

  test("same-tab links and handled clicks are left alone", () => {
    const s = setup(true);
    expect(s.click("same")).toBe(true);
    const a = s.host.querySelector("#out")!;
    const handled = new MouseEvent("click", {
      bubbles: true,
      cancelable: true,
    });
    handled.preventDefault();
    a.dispatchEvent(handled);
    expect(s.open).not.toHaveBeenCalled();
  });

  test("stops watching", () => {
    const s = setup(true);
    s.stop();
    s.click("out");
    expect(s.open).not.toHaveBeenCalled();
  });
});
