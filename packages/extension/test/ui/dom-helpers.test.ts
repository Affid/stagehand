// @vitest-environment happy-dom
import { afterEach, describe, expect, test, vi } from "vitest";
import { downloadText, pickTextFile } from "../../src/ui/common/files.ts";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("files", () => {
  test("downloadText clicks a temporary object URL link", () => {
    const create = vi.fn(() => "blob:x");
    vi.stubGlobal(
      "URL",
      Object.assign(URL, { createObjectURL: create, revokeObjectURL: vi.fn() }),
    );
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => undefined);
    downloadText("a.json", "{}");
    expect(create).toHaveBeenCalled();
    expect(click).toHaveBeenCalled();
  });

  test("pickTextFile resolves the chosen file's text, or undefined", async () => {
    const clicked: HTMLInputElement[] = [];
    vi.spyOn(HTMLInputElement.prototype, "click").mockImplementation(function (
      this: HTMLInputElement,
    ) {
      clicked.push(this);
    });
    const picked = pickTextFile();
    let input = clicked.at(-1);
    const file = new File(['{"a":1}'], "x.json", { type: "application/json" });
    Object.defineProperty(input, "files", { value: [file] });
    input?.dispatchEvent(new Event("change"));
    expect(await picked).toBe('{"a":1}');

    const none = pickTextFile();
    input = clicked.at(-1);
    Object.defineProperty(input, "files", { value: [] });
    input?.dispatchEvent(new Event("change"));
    expect(await none).toBeUndefined();
  });
});
