// @vitest-environment happy-dom
import { afterEach, describe, expect, test, vi } from "vitest";
import { downloadText, pickTextFile } from "../../src/ui/common/files.ts";
import {
  DRAG_TYPE,
  draggedIds,
  isModuleDrag,
  startDrag,
} from "../../src/ui/modules/drag.ts";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function fakeDrag() {
  const data = new Map<string, string>();
  const dataTransfer = {
    effectAllowed: "none",
    get types() {
      return [...data.keys()];
    },
    setData: (type: string, value: string) => data.set(type, value),
    getData: (type: string) => data.get(type) ?? "",
  };
  return { dataTransfer } as never;
}

describe("drag", () => {
  test("carries module ids and recognises its own drags", () => {
    const e = fakeDrag();
    startDrag(e, ["a", "b"]);
    expect(isModuleDrag(e)).toBe(true);
    expect(draggedIds(e)).toEqual(["a", "b"]);
  });

  test("ignores foreign or malformed drags", () => {
    const e = fakeDrag();
    expect(isModuleDrag(e)).toBe(false);
    (
      e as { dataTransfer: { setData(t: string, v: string): void } }
    ).dataTransfer.setData(DRAG_TYPE, "{bad");
    expect(draggedIds(e)).toEqual([]);
    (
      e as { dataTransfer: { setData(t: string, v: string): void } }
    ).dataTransfer.setData(DRAG_TYPE, '[1,"x"]');
    expect(draggedIds(e)).toEqual(["x"]);
  });
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
