// @vitest-environment happy-dom
// Folded sections: kept by the page when it keeps them (a world keeps them
// per user), else by the view itself (Setup).
import { cleanup, fireEvent } from "@testing-library/preact";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useModules } from "../src/context.ts";
import { worldModules } from "../src/model/world-modules.ts";
import { ModuleSections } from "../src/world/ModuleSections.tsx";
import { useWhy } from "../src/world/useWhy.ts";
import { fakeUi, renderWith } from "./harness.tsx";

afterEach(cleanup);

function SectionsView() {
  const ui = useModules();
  const model = worldModules(ui.data, "w1");
  const world = ui.data.setup?.worlds[0];
  const why = useWhy();
  if (!world) throw new Error("no world");
  return (
    <ModuleSections
      rows={model.rows}
      all={model.rows}
      world={world}
      why={why}
      onFlip={vi.fn()}
    />
  );
}

describe("smart groups in a world", () => {
  it("leaves out Unused, which needs the other worlds", () => {
    const ui = fakeUi({ view: { by: "smart", layout: "cards" } });

    const r = renderWith(ui, <SectionsView />);

    expect(r.container.textContent).not.toContain("Unused");
  });

  it("offers Unused on Setup, which knows every world", () => {
    const ui = fakeUi({
      where: "setup",
      view: { by: "smart", layout: "cards" },
    });

    const r = renderWith(ui, <SectionsView />);

    expect(r.container.textContent).toContain("Unused");
  });
});

describe("folded sections", () => {
  it("shows a section the page keeps folded as folded, and asks it to unfold", () => {
    const onFold = vi.fn();
    const ui = fakeUi({ folded: new Set(["f1"]), onFold });

    const r = renderWith(ui, <SectionsView />);
    const head = r.container.querySelector(".stw-head")!;
    fireEvent.click(head);

    expect(head.getAttribute("aria-expanded")).toBe("false");
    expect(onFold).toHaveBeenCalledWith("f1");
  });

  it("folds by itself when the page doesn't keep folds", () => {
    const r = renderWith(fakeUi(), <SectionsView />);
    const head = r.container.querySelector(".stw-head")!;

    fireEvent.click(head);

    expect(head.getAttribute("aria-expanded")).toBe("false");
  });
});
