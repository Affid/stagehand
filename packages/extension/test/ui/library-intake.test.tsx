// @vitest-environment happy-dom
import {
  act,
  cleanup,
  fireEvent,
  waitFor,
  within,
} from "@testing-library/preact";
import { afterEach, describe, expect, test } from "vitest";
import type { SetupState } from "../../src/messages.ts";
import { el, renderUi, sent } from "./harness.tsx";

afterEach(cleanup);

const library = (data: Partial<SetupState> = {}) =>
  renderUi("shell", {
    data,
    state: { route: { kind: "library" } },
  });

describe("intake for new installs", () => {
  test("nothing new, no band", () => {
    const { container } = library();
    expect(container.querySelector(".mll-intake")).toBe(null);
  });

  test("new modules get a band and a New mark on their cards", () => {
    const { container } = library({ fresh: ["b", "c"] });
    expect(el(container, ".mll-intake").textContent).toContain(
      "2 new since you last sorted",
    );
    expect(el(container, '.mll-card[data-module="b"]').textContent).toContain(
      "New",
    );
    expect(
      el(container, '.mll-card[data-module="a"]').textContent,
    ).not.toContain("New");
  });

  test("Sort them lists each new module with its folder and tags", async () => {
    const { getByRole, send } = library({ fresh: ["b", "c"] });
    fireEvent.click(getByRole("button", { name: "Sort them" }));
    const panel = getByRole("complementary", { name: "New modules" });
    expect(
      within(panel).getAllByRole("combobox", { name: "Folder" }),
    ).toHaveLength(2);
    fireEvent.click(
      within(panel).getByRole("button", { name: "Done with Title b" }),
    );
    await waitFor(() => {
      expect(sent(send)).toContainEqual({ kind: "modules-sorted", ids: ["b"] });
    });
    fireEvent.click(within(panel).getByRole("button", { name: "All sorted" }));
    await waitFor(() => {
      expect(sent(send)).toContainEqual({
        kind: "modules-sorted",
        ids: ["b", "c"],
      });
    });
  });

  test("the panel closes with its button, and by itself once nothing is new", () => {
    const first = library({ fresh: ["b"] });
    fireEvent.click(first.getByRole("button", { name: "Sort them" }));
    fireEvent.click(
      within(
        first.getByRole("complementary", { name: "New modules" }),
      ).getByRole("button", { name: "Close" }),
    );
    expect(first.queryByRole("complementary", { name: "New modules" })).toBe(
      null,
    );
    fireEvent.click(first.getByRole("button", { name: "Sort them" }));
    void act(() => {
      first.store.set((s) => ({ data: { ...s.data, fresh: [] } }));
    });
    expect(first.queryByRole("complementary", { name: "New modules" })).toBe(
      null,
    );
  });
});
