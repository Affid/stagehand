// @vitest-environment happy-dom
import { cleanup, fireEvent } from "@testing-library/preact";
import { afterEach, describe, expect, test } from "vitest";
import { renderUi, setupState } from "./harness.tsx";
import { pending, snapshot, W2 } from "./worlds-fixtures.ts";

afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
});

const twoWorlds = () => {
  const base = setupState();
  return { ...base.setup!, worlds: [...base.setup!.worlds, W2] };
};

describe("Next launch strip (P-5, P-6)", () => {
  test("lists only worlds with queued changes, with their effect", () => {
    const { getByText, getByRole, store, queryByText } = renderUi("worlds", {
      data: {
        setup: twoWorlds(),
        snapshots: { w1: snapshot(), w2: snapshot({ worldId: "w2" }) },
        commands: [pending],
      },
    });
    expect(
      getByText("1 world will change when a Gamemaster next launches it"),
    ).toBeTruthy();
    expect(getByText("1 change")).toBeTruthy();
    expect(getByText("2 enable")).toBeTruthy();
    expect(getByText("1 dependency")).toBeTruthy();
    expect(queryByText("Phandelver")).toBeNull();
    fireEvent.click(getByRole("button", { name: "Queued changes for Strahd" }));
    expect(store.get().sheetWorld).toBe("w1");
    fireEvent.click(getByRole("button", { name: "Apply presets…" }));
    expect(store.get().apply).toEqual({ worldId: null });
  });

  test("worlds needing attention are one menu, each opening its sheet", () => {
    const failed = { ...pending, id: "c2", status: "failed" as const };
    const { getByText, store } = renderUi("worlds", {
      data: {
        setup: twoWorlds(),
        snapshots: { w1: snapshot() },
        commands: [failed],
      },
    });
    expect(getByText("Nothing queued", { exact: false })).toBeTruthy();
    fireEvent.click(getByText("2 worlds need attention"));
    expect(getByText("The last change failed")).toBeTruthy();
    fireEvent.click(getByText(/Not tracked: enable/));
    expect(store.get().sheetWorld).toBe("w2");
  });

  test("more than three queued worlds collapse behind Show more", () => {
    const base = setupState().setup!;
    const worlds = ["a", "b", "c", "d"].map((id) => ({
      ...W2,
      id,
      title: `World ${id}`,
    }));
    const { getByText, container } = renderUi("worlds", {
      data: {
        setup: { ...base, worlds },
        commands: worlds.map((w) => ({ ...pending, id: w.id, worldId: w.id })),
      },
    });
    const rows = () => container.querySelectorAll(".ml-next-row").length;
    expect(rows()).toBe(3);
    fireEvent.click(getByText("Show 1 more"));
    expect(rows()).toBe(4);
    fireEvent.click(getByText("Show less"));
    expect(rows()).toBe(3);
  });

  test("first run: a short guide instead of an empty list", () => {
    const { getByText, getByRole, store, queryByText } = renderUi("worlds");
    expect(getByText("No world is tracked yet")).toBeTruthy();
    expect(getByText("Launch the world")).toBeTruthy();
    expect(queryByText("Apply presets…")).toBeNull();
    fireEvent.click(getByRole("button", { name: "Apply presets anyway…" }));
    expect(store.get().apply).toEqual({ worldId: null });
  });

  test("read-only: a lock instead of actions, with the reason", () => {
    const { getByText, queryByRole } = renderUi("worlds", {
      data: { adminVerified: false, snapshots: { w1: snapshot() } },
    });
    expect(getByText("Read-only").getAttribute("aria-label")).toMatch(
      /not seen an authenticated Setup/,
    );
    expect(queryByRole("button", { name: "Apply presets…" })).toBeNull();
  });
});
