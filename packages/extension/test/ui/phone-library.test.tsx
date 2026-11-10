// @vitest-environment happy-dom
// The Library in the phone and tablet layouts (Android plan, phase 3,
// package 4): one row with View and ⋮, no By world on a phone, the short
// notice for new installs, the selection in the dock.
import { cleanup, fireEvent, waitFor, within } from "@testing-library/preact";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { el, renderUi, sent } from "./harness.tsx";

const happy = () =>
  (
    window as unknown as {
      happyDOM: { setViewport(v: { width: number; height: number }): void };
    }
  ).happyDOM;

function touch(width: number, height: number): void {
  happy().setViewport({ width, height });
  vi.spyOn(window, "matchMedia").mockImplementation(
    (query: string) =>
      ({
        matches: query === "(pointer: coarse)",
        media: query,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
      }) as unknown as MediaQueryList,
  );
}

beforeEach(() => {
  happy().setViewport({ width: 412, height: 915 });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  happy().setViewport({ width: 1024, height: 768 });
});

const library = (over: Parameters<typeof renderUi>[1] = {}) =>
  renderUi("shell", {
    ...over,
    state: {
      route: { kind: "library" },
      phone: { home: false, trail: [], at: null },
      ...over.state,
    },
  });

const tabNames = (c: Element): string[] =>
  [...c.querySelectorAll('.sts-main [role="tab"]')].map((b) =>
    b.textContent.replace(/\s+/g, " ").trim(),
  );

describe("the Library's tabs", () => {
  test("a phone has no By world", () => {
    const { container } = library();
    expect(tabNames(container)).toEqual(["Modules 5", "Systems 1"]);
  });

  test("a tablet on its side keeps it", () => {
    touch(1024, 768);
    const { container } = library();
    expect(tabNames(container)).toEqual([
      "Modules 5",
      "Systems 1",
      "By world 1",
    ]);
  });
});

describe("one row: the filter, View and ⋮", () => {
  test("the desktop's toolbar and Foundry's buttons give way to it", () => {
    const { container, getByRole } = library();
    expect(container.querySelector(".stl-toolbar")).toBeNull();
    expect(getByRole("searchbox", { name: "Filter Modules (5)" })).toBeTruthy();
    expect(getByRole("button", { name: "Group by: Folder" })).toBeTruthy();
  });

  test("View picks how modules are grouped, the current one ticked", () => {
    const { getByRole, container } = library();
    fireEvent.click(getByRole("button", { name: "Group by: Folder" }));
    const pop = el(container, ".st-pop");
    expect(
      within(pop)
        .getByRole("button", { name: "Folder" })
        .querySelector(".fa-check"),
    ).not.toBeNull();
    fireEvent.click(within(pop).getByRole("button", { name: "Tag" }));
    expect(getByRole("button", { name: "Group by: Tag" })).toBeTruthy();
  });

  test("⋮ holds Select, Install, Tags, Presets, folders and import and export", () => {
    const { getByRole, container, page, store } = library();
    fireEvent.click(getByRole("button", { name: /^Select, install/ }));
    const pop = el(container, ".st-pop");
    const names = within(pop)
      .getAllByRole("button")
      .map((b) => b.textContent.trim());
    expect(names).toEqual([
      "Select modules",
      "Install a module…",
      "Tags…",
      "Presets…",
      "New folder",
      "Collapse all",
      "Export the library",
      "Import a library…",
      "Import a preset…",
    ]);
    fireEvent.click(
      within(pop).getByRole("button", { name: "Install a module…" }),
    );
    expect(sent(page.foundryAction)).toEqual([
      { action: "installPackage", packageType: "module" },
    ]);
    fireEvent.click(getByRole("button", { name: /^Select, install/ }));
    fireEvent.click(
      within(el(container, ".st-pop")).getByRole("button", { name: "Tags…" }),
    );
    expect(store.get().side).toEqual({ kind: "tags" });
  });

  test("Update all shows with its count when Foundry has updates", () => {
    const { getByRole, container } = library({
      state: { updates: { module: { a: "2.0.0" }, system: {} } },
    });
    fireEvent.click(getByRole("button", { name: /^Select, install/ }));
    expect(
      within(el(container, ".st-pop")).getByRole("button", {
        name: "Update all · 1",
      }),
    ).toBeTruthy();
  });

  test("selecting puts the count and the actions in the dock", async () => {
    const { getByRole, container } = library();
    fireEvent.click(getByRole("button", { name: /^Select, install/ }));
    fireEvent.click(
      within(el(container, ".st-pop")).getByRole("button", {
        name: "Select modules",
      }),
    );
    await waitFor(() => {
      expect(container.querySelector(".stp-dock .sts-selbar")).not.toBeNull();
    });
    expect(container.querySelector(".sts-main .sts-selbar")).toBeNull();
    fireEvent.click(
      within(el(container, ".stp-dock")).getByRole("button", { name: "Done" }),
    );
    await waitFor(() => {
      expect(container.querySelector(".stp-dock .sts-selbar")).toBeNull();
    });
  });

  test("Systems: the filter, Install and Update all as icons", () => {
    const { getByRole, page } = library();
    fireEvent.click(getByRole("tab", { name: /^Systems/ }));
    fireEvent.click(getByRole("button", { name: "Install System" }));
    expect(sent(page.foundryAction)).toEqual([
      { action: "installPackage", packageType: "system" },
    ]);
  });
});

describe("new installs on a phone", () => {
  test("one line: how many to sort, Sort, and × for Later", () => {
    const { container, store, getByRole } = library({
      data: { fresh: ["a", "b"] },
    });
    const band = el(container, ".stp-intake");
    expect(band.textContent).toContain("2 new modules to sort");
    fireEvent.click(within(band).getByRole("button", { name: "Sort them" }));
    expect(store.get().side).toEqual({ kind: "intake" });
    expect(
      getByRole("button", { name: "Later: leave them in Unfiled" }),
    ).toBeTruthy();
  });
});
