// @vitest-environment happy-dom
// Stagehand's view in Module Management (design/in-world-library): Setup's
// cards for this world, changes marked until saved, the mockup's tools row
// and footer, and Foundry's form kept equal to the cards.
import { emptyLibrary, type Library } from "@stagehand/shared/library/schema";
import { createTranslator } from "@stagehand/ui/i18n.ts";
import { cleanup, fireEvent, render, screen } from "@testing-library/preact";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WorldView, type ViewDeps } from "../src/view/App.tsx";
import { createViewStore, type Prefs } from "../src/view/store.ts";
import { fakeGame } from "./fakes.ts";

afterEach(cleanup);

const LIB: Library = {
  ...emptyLibrary("s"),
  folders: [
    {
      id: "f1",
      name: "Combat",
      color: "#c94c4c",
      parentId: null,
      order: 0,
      collapsed: false,
      revision: 1,
    },
  ],
  tags: [{ id: "t1", name: "visual", color: "#3c8dc9", revision: 1 }],
  modules: { a: { folderId: "f1", tags: ["t1"], note: "" } },
  presets: [
    {
      id: "p1",
      name: "QoL",
      description: "",
      modules: ["b"],
      source: "user",
      revision: 1,
    },
  ],
};

function setup(over: Partial<ViewDeps> = {}, prefs?: Prefs) {
  const { game } = fakeGame([
    { id: "stagehand", active: true },
    { id: "a", active: true },
    { id: "b" },
  ]);
  const saved = prefs ?? { load: () => ({}), save: vi.fn() };
  let n = 0;
  const deps: ViewDeps = {
    game,
    library: LIB,
    store: createViewStore(saved),
    canSwitch: true,
    canApplyPresets: true,
    t: createTranslator("en"),
    foundryText: (key) => `[${key}]`,
    review: vi.fn(),
    pickPreset: vi.fn(),
    fresh: () => ({ id: `c${String(++n)}`, createdAt: "2026-11-19" }),
    now: "2026-11-19T10:00:00.000Z",
    ...over,
  };
  const form = document.createElement("form");
  document.body.append(form);
  const r = render(<WorldView deps={deps} />, { container: form });
  return { deps, form, r, prefs: saved };
}

const card = (form: HTMLElement, id: string) =>
  form.querySelector<HTMLElement>(`.stw-card[data-module="${id}"]`);
const failSafe = (form: HTMLFormElement, id: string) =>
  form.elements.namedItem(id) as HTMLInputElement | null;

describe("WorldView", () => {
  it("shows this world's modules as cards in the library's folders", () => {
    const { form } = setup();

    expect(screen.getByText("Combat")).toBeTruthy();
    expect(card(form, "a")?.classList.contains("on")).toBe(true);
    expect(card(form, "b")?.classList.contains("off")).toBe(true);
  });

  it("marks a switched module and counts the change until it is saved", () => {
    // Arrange
    const { form } = setup();

    // Act
    fireEvent.click(screen.getByRole("switch", { name: "b on in World One" }));

    // Assert
    expect(card(form, "b")?.classList.contains("plus")).toBe(true);
    expect(screen.getByText("1 change not saved yet")).toBeTruthy();
    expect(form.querySelector(".stc-badge")?.textContent).toBe("1");
  });

  it("keeps Foundry's form equal to the cards, every module listed", () => {
    const { form } = setup();

    fireEvent.click(screen.getByRole("switch", { name: "b on in World One" }));

    expect(failSafe(form, "b")?.checked).toBe(true);
    expect(failSafe(form, "a")?.checked).toBe(true);
    expect(failSafe(form, "stagehand")?.checked).toBe(true);
    expect(failSafe(form, "b")?.hidden).toBe(true);
  });

  it("forgets the changes on Discard", () => {
    const { form } = setup();
    fireEvent.click(screen.getByRole("switch", { name: "b on in World One" }));

    fireEvent.click(screen.getByRole("button", { name: "Discard" }));

    expect(screen.queryByText(/not saved yet/)).toBeNull();
    expect(failSafe(form, "b")?.checked).toBe(false);
  });

  it("opens the review from the line and from Save Module Settings", () => {
    const { deps } = setup();
    fireEvent.click(screen.getByRole("switch", { name: "b on in World One" }));

    fireEvent.click(screen.getByRole("button", { name: "Review" }));
    fireEvent.click(screen.getByRole("button", { name: /MODMANAGE.Submit/ }));

    expect(deps.review).toHaveBeenCalledTimes(2);
    const data = vi.mocked(deps.review).mock.calls[0]?.[0];
    expect(data?.commands).toHaveLength(1);
  });

  it("offers Apply preset to full Gamemasters only", () => {
    const { deps } = setup();
    fireEvent.click(screen.getByRole("button", { name: /Apply preset/ }));
    cleanup();
    setup({ canApplyPresets: false });

    expect(deps.pickPreset).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("button", { name: /Apply preset/ })).toBeNull();
  });

  it("groups by what the user picks, and remembers it", () => {
    const { prefs } = setup();

    fireEvent.change(screen.getByRole("combobox", { name: "Group by" }), {
      target: { value: "tag" },
    });

    expect(screen.getByText("visual")).toBeTruthy();
    expect(prefs.save).toHaveBeenLastCalledWith(
      expect.objectContaining({ by: "tag" }),
    );
  });

  it("starts with the Group by the user picked last time", () => {
    setup({}, { load: () => ({ by: "tag" }), save: vi.fn() });

    expect(screen.getByText("visual")).toBeTruthy();
  });

  it("doesn't submit Foundry's form on Enter in the filter", () => {
    setup();
    const filter = screen.getByRole("searchbox", { name: "Filter modules" });

    const sent = fireEvent.keyDown(filter, { key: "Enter" });

    expect(sent).toBe(false);
  });

  it("marks every module off on Deactivate All, Stagehand aside", () => {
    const { form } = setup();

    fireEvent.click(
      screen.getByRole("button", { name: /MODMANAGE.DeactivateAll/ }),
    );

    expect(card(form, "a")?.classList.contains("minus")).toBe(true);
    expect(failSafe(form, "stagehand")?.checked).toBe(true);
  });

  it("can't switch for a user Foundry doesn't let change modules", () => {
    setup({ canSwitch: false });

    const sw = screen.getByRole("switch", { name: "b on in World One" });

    expect((sw as HTMLInputElement).disabled).toBe(true);
    expect(
      screen.queryByRole("button", { name: /MODMANAGE.DeactivateAll/ }),
    ).toBeNull();
  });
});
