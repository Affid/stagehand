// @vitest-environment happy-dom
import type { WorldInfo } from "@module-library/shared/world";
import { cleanup, fireEvent, waitFor } from "@testing-library/preact";
import { BUNDLED_CONFIG } from "../../src/adapters/config.ts";
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

describe("editing a world's details in place", () => {
  test("the title is changed here and saved through Foundry", async () => {
    const { getByRole, page } = about();
    fireEvent.click(getByRole("button", { name: "Change title" }));
    const input = getByRole("textbox", { name: "Title" });
    fireEvent.input(input, { target: { value: "Curse of Strahd" } });
    fireEvent.keyDown(input, { key: "Enter" });
    await waitFor(() => {
      expect(page.saveWorld).toHaveBeenCalledWith("w1", {
        title: "Curse of Strahd",
      });
    });
  });

  test("the next session is picked in local time and saved as UTC; Clear removes it", async () => {
    const { getByRole, getByLabelText, page } = about({
      nextSession: "2026-11-12T18:00:00.000Z",
    });
    fireEvent.click(getByRole("button", { name: "Change next session" }));
    const input = getByLabelText(/Next session in/);
    fireEvent.input(input, { target: { value: "2026-11-19T19:30" } });
    fireEvent.click(getByRole("button", { name: "Save" }));
    await waitFor(() => {
      expect(page.saveWorld).toHaveBeenCalledWith("w1", {
        nextSession: new Date("2026-11-19T19:30").toISOString(),
      });
    });
    fireEvent.click(getByRole("button", { name: "Change next session" }));
    fireEvent.click(getByRole("button", { name: "Clear" }));
    await waitFor(() => {
      expect(page.saveWorld).toHaveBeenLastCalledWith("w1", {
        nextSession: null,
      });
    });
  });

  test("a save Foundry refuses is reported", async () => {
    const r = about();
    r.page.saveWorld.mockResolvedValueOnce("title: may not be blank");
    fireEvent.click(r.getByRole("button", { name: "Change title" }));
    const input = r.getByRole("textbox", { name: "Title" });
    fireEvent.input(input, { target: { value: "x" } });
    fireEvent.keyDown(input, { key: "Enter" });
    await waitFor(() => {
      expect(r.page.notify).toHaveBeenCalledWith(
        "error",
        expect.stringContaining("may not be blank"),
      );
    });
  });

  test("without the editWorld flag, only Foundry's window edits", () => {
    const base = setupState();
    const r = renderUi("shell", {
      data: {
        setup: base.setup
          ? {
              ...base.setup,
              worlds: [
                {
                  id: "w1",
                  title: "Strahd",
                  system: "dnd5e",
                  systemVersion: "5",
                  coreVersion: "14.369",
                },
              ],
            }
          : undefined,
      },
      state: {
        route: { kind: "world", worldId: "w1" },
        adapter: {
          status: "supported",
          adapter: { ...BUNDLED_CONFIG.adapters[0]!, flags: {} },
        },
      },
    });
    fireEvent.click(r.getByRole("tab", { name: "About" }));
    expect(r.queryByRole("button", { name: "Change title" })).toBe(null);
    expect(r.getByRole("button", { name: "Edit in Foundry" })).toBeTruthy();
  });
});
