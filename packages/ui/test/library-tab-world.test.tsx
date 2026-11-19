// @vitest-environment happy-dom
// The module panel's Library tab inside a world: the library shown, not
// edited (it is organised on Setup), this world's switch, and the presets
// that hold the module, marked when active (design/in-world-library).
import { cleanup, fireEvent, screen } from "@testing-library/preact";
import { afterEach, describe, expect, it } from "vitest";
import { LibraryTab } from "../src/panel/LibraryTab.tsx";
import { fakeUi, pkg, renderWith, worldOf } from "./harness.tsx";

afterEach(cleanup);

describe("LibraryTab in a world", () => {
  it("shows the folder, tags and note as text, with no fields", () => {
    // Arrange
    const ui = fakeUi();

    // Act
    const r = renderWith(ui, <LibraryTab pkg={pkg("a")} here="w1" />);

    // Assert
    expect(r.container.querySelector("select, textarea")).toBeNull();
    expect(screen.getByText("Combat")).toBeTruthy();
    expect(screen.getByText("visual")).toBeTruthy();
    expect(screen.getByText("for Strahd")).toBeTruthy();
    expect(screen.getByText(/organised on the Setup screen/)).toBeTruthy();
  });

  it("says None where the library has nothing for the module", () => {
    const r = renderWith(fakeUi(), <LibraryTab pkg={pkg("b")} here="w1" />);

    expect(r.container.textContent).toContain("Unfiled");
    expect(screen.getAllByText("None").length).toBeGreaterThanOrEqual(2);
  });

  it("marks a preset whose installed modules are all on as active", () => {
    const ui = fakeUi({ data: worldOf(["stagehand", "a"]) });

    const r = renderWith(ui, <LibraryTab pkg={pkg("a")} here="w1" />);

    const chips = [...r.container.querySelectorAll(".stl-chip.preset")];
    const maps = chips.find((c) => c.textContent.includes("Maps"));
    const qol = chips.find((c) => c.textContent.includes("QoL"));
    expect(maps?.classList.contains("active")).toBe(true);
    expect(qol?.classList.contains("active")).toBe(false);
  });

  it("lists this world alone, with its switch", () => {
    const ui = fakeUi();

    renderWith(ui, <LibraryTab pkg={pkg("b")} here="w1" />);
    fireEvent.click(
      screen.getByRole("switch", { name: "Title b on in Strahd" }),
    );

    expect(screen.getByText("This world")).toBeTruthy();
    expect(ui.flip).toHaveBeenCalledWith("w1", "b", true);
  });
});
