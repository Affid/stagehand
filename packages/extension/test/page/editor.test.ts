// @vitest-environment happy-dom
import { afterEach, describe, expect, test, vi } from "vitest";
import {
  closeEditor,
  openEditor,
  saveFromEditor,
} from "../../src/page/editor.ts";

afterEach(() => {
  document.body.innerHTML = "";
});

/** A stand-in for Foundry's HTMLProseMirrorElement. */
function foundry() {
  const create = vi.fn((o: { value: string }) => {
    const el = document.createElement("div") as HTMLDivElement & {
      value: string;
    };
    el.className = "fake-pm";
    el.value = o.value;
    return el;
  });
  const world = { validate: vi.fn(), updateSource: vi.fn() };
  const post = vi.fn(() => Promise.resolve({}));
  return {
    create,
    post,
    page: {
      foundry: {
        applications: { elements: { HTMLProseMirrorElement: { create } } },
      },
      game: { post, worlds: { values: () => [].values(), get: () => world } },
    },
  };
}

describe("Foundry's editor in our host", () => {
  test("opens with the description, editing at once, in our host only", () => {
    document.body.innerHTML = '<div id="ml-pm-w1"></div>';
    const f = foundry();
    expect(openEditor(document, f.page as never, "ml-pm-w1", "<p>x</p>")).toBe(
      undefined,
    );
    expect(f.create).toHaveBeenCalledWith(
      expect.objectContaining({ value: "<p>x</p>", toggled: false }),
    );
    expect(document.querySelector("#ml-pm-w1 .fake-pm")).toBeTruthy();
  });

  test("saves the editor's HTML through editWorld, then closes it", async () => {
    document.body.innerHTML = '<div id="ml-pm-w1"></div>';
    const f = foundry();
    openEditor(document, f.page, "ml-pm-w1", "<p>x</p>");
    const el = document.querySelector<HTMLElement & { value: string }>(
      "#ml-pm-w1 .fake-pm",
    );
    if (el) el.value = "<p>edited</p>";
    expect(
      await saveFromEditor(document, f.page as never, "ml-pm-w1", "w1"),
    ).toBeUndefined();
    expect(f.post).toHaveBeenCalledWith({
      action: "editWorld",
      id: "w1",
      description: "<p>edited</p>",
    });
    closeEditor(document, "ml-pm-w1");
    expect(document.querySelector(".fake-pm")).toBe(null);
  });

  test("no host, no editor, or no Foundry editor class is reported, never thrown", async () => {
    const f = foundry();
    expect(openEditor(document, f.page as never, "ml-pm-w1", "")).toMatch(
      /host/,
    );
    expect(
      await saveFromEditor(document, f.page as never, "ml-pm-w1", "w1"),
    ).toMatch(/editor/);
    document.body.innerHTML = '<div id="ml-pm-w1"></div>';
    expect(openEditor(document, {}, "ml-pm-w1", "")).toMatch(/editor/);
  });
});
