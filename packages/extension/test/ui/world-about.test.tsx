// @vitest-environment happy-dom
import type { WorldInfo } from "@module-library/shared/world";
import { cleanup, fireEvent } from "@testing-library/preact";
import { afterEach, describe, expect, test } from "vitest";
import { el, renderUi, setupState } from "./harness.tsx";

afterEach(cleanup);

function about(over: Partial<WorldInfo> = {}) {
  const base = setupState();
  const world: WorldInfo = {
    id: "w1",
    title: "Strahd",
    system: "dnd5e",
    systemVersion: "5.1",
    coreVersion: "14.369",
    ...over,
  };
  const r = renderUi("shell", {
    data: {
      setup: base.setup ? { ...base.setup, worlds: [world] } : undefined,
    },
    state: { route: { kind: "world", worldId: "w1" } },
  });
  fireEvent.click(r.getByRole("tab", { name: "About" }));
  return r;
}

describe("a world's About tab", () => {
  test("tabs switch between Modules and About", () => {
    const r = about();
    expect(
      r.getByRole("tab", { name: "About" }).getAttribute("aria-selected"),
    ).toBe("true");
    expect(r.container.querySelector(".mlw-about")).toBeTruthy();
    fireEvent.click(r.getByRole("tab", { name: "Modules" }));
    expect(r.container.querySelector(".mlw-about")).toBe(null);
  });

  test("shows the cleaned description and Foundry's details", () => {
    const { container } = about({
      description: "<p>Gothic <strong>horror</strong></p><script>x()</script>",
    });
    const box = el(container, ".mlw-about");
    expect(box.querySelector(".ml-rich strong")?.textContent).toBe("horror");
    expect(box.querySelector("script")).toBe(null);
    expect(box.textContent).toContain("dnd5e 5.1");
    expect(box.textContent).toContain("14.369");
  });

  test("the next session shows in local time with its time zone, or says it isn't set", () => {
    const set = about({ nextSession: "2026-11-12T18:00:00.000Z" });
    expect(el(set.container, ".mlw-next").textContent).toMatch(/2026/);
    expect(el(set.container, ".mlw-next").textContent).toMatch(
      /UTC|GMT|[A-Z]{3,4}/,
    );
    cleanup();
    const unset = about();
    expect(el(unset.container, ".mlw-next").textContent).toContain("Not set");
  });

  test("no description says so", () => {
    const { container } = about();
    expect(el(container, ".mlw-about").textContent).toContain(
      "No description yet.",
    );
  });

  test("Edit opens Foundry's World Configuration", () => {
    const { getByRole, page } = about();
    fireEvent.click(getByRole("button", { name: "Edit in Foundry" }));
    expect(page.foundryAction).toHaveBeenCalledWith({
      action: "editWorld",
      worldId: "w1",
    });
  });
});
