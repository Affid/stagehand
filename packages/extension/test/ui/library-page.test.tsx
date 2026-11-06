// @vitest-environment happy-dom
import type { Snapshot } from "@module-library/shared/world";
import { cleanup, fireEvent, within } from "@testing-library/preact";
import { afterEach, describe, expect, test } from "vitest";
import type { SetupState } from "../../src/messages.ts";
import { el, renderUi } from "./harness.tsx";

afterEach(cleanup);

const snap = (active: string[]): Snapshot => ({
  worldId: "w1",
  title: "Strahd",
  system: { id: "dnd5e", version: "5" },
  coreVersion: "14.369",
  active: active.map((id) => ({ id, version: "1.0.0" })),
  companionVersion: "0.1.0",
  takenAt: "2026-11-05T00:00:00.000Z",
});

const library = (data: Partial<SetupState> = {}) =>
  renderUi("shell", { data, state: { route: { kind: "library" } } });

const sections = (c: ParentNode): string[] =>
  [...c.querySelectorAll(".mll-sec .name")].map((n) => n.textContent);
const cards = (c: ParentNode): string[] =>
  [...c.querySelectorAll(".mll-card")].map(
    (n) => n.getAttribute("data-module") ?? "",
  );
const card = (c: ParentNode, id: string): HTMLElement =>
  el(c, `.mll-card[data-module="${id}"]`);

describe("the Library page", () => {
  test("cards in folder groups, each with its line, tags, version and worlds", () => {
    const { container } = library({ snapshots: { w1: snap(["a"]) } });
    expect(sections(container)).toEqual(["Combat", "Unfiled"]);
    const a = card(container, "a");
    expect(a.textContent).toContain("Title a");
    expect(a.textContent).toContain("for Strahd");
    expect(a.textContent).toContain("visual");
    expect(a.textContent).toContain("v1.0.0");
    expect(a.textContent).toContain("on in 1 world");
    expect(card(container, "c").textContent).toContain("in no world");
    expect(card(container, "b").textContent).toContain(
      "Not verified for Foundry 14",
    );
    expect(card(container, "b").classList.contains("risk")).toBe(true);
  });

  test("Group by tag, author or smart group", () => {
    const { container, getByRole } = library();
    const by = getByRole("combobox", { name: "Group by" });
    fireEvent.change(by, { target: { value: "tag" } });
    expect(sections(container)).toEqual(["visual", "Untagged"]);
    fireEvent.change(by, { target: { value: "author" } });
    expect(sections(container)).toEqual(["Ann"]);
  });

  test("the filter narrows the cards", () => {
    const { container, getByRole } = library();
    fireEvent.input(getByRole("searchbox", { name: /Filter modules/ }), {
      target: { value: "module-lib" },
    });
    expect(cards(container)).toEqual(["module-library"]);
  });

  test("a group folds and says how many it holds", () => {
    const { container, getByRole } = library();
    const head = getByRole("button", { name: /^Combat/ });
    expect(head.textContent).toContain("1");
    fireEvent.click(head);
    expect(head.getAttribute("aria-expanded")).toBe("false");
    expect(cards(container)).not.toContain("a");
  });

  test("Select shows checkboxes and the selection band; Done leaves it", () => {
    const { container, getByRole, store } = library();
    expect(container.querySelector(".mll-card input[type=checkbox]")).toBe(
      null,
    );
    fireEvent.click(getByRole("button", { name: "Select" }));
    fireEvent.click(
      within(card(container, "a")).getByRole("checkbox", {
        name: "Select Title a",
      }),
    );
    expect(store.get().selection).toEqual(["a"]);
    expect(el(container, ".ml-bulk-active").textContent).toContain(
      "1 selected",
    );
    fireEvent.click(getByRole("button", { name: "Done" }));
    expect(store.get().selection).toEqual([]);
    expect(container.querySelector(".ml-bulk")).toBe(null);
  });

  test("Organise opens today's folders, tags and presets beside the cards", () => {
    const { container, getByRole } = library();
    expect(container.querySelector(".mll-side")).toBe(null);
    fireEvent.click(getByRole("button", { name: "Organise" }));
    const side = el(container, ".mll-side");
    expect(side.textContent).toContain("Folders");
    expect(side.textContent).toContain("Tags");
    expect(side.textContent).toContain("Presets");
  });

  test("typing in the filter clears the selection, so bulk actions can't reach hidden cards", () => {
    const { container, getByRole, store } = library();
    fireEvent.click(getByRole("button", { name: "Select" }));
    fireEvent.click(
      within(card(container, "a")).getByRole("checkbox", {
        name: "Select Title a",
      }),
    );
    fireEvent.input(getByRole("searchbox", { name: /Filter modules/ }), {
      target: { value: "module-lib" },
    });
    expect(store.get().selection).toEqual([]);
  });
});
