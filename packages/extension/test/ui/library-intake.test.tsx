// @vitest-environment happy-dom
// New installs, as the prototype: a band naming them with Sort them and
// Later, and the New modules panel with folder, tags, worlds, a suggestion
// from the module's family, Done and Done with all.
import type { Snapshot } from "@module-library/shared/world";
import { cleanup, fireEvent, waitFor, within } from "@testing-library/preact";
import { afterEach, describe, expect, test } from "vitest";
import type { SetupState } from "../../src/messages.ts";
import { el, LIBRARY, pkg, renderUi, sent, setupState } from "./harness.tsx";

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

const panel = (r: ReturnType<typeof library>): HTMLElement =>
  r.getByRole("complementary", { name: "New modules" });

describe("new installs", () => {
  test("nothing new, no band", () => {
    const { container } = library();
    expect(container.querySelector(".mls-intake-band")).toBe(null);
  });

  test("the band names them; their cards say New", () => {
    const { container } = library({ fresh: ["b", "c"] });
    const band = el(container, ".mls-intake-band");
    expect(band.textContent).toContain("2 new modules since you last sorted");
    expect(band.textContent).toContain("Title b");
    expect(el(container, '.mll-card[data-module="b"]').textContent).toContain(
      "New",
    );
    expect(
      el(container, '.mll-card[data-module="a"]').textContent,
    ).not.toContain("New");
  });

  test("Later marks them sorted, leaving them where they are", async () => {
    const r = library({ fresh: ["b"] });
    fireEvent.click(r.getByRole("button", { name: "Later" }));
    await waitFor(() => {
      expect(sent(r.send)).toContainEqual({
        kind: "modules-sorted",
        ids: ["b"],
      });
    });
  });

  test("Sort them: folder, tags and worlds for each, Done, Done with all", async () => {
    const r = library({
      fresh: ["b", "c"],
      snapshots: { w1: snap(["module-library"]) },
    });
    fireEvent.click(r.getByRole("button", { name: "Sort them" }));
    const p = panel(r);
    expect(within(p).getAllByRole("combobox", { name: "Folder" })).toHaveLength(
      2,
    );
    const item = el(p, '[data-module="b"]');
    fireEvent.click(within(item).getByRole("button", { name: "Strahd" }));
    await waitFor(() => {
      expect(sent(r.send)).toContainEqual(
        expect.objectContaining({
          kind: "queue-apply",
          worldId: "w1",
          modules: ["b"],
        }),
      );
    });
    fireEvent.click(
      within(p).getByRole("button", { name: "Done with Title b" }),
    );
    await waitFor(() => {
      expect(sent(r.send)).toContainEqual({
        kind: "modules-sorted",
        ids: ["b"],
      });
    });
    fireEvent.click(within(p).getByRole("button", { name: "Done with all" }));
    await waitFor(() => {
      expect(sent(r.send)).toContainEqual({
        kind: "modules-sorted",
        ids: ["b", "c"],
      });
    });
  });

  test("a module of a sorted family is offered its folder and tags", async () => {
    const base = setupState();
    const lib = {
      ...LIBRARY,
      modules: {
        ...LIBRARY.modules,
        fam: {
          folderId: LIBRARY.folders[0]?.id ?? null,
          tags: [LIBRARY.tags[0]?.id ?? ""],
          note: "",
        },
      },
    };
    const r = library({
      library: lib,
      fresh: ["fam-extra"],
      setup: base.setup && {
        ...base.setup,
        modules: [...base.setup.modules, pkg("fam"), pkg("fam-extra")],
      },
    });
    fireEvent.click(r.getByRole("button", { name: "Sort them" }));
    const p = panel(r);
    expect(el(p, ".mls-sug").textContent).toContain(
      "Same family as Title fam.",
    );
    fireEvent.click(within(p).getByRole("button", { name: "Use suggestions" }));
    await waitFor(() => {
      expect(sent(r.send)).toContainEqual({
        kind: "library-op",
        op: expect.objectContaining({
          op: "module.setFolder",
          moduleIds: ["fam-extra"],
        }) as unknown,
      });
    });
  });

  test("with nothing left the panel says so, and Later closes it", async () => {
    const r = library({ fresh: ["b"] });
    fireEvent.click(r.getByRole("button", { name: "Sort them" }));
    r.store.set((s) => ({ data: { ...s.data, fresh: [] } }));
    await waitFor(() => {
      expect(panel(r).textContent).toContain("All sorted.");
    });
    fireEvent.click(within(panel(r)).getByRole("button", { name: "Later" }));
    expect(r.queryByRole("complementary", { name: "New modules" })).toBe(null);
  });
});
