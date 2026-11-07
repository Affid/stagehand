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
    expect(box.textContent).toContain("Dungeons & Dragons Fifth Edition 5.1");
    expect(box.textContent).toContain("14.369");
  });

  test("no description says so", () => {
    const { container } = about();
    expect(el(container, ".mlw-about").textContent).toContain(
      "No description yet.",
    );
  });

  test("no way out to Foundry's World Configuration", () => {
    const { queryByRole } = about();
    expect(queryByRole("button", { name: "Edit in Foundry" })).toBe(null);
  });
});

describe("editing a world's details in place", () => {
  test("the title is changed here and saved through Foundry", async () => {
    const { getByRole, page } = about();
    fireEvent.click(getByRole("button", { name: "Rename" }));
    const input = getByRole("textbox", { name: "Title" });
    fireEvent.input(input, { target: { value: "Curse of Strahd" } });
    fireEvent.click(getByRole("button", { name: "Save" }));
    await waitFor(() => {
      expect(page.saveWorld).toHaveBeenCalledWith("w1", {
        title: "Curse of Strahd",
      });
    });
  });

  test("a save says Saved where it happened, for screen readers too (Phase 6)", async () => {
    const r = about();
    fireEvent.click(r.getByRole("button", { name: "Rename" }));
    fireEvent.input(r.getByRole("textbox", { name: "Title" }), {
      target: { value: "Curse of Strahd" },
    });
    fireEvent.click(r.getByRole("button", { name: "Save" }));
    // Its status region was there before and now says it.
    await waitFor(() =>
      expect(
        r.getAllByRole("status").some((x) => x.textContent === "Saved"),
      ).toBe(true),
    );
    // Focus goes back to where the edit began (review).
    expect(document.activeElement).toBe(
      r.getByRole("button", { name: "Rename" }),
    );
    // A new edit starts clean.
    fireEvent.click(r.getByRole("button", { name: "Rename" }));
    expect(r.queryByText("Saved")).toBeNull();
  });

  test("a save Foundry refuses is reported", async () => {
    const r = about();
    r.page.saveWorld.mockResolvedValueOnce("title: may not be blank");
    fireEvent.click(r.getByRole("button", { name: "Rename" }));
    const input = r.getByRole("textbox", { name: "Title" });
    fireEvent.input(input, { target: { value: "x" } });
    fireEvent.click(r.getByRole("button", { name: "Save" }));
    await waitFor(() => {
      expect(r.page.notify).toHaveBeenCalledWith(
        "error",
        expect.stringContaining("may not be blank"),
      );
    });
  });

  test("without the editWorld flag, the details are read only", () => {
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
    expect(r.queryByRole("button", { name: "Rename" })).toBe(null);
    expect(r.queryByRole("button", { name: "Edit in Foundry" })).toBe(null);
  });

  test("a failed save keeps the editor open with what was typed", async () => {
    const r = about();
    r.page.saveWorld.mockResolvedValueOnce("Foundry did not answer in time.");
    fireEvent.click(r.getByRole("button", { name: "Rename" }));
    const input = r.getByRole("textbox", { name: "Title" });
    fireEvent.input(input, { target: { value: "Typed title" } });
    fireEvent.click(r.getByRole("button", { name: "Save" }));
    await waitFor(() => {
      expect(r.page.notify).toHaveBeenCalled();
    });
    expect(
      (r.getByRole("textbox", { name: "Title" }) as HTMLInputElement).value,
    ).toBe("Typed title");
  });
});
